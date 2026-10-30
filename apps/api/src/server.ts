import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import multer from "multer";
import { z } from "zod";
import { env } from "./config/env.js";
import {
  adviseFarmProblem,
  cropAdviceProvider,
  isCropAdviceConfigured,
  type CropAdvice,
} from "./crop-advice.js";
import { diagnose } from "./diagnostics.js";
import { db } from "./db.js";
import { AppError, isUniqueViolation } from "./errors.js";
import { asyncHandler, authenticate, errorHandler, notFound, requireRole } from "./middleware.js";
import { saveCaseAudio, saveDiagnosisImage, saveDiagnosisVideo, saveExpertDocument } from "./media.js";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from "./password-reset.js";
import { adminManagementRouter, knowledgeRouter } from "./management.js";
import { farmerPlanningRouter } from "./farmer-planning.js";
import type { UserRole } from "./user-role.js";

const app = express();
app.set("trust proxy", 1);
const uploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);
await mkdir(uploadDirectory, { recursive: true });

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", asyncHandler(async (_req, res) => {
  await db.raw("select 1");
  res.json({ status: "ok", database: "connected" });
}));
app.use("/api/admin", adminManagementRouter);
app.use("/api/guides", knowledgeRouter);
app.use("/api/farmer-planning", farmerPlanningRouter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth", authLimiter);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(["farmer", "agrovet", "expert"]),
  phone: z.string().trim().min(7).max(30),
  locationRegion: z.string().trim().min(2).max(100),
  preferredLanguage: z.enum(["en", "sw"]).default("en"),
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
const paymentReceiptSchema = z.object({
  receiptCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,12}$/, "Enter the M-Pesa receipt code shown in your confirmation message."),
});
const productSchema = z.object({
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().min(2).max(80),
  price: z.coerce.number().positive().max(10000000).multipleOf(0.01),
  stockQuantity: z.coerce.number().int().min(0).max(1000000),
  description: z.string().trim().min(5).max(2000),
  imageUrl: z.string().url().max(1000).optional(),
});
const productUpdateSchema = productSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Update at least one product field.",
);

type DbRecord = Record<string, any>;
type CountRow = { count?: string | number };
const photoFeedbackAmountKes = 10;

function paymentReviewerEmails(): Set<string> {
  return new Set(env.PAYMENT_REVIEWER_EMAILS.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function isPaymentReviewer(userId: string): Promise<boolean> {
  const user = await db("users").where({ id: userId }).first("email", "role");
  return Boolean(user && (
    user.role === "admin" ||
    paymentReviewerEmails().has(String(user.email).toLowerCase())
  ));
}

async function requirePaymentReviewer(userId: string): Promise<void> {
  if (!await isPaymentReviewer(userId)) {
    throw new AppError(403, "PAYMENT_REVIEW_FORBIDDEN", "You are not authorized to review payment receipts.");
  }
}

async function requirePhotoFeedbackPayment(auth: NonNullable<Express.Request["auth"]>): Promise<void> {
  const payment = await db("photo_feedback_payments")
    .where({ farmer_id: auth.userId, session_id: auth.sessionId, status: "approved" })
    .first("id");
  if (!payment) {
    throw new AppError(402, "PHOTO_PAYMENT_REQUIRED", "Complete the KSh 10 M-Pesa payment for this sign-in session before requesting feedback.");
  }
}

const requirePaidPhotoFeedback: express.RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new AppError(401, "UNAUTHENTICATED", "Please sign in to continue."));
    return;
  }
  void requirePhotoFeedbackPayment(req.auth).then(() => next()).catch(next);
};

function paymentRequestRecord(row: DbRecord) {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    farmerEmail: row.farmer_email,
    farmerPhone: row.farmer_phone,
    receiptCode: row.receipt_code,
    amountKes: Number(row.amount_kes),
    status: row.status,
    createdAt: row.created_at,
  };
}

function issueToken(user: { id: string; role: UserRole; auth_version: number }): string {
  return jwt.sign({ role: user.role, ver: user.auth_version }, env.JWT_SECRET, {
    jwtid: randomUUID(),
    subject: user.id,
    algorithm: "HS256",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

function privateMediaUrl(url: string, ownerId: string): string {
  if (!url.startsWith("/uploads/")) return url;
  const accessToken = jwt.sign({ media: url }, env.JWT_SECRET, {
    subject: ownerId,
    algorithm: "HS256",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
  return `${url}?token=${encodeURIComponent(accessToken)}`;
}

app.get("/uploads/:filename", asyncHandler(async (req, res) => {
  const filename = z.string().regex(/^[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|pdf)$/i).parse(req.params.filename);
  const relativeUrl = `/uploads/${filename}`;
  const accessToken = z.string().min(1).parse(req.query.token);
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(accessToken, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch {
    throw new AppError(401, "INVALID_MEDIA_TOKEN", "This private photo link has expired.");
  }
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    payload.media !== relativeUrl
  ) {
    throw new AppError(403, "FORBIDDEN", "This photo is not available to this account.");
  }
  const [diagnosis, casePhoto, expertDocument] = await Promise.all([
    db("diagnoses").where({ farmer_id: payload.sub }).andWhere((query) => query
      .where({ image_url: relativeUrl }).orWhere({ video_url: relativeUrl })).first("id"),
    db("crop_case_events").where({ farmer_id: payload.sub }).andWhere((query) => query
      .where({ image_url: relativeUrl }).orWhere({ video_url: relativeUrl }).orWhere({ audio_url: relativeUrl })).first("id"),
    db("expert_profiles").where({ user_id: payload.sub }).andWhere((query) => query
      .where({ license_document_url: relativeUrl }).orWhere({ good_conduct_document_url: relativeUrl })).first("user_id"),
  ]);
  if (!diagnosis && !casePhoto && !expertDocument) throw new AppError(404, "PHOTO_NOT_FOUND", "This private file was not found.");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.sendFile(path.join(uploadDirectory, filename), (error) => {
    if (error) {
      console.error("Failed to serve a private crop photo.", error);
      if (!res.headersSent) res.status(500).end();
    }
  });
}));

function toCents(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new AppError(500, "INVALID_PRODUCT_PRICE", "A product has an invalid stored price.");
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

function safeUser(user: Record<string, unknown>) {
  const { password_hash: _passwordHash, ...safe } = user;
  return {
    id: safe.id,
    name: safe.name,
    email: safe.email,
    role: safe.role,
    phone: safe.phone,
    locationRegion: safe.location_region,
    preferredLanguage: safe.preferred_language ?? "en",
    createdAt: safe.created_at,
  };
}

app.post("/api/auth/register", asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    const [user] = await db("users").insert({
      name: input.name,
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      role: input.role,
      phone: input.phone,
      location_region: input.locationRegion,
      preferred_language: input.preferredLanguage,
    }).returning(["id", "name", "email", "role", "phone", "location_region", "preferred_language", "created_at", "auth_version"]);
    res.status(201).json({ data: { user: safeUser(user), accessToken: issueToken(user) } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists.");
    throw error;
  }
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await db("users").where({ email: input.email.toLowerCase() }).first();
  const matches = user ? await bcrypt.compare(input.password, user.password_hash) : false;
  if (!user || !user.is_active || !matches) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  res.json({ data: { user: safeUser(user), accessToken: issueToken(user) } });
}));

app.post("/api/auth/password-reset/request", authLimiter, asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email().max(254) }).parse(req.body);
  if (!isPasswordResetEmailConfigured()) {
    throw new AppError(503, "PASSWORD_RESET_UNAVAILABLE", "Password reset is temporarily unavailable. Please call Shamba Link support at 0704189723 for help.");
  }
  const normalizedEmail = email.toLowerCase();
  const user = await db("users").where({ email: normalizedEmail, is_active: true }).first("id");
  const { token, tokenHash } = createPasswordResetToken();
  if (user) {
    await db.transaction(async (trx) => {
      await trx("password_reset_tokens").where({ user_id: user.id }).del();
      await trx("password_reset_tokens").insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      });
    });
  }
  try {
    await sendPasswordResetEmail(normalizedEmail, token);
  } catch (error) {
    if (user) await db("password_reset_tokens").where({ token_hash: tokenHash }).del();
    console.error(JSON.stringify({
      level: "error",
      path: req.path,
      message: "Failed to send a password reset email.",
      cause: error instanceof Error ? error.message : "Unknown email delivery error",
    }));
    throw new AppError(503, "PASSWORD_RESET_EMAIL_FAILED", "We couldn't send a reset email right now. Please try again later.");
  }
  res.status(202).json({ message: "If an active account uses that email, a password reset link has been sent." });
}));

app.post("/api/auth/password-reset/confirm", authLimiter, asyncHandler(async (req, res) => {
  const input = z.object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    password: z.string().min(10).max(128),
  }).parse(req.body);
  const tokenHash = hashPasswordResetToken(input.token);
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  await db.transaction(async (trx) => {
    const reset = await trx("password_reset_tokens")
      .where({ token_hash: tokenHash })
      .whereNull("used_at")
      .where("expires_at", ">", trx.fn.now())
      .forUpdate()
      .first("id", "user_id");
    if (!reset) throw new AppError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or has expired. Request a new link.");
    const updated = await trx("users").where({ id: reset.user_id, is_active: true }).update({
      password_hash: passwordHash,
      auth_version: trx.raw("auth_version + 1"),
    });
    if (!updated) throw new AppError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or has expired. Request a new link.");
    await trx("password_reset_tokens").where({ id: reset.id }).update({ used_at: trx.fn.now() });
    await trx("password_reset_tokens").where({ user_id: reset.user_id }).whereNot({ id: reset.id }).del();
  });
  res.json({ message: "Your password has been updated. Sign in with your new password." });
}));

app.get("/api/auth/me", authenticate, asyncHandler(async (req, res) => {
  const user = await db("users").where({ id: req.auth!.userId }).first();
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "This account is no longer available.");
  res.json({ data: safeUser(user) });
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new AppError(415, "UNSUPPORTED_IMAGE", "Choose a JPEG, PNG, or WebP image."));
      return;
    }
    callback(null, true);
  },
});

const caseReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 3, fields: 20 },
  fileFilter: (_req, file, callback) => {
    const allowedImage = file.fieldname === "image" &&
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    const allowedVideo = file.fieldname === "video" &&
      ["video/mp4", "video/webm"].includes(file.mimetype);
    const allowedAudio = file.fieldname === "audio" &&
      ["audio/mp4", "audio/webm"].includes(file.mimetype);
    if (!allowedImage && !allowedVideo && !allowedAudio) {
      callback(new AppError(415, "UNSUPPORTED_MEDIA", "Choose a JPEG, PNG, or WebP photo, MP4/WebM video, or MP4/WebM voice recording."));
      return;
    }
    callback(null, true);
  },
});

const diagnosisUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 2, fields: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedImage = file.fieldname === "image" &&
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    const allowedVideo = file.fieldname === "video" &&
      ["video/mp4", "video/webm"].includes(file.mimetype);
    if (!allowedImage && !allowedVideo) {
      callback(new AppError(415, "UNSUPPORTED_MEDIA", "Choose a JPEG, PNG, or WebP photo and an MP4 or WebM video."));
      return;
    }
    callback(null, true);
  },
});

app.patch("/api/farmer/profile", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const input = z.object({ preferredLanguage: z.enum(["en", "sw"]) }).parse(req.body);
  const [user] = await db("users").where({ id: req.auth!.userId })
    .update({ preferred_language: input.preferredLanguage })
    .returning(["id", "name", "email", "role", "phone", "location_region", "preferred_language", "created_at"]);
  res.json({ data: safeUser(user) });
}));

const expertDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 10 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype)) {
      callback(new AppError(415, "UNSUPPORTED_EXPERT_DOCUMENT", "Choose a JPEG, PNG, or PDF credential document."));
      return;
    }
    callback(null, true);
  },
});

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function expertProfileRecord(row: DbRecord, ownerId: string) {
  return {
    licenseNumber: row.license_number,
    expertise: row.expertise,
    licenseDocumentUrl: privateMediaUrl(row.license_document_url, ownerId),
    goodConductDocumentUrl: privateMediaUrl(row.good_conduct_document_url, ownerId),
    experienceYears: row.experience_years,
    available: row.available,
    serviceRadiusKm: row.service_radius_km,
    consultationRateKes: Number(row.consultation_rate_kes),
    verificationStatus: row.verification_status,
    reviewNote: row.review_note,
    updatedAt: row.updated_at,
  };
}

app.get("/api/expert/profile", authenticate, requireRole("expert"), asyncHandler(async (req, res) => {
  const profile = await db("expert_profiles").where({ user_id: req.auth!.userId }).first() as DbRecord | undefined;
  res.json({ data: profile ? expertProfileRecord(profile, req.auth!.userId) : null });
}));

app.put("/api/expert/profile", authenticate, requireRole("expert"), expertDocumentUpload.fields([
  { name: "licenseDocument", maxCount: 1 },
  { name: "goodConductDocument", maxCount: 1 },
]), asyncHandler(async (req, res) => {
  const input = z.object({
    licenseNumber: z.string().trim().min(3).max(100),
    expertise: z.enum(["veterinary_medicine", "agronomy", "poultry", "crop_protection", "animal_health", "other"]),
    experienceYears: z.coerce.number().int().min(0).max(80),
    available: z.enum(["true", "false"]).transform((value) => value === "true"),
    serviceRadiusKm: z.coerce.number().int().min(1).max(1000),
    consultationRateKes: z.coerce.number().min(0).max(1000000),
  }).parse(req.body);
  const files = req.files as { licenseDocument?: Express.Multer.File[]; goodConductDocument?: Express.Multer.File[] } | undefined;
  const licenseFile = files?.licenseDocument?.[0];
  const goodConductFile = files?.goodConductDocument?.[0];
  if (!licenseFile || !goodConductFile) {
    throw new AppError(400, "EXPERT_DOCUMENTS_REQUIRED", "Upload both your professional credential and Certificate of Good Conduct.");
  }
  const documentExtension = (file: Express.Multer.File): "jpg" | "png" | "pdf" => {
    if (file.mimetype === "image/jpeg" && detectedImageType(file.buffer) === "image/jpeg") return "jpg";
    if (file.mimetype === "image/png" && detectedImageType(file.buffer) === "image/png") return "png";
    if (file.mimetype === "application/pdf" && isPdf(file.buffer)) return "pdf";
    throw new AppError(415, "INVALID_EXPERT_DOCUMENT", "A credential document does not match its file type.");
  };
  const licenseExtension = documentExtension(licenseFile);
  const goodConductExtension = documentExtension(goodConductFile);
  let licenseMedia: Awaited<ReturnType<typeof saveExpertDocument>> | undefined;
  let goodConductMedia: Awaited<ReturnType<typeof saveExpertDocument>> | undefined;
  try {
    licenseMedia = await saveExpertDocument(licenseFile.buffer, licenseExtension);
    goodConductMedia = await saveExpertDocument(goodConductFile.buffer, goodConductExtension);
    const profile = await db.transaction(async (trx) => {
      const [savedProfile] = await trx("expert_profiles").insert({
        user_id: req.auth!.userId,
        license_number: input.licenseNumber,
        expertise: input.expertise,
        license_document_url: licenseMedia!.url,
        good_conduct_document_url: goodConductMedia!.url,
        experience_years: input.experienceYears,
        available: input.available,
        service_radius_km: input.serviceRadiusKm,
        consultation_rate_kes: input.consultationRateKes,
        verification_status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        review_note: "",
        updated_at: trx.fn.now(),
      }).onConflict("user_id").merge().returning("*") as DbRecord[];
      await trx("users").where({ id: req.auth!.userId }).update({
        expert_credentials_verified: false,
        expert_available: false,
      });
      return savedProfile;
    });
    if (!profile) throw new AppError(500, "EXPERT_PROFILE_SAVE_FAILED", "The professional profile could not be saved.");
    res.json({ data: expertProfileRecord(profile, req.auth!.userId) });
  } catch (error) {
    await Promise.all([
      licenseMedia?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded license document", cleanupError)),
      goodConductMedia?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded conduct certificate", cleanupError)),
    ]);
    throw error;
  }
}));

const farmSchema = z.object({
  name: z.string().trim().min(2).max(100),
  county: z.string().trim().min(2).max(100),
  locationDescription: z.string().trim().max(200).default(""),
  sizeAcres: z.coerce.number().positive().max(100000).optional(),
});
const fieldSchema = z.object({
  name: z.string().trim().min(2).max(100),
  cropType: z.string().trim().min(2).max(100),
  plantingDate: z.string().date().optional(),
  soilType: z.string().trim().max(100).default(""),
  irrigationMethod: z.string().trim().max(100).default(""),
});

function farmRecord(row: DbRecord, fields: DbRecord[]) {
  return {
    id: row.id, farmerId: row.farmer_id, name: row.name, county: row.county,
    locationDescription: row.location_description,
    sizeAcres: row.size_acres === null ? null : Number(row.size_acres),
    createdAt: row.created_at,
    fields: fields.filter((field) => field.farm_id === row.id).map((field) => ({
      id: field.id, farmId: field.farm_id, name: field.name, cropType: field.crop_type,
      plantingDate: field.planting_date, soilType: field.soil_type,
      irrigationMethod: field.irrigation_method, createdAt: field.created_at,
    })),
  };
}

app.get("/api/farms", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const rows = await db("farms").where({ farmer_id: req.auth!.userId }).orderBy("created_at", "desc") as DbRecord[];
  const fields = rows.length
    ? await db("crop_fields").where({ farmer_id: req.auth!.userId }).orderBy("created_at", "asc") as DbRecord[]
    : [];
  res.json({ data: rows.map((row) => farmRecord(row, fields)) });
}));

app.post("/api/farms", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const input = farmSchema.parse(req.body);
  const [farm] = await db("farms").insert({
    farmer_id: req.auth!.userId, name: input.name, county: input.county,
    location_description: input.locationDescription,
    size_acres: input.sizeAcres ?? null,
  }).returning("*");
  res.status(201).json({ data: farmRecord(farm, []) });
}));

app.post("/api/farms/:farmId/fields", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const farmId = z.string().uuid().parse(req.params.farmId);
  const farm = await db("farms").where({ id: farmId, farmer_id: req.auth!.userId }).first("id");
  if (!farm) throw new AppError(404, "FARM_NOT_FOUND", "This farm was not found.");
  const input = fieldSchema.parse(req.body);
  const [field] = await db("crop_fields").insert({
    farm_id: farmId, farmer_id: req.auth!.userId, name: input.name,
    crop_type: input.cropType, planting_date: input.plantingDate ?? null,
    soil_type: input.soilType, irrigation_method: input.irrigationMethod,
  }).returning("*");
  res.status(201).json({ data: {
    id: field.id, farmId: field.farm_id, name: field.name, cropType: field.crop_type,
    plantingDate: field.planting_date, soilType: field.soil_type,
    irrigationMethod: field.irrigation_method, createdAt: field.created_at,
  } });
}));

app.patch("/api/fields/:fieldId", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const input = fieldSchema.partial().refine((value) => Object.keys(value).length > 0).parse(req.body);
  const changes: Record<string, string> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.cropType !== undefined) changes.crop_type = input.cropType;
  if (input.plantingDate !== undefined) changes.planting_date = input.plantingDate;
  if (input.soilType !== undefined) changes.soil_type = input.soilType;
  if (input.irrigationMethod !== undefined) changes.irrigation_method = input.irrigationMethod;
  const [field] = await db("crop_fields").where({
    id: z.string().uuid().parse(req.params.fieldId), farmer_id: req.auth!.userId,
  }).update(changes).returning("*");
  if (!field) throw new AppError(404, "FIELD_NOT_FOUND", "This crop passport was not found.");
  res.json({ data: {
    id: field.id, farmId: field.farm_id, name: field.name, cropType: field.crop_type,
    plantingDate: field.planting_date, soilType: field.soil_type,
    irrigationMethod: field.irrigation_method, createdAt: field.created_at,
  } });
}));

const farmInputSchema = z.object({
  farmId: z.string().uuid().optional(),
  productName: z.string().trim().min(2).max(150),
  intendedUse: z.string().trim().min(3).max(500),
  purchaseDate: z.string().date().optional(),
  seller: z.string().trim().max(150).default(""),
  batchNumber: z.string().trim().max(150).default(""),
  applicationDate: z.string().date().optional(),
  instructionsFollowed: z.string().trim().max(2000).default(""),
  observedResults: z.string().trim().max(2000).default(""),
  complaintDetails: z.string().trim().max(2000).default(""),
});

function farmInputRecord(row: DbRecord) {
  return {
    id: row.id, farmerId: row.farmer_id, farmId: row.farm_id,
    productName: row.product_name, intendedUse: row.intended_use,
    purchaseDate: row.purchase_date, seller: row.seller, batchNumber: row.batch_number,
    applicationDate: row.application_date, instructionsFollowed: row.instructions_followed,
    observedResults: row.observed_results, complaintDetails: row.complaint_details,
    complaintStatus: row.complaint_status, createdAt: row.created_at,
  };
}

app.get("/api/farm-inputs", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const rows = await db("farm_input_records").where({ farmer_id: req.auth!.userId })
    .orderBy("created_at", "desc").limit(100) as DbRecord[];
  res.json({ data: rows.map(farmInputRecord) });
}));

app.post("/api/farm-inputs", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const input = farmInputSchema.parse(req.body);
  if (input.farmId) {
    const farm = await db("farms").where({ id: input.farmId, farmer_id: req.auth!.userId }).first("id");
    if (!farm) throw new AppError(404, "FARM_NOT_FOUND", "This farm was not found.");
  }
  const [row] = await db("farm_input_records").insert({
    farmer_id: req.auth!.userId, farm_id: input.farmId ?? null,
    product_name: input.productName, intended_use: input.intendedUse,
    purchase_date: input.purchaseDate ?? null, seller: input.seller,
    batch_number: input.batchNumber, application_date: input.applicationDate ?? null,
    instructions_followed: input.instructionsFollowed, observed_results: input.observedResults,
    complaint_details: input.complaintDetails,
    complaint_status: input.complaintDetails ? "submitted_pending_review" : "none",
  }).returning("*");
  res.status(201).json({ data: farmInputRecord(row) });
}));

const caseStatuses = ["reported", "under_review", "action_required", "follow_up_due", "improving", "referred_to_expert", "closed"] as const;
const outcomeValues = ["improved", "unchanged", "worsened"] as const;
const caseReportSchema = z.object({
  caseType: z.enum(["crop", "livestock"]).default("crop"),
  farmId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  subjectName: z.string().trim().min(2).max(100).optional(),
  cropType: z.string().trim().min(2).max(100).optional(),
  symptoms: z.string().trim().min(5).max(2000),
  startedOn: z.string().date().optional(),
  spreadRate: z.enum(["slow", "steady", "rapid", "unknown"]).default("unknown"),
  affectedPortion: z.string().trim().max(100).default(""),
  contextNotes: z.string().trim().max(2000).default(""),
  allowAi: z.coerce.boolean().default(false),
}).transform((input, context) => {
  const subjectName = input.subjectName ?? input.cropType;
  if (!subjectName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["subjectName"], message: "Add the crop or animal type." });
    return z.NEVER;
  }
  if (input.caseType === "livestock" && input.fieldId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["fieldId"], message: "Animal reports cannot be linked to a crop field." });
    return z.NEVER;
  }
  return { ...input, subjectName };
});

function caseRecord(row: DbRecord, events: DbRecord[]) {
  return {
    id: row.id, reference: row.reference, farmerId: row.farmer_id,
    caseType: row.case_type ?? "crop", subjectName: row.subject_name ?? row.crop_type,
    farmId: row.farm_id, fieldId: row.field_id, cropType: row.crop_type,
    symptoms: row.symptoms, startedOn: row.started_on, spreadRate: row.spread_rate,
    affectedPortion: row.affected_portion, contextNotes: row.context_notes,
    status: row.status, followUpOn: row.follow_up_on, latestOutcome: row.latest_outcome,
    guidance: row.guidance, createdAt: row.created_at, updatedAt: row.updated_at,
    aiAssessment: row.ai_assessment as CropAdvice | null,
    aiAssessmentStatus: row.ai_assessment_status as "available" | "unavailable" | "not_configured" | "not_requested",
    events: events.filter((event) => event.case_id === row.id).map((event) => ({
      id: event.id, type: event.event_type, notes: event.notes, outcome: event.outcome,
      imageUrl: event.image_url ? privateMediaUrl(event.image_url, event.farmer_id) : null,
      videoUrl: event.video_url ? privateMediaUrl(event.video_url, event.farmer_id) : null,
      audioUrl: event.audio_url ? privateMediaUrl(event.audio_url, event.farmer_id) : null,
      followUpOn: event.follow_up_on, createdAt: event.created_at,
    })),
  };
}

async function recommendedAgrovets(region: string, productTypes: string[]) {
  if (!region.trim()) return [];
  type VendorRecommendation = {
    id: string;
    name: string;
    phone: string;
    locationRegion: string;
    products: { id: string; name: string; category: string; description: string; matchScore: number }[];
  };
  const products = await db("products")
    .join("users as vendor", "products.vendor_id", "vendor.id")
    .where("products.stock_quantity", ">", 0)
    .whereILike("vendor.location_region", region)
    .select(
      "products.id", "products.name", "products.category", "products.description",
      "vendor.id as vendor_id", "vendor.name as vendor_name",
      "vendor.phone as vendor_phone", "vendor.location_region as vendor_region",
    )
    .orderBy("products.name")
    .limit(100) as DbRecord[];
  const rankedVendors = new Map<string, VendorRecommendation>();
  for (const product of products) {
    const name = String(product.name);
    const category = String(product.category);
    const searchable = `${name} ${category} ${product.description}`.toLocaleLowerCase();
    const matchScore = productTypes.reduce((score, type) => {
      const normalizedType = type.toLocaleLowerCase();
      if (searchable.includes(normalizedType) || normalizedType.includes(name.toLocaleLowerCase())
        || normalizedType.includes(category.toLocaleLowerCase())) return score + 2;
      const terms = normalizedType.split(/\W+/).filter((term) => term.length > 3);
      return score + (terms.some((term) => searchable.includes(term)) ? 1 : 0);
    }, 0);
    const vendor: VendorRecommendation = rankedVendors.get(product.vendor_id) ?? {
      id: product.vendor_id, name: product.vendor_name, phone: product.vendor_phone,
      locationRegion: product.vendor_region, products: [],
    };
    vendor.products.push({
      id: product.id, name, category, description: product.description, matchScore,
    });
    rankedVendors.set(product.vendor_id, vendor);
  }
  return [...rankedVendors.values()]
    .map((vendor) => ({
      ...vendor,
      products: vendor.products
        .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
        .slice(0, 3)
        .map(({ matchScore: _matchScore, ...product }) => product),
      matchScore: Math.max(0, ...vendor.products.map((product) => product.matchScore)),
    }))
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map(({ matchScore: _matchScore, ...vendor }) => vendor);
}

app.get("/api/cases", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const rows = await db("crop_cases").where({ farmer_id: req.auth!.userId }).orderBy("updated_at", "desc") as DbRecord[];
  const events = rows.length
    ? await db("crop_case_events").where({ farmer_id: req.auth!.userId }).whereIn("case_id", rows.map((row) => row.id)).orderBy("created_at", "asc") as DbRecord[]
    : [];
  res.json({ data: rows.map((row) => caseRecord(row, events)) });
}));

app.get("/api/cases/:caseId/agrovets", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const caseId = z.string().uuid().parse(req.params.caseId);
  const row = await db("crop_cases")
    .where({ id: caseId, farmer_id: req.auth!.userId })
    .first("ai_assessment", "case_type") as DbRecord | undefined;
  if (!row) throw new AppError(404, "CASE_NOT_FOUND", "This farm-health report was not found.");
  if (row.case_type === "livestock") {
    res.json({ data: [] });
    return;
  }
  const farmer = await db("users").where({ id: req.auth!.userId }).first("location_region");
  const types = (row.ai_assessment as CropAdvice | null)?.recommendedProductTypes ?? [];
  res.json({ data: await recommendedAgrovets(String(farmer?.location_region ?? ""), types) });
}));

app.post("/api/cases", authenticate, requireRole("farmer"), caseReportUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]), asyncHandler(async (req, res) => {
  const uploadedFiles = req.files as { image?: Express.Multer.File[]; video?: Express.Multer.File[]; audio?: Express.Multer.File[] } | undefined;
  const image = uploadedFiles?.image?.[0];
  const video = uploadedFiles?.video?.[0];
  const audio = uploadedFiles?.audio?.[0];
  const input = caseReportSchema.parse(req.body);
  if (input.farmId) {
    const farm = await db("farms").where({ id: input.farmId, farmer_id: req.auth!.userId }).first("id");
    if (!farm) throw new AppError(404, "FARM_NOT_FOUND", "This farm was not found.");
  }
  if (input.fieldId) {
    const field = await db("crop_fields").where({ id: input.fieldId, farmer_id: req.auth!.userId }).first("farm_id");
    if (!field || (input.farmId && field.farm_id !== input.farmId)) {
      throw new AppError(404, "FIELD_NOT_FOUND", "This crop passport was not found on the selected farm.");
    }
  }
  if (image && image.size > 8 * 1024 * 1024) {
    throw new AppError(413, "IMAGE_TOO_LARGE", "Choose a photo smaller than 8 MB.");
  }
  const imageType = image ? detectedImageType(image.buffer) : null;
  if (image && (!imageType || imageType !== image.mimetype)) {
      throw new AppError(415, "UNSUPPORTED_IMAGE", "The image format could not be verified.");
  }
  const videoType = video ? detectedVideoType(video.buffer) : null;
  if (video && (!videoType || videoType !== video.mimetype.split(";")[0])) {
    throw new AppError(415, "UNSUPPORTED_VIDEO", "The video format could not be verified. Choose an MP4 or WebM video.");
  }
  if (audio && audio.size > 10 * 1024 * 1024) {
    throw new AppError(413, "AUDIO_TOO_LARGE", "Choose a voice recording smaller than 10 MB.");
  }
  const audioType = audio ? detectedAudioType(audio.buffer) : null;
  if (audio && (!audioType || audioType !== audio.mimetype.split(";")[0])) {
    throw new AppError(415, "UNSUPPORTED_AUDIO", "The voice recording format could not be verified. Choose an MP4 or WebM recording.");
  }
  let media: Awaited<ReturnType<typeof saveDiagnosisImage>> | undefined;
  let videoMedia: Awaited<ReturnType<typeof saveDiagnosisVideo>> | undefined;
  let audioMedia: Awaited<ReturnType<typeof saveCaseAudio>> | undefined;
  const mediaStorageFailures: string[] = [];
  try {
    if (image && imageType) {
      try {
        media = await saveDiagnosisImage(image.buffer, imageType === "image/jpeg" ? "jpg" : imageType === "image/png" ? "png" : "webp");
      } catch (error) {
        mediaStorageFailures.push("photo");
        console.error(JSON.stringify({
          level: "error",
          method: req.method,
          path: req.path,
          message: "Initial crop report photo could not be stored.",
          cause: error instanceof Error ? error.message : "Unknown media storage error",
        }));
      }
    }
    if (video && videoType) {
      try {
        videoMedia = await saveDiagnosisVideo(video.buffer, videoType === "video/mp4" ? "mp4" : "webm");
      } catch (error) {
        mediaStorageFailures.push("video");
        console.error(JSON.stringify({
          level: "error",
          method: req.method,
          path: req.path,
          message: "Initial crop report video could not be stored.",
          cause: error instanceof Error ? error.message : "Unknown media storage error",
        }));
      }
    }
    if (audio && audioType) {
      try {
        audioMedia = await saveCaseAudio(audio.buffer, audioType === "audio/mp4" ? "mp4" : "webm");
      } catch (error) {
        mediaStorageFailures.push("voice recording");
        console.error(JSON.stringify({
          level: "error",
          method: req.method,
          path: req.path,
          message: "Initial crop report voice recording could not be stored.",
          cause: error instanceof Error ? error.message : "Unknown media storage error",
        }));
      }
    }
    let aiAssessment: CropAdvice | null = null;
    let aiAssessmentStatus: "available" | "unavailable" | "not_configured" | "not_requested" = "not_requested";
    if (input.allowAi && !isCropAdviceConfigured()) {
      aiAssessmentStatus = "not_configured";
    }
    if (input.allowAi && isCropAdviceConfigured()) {
      try {
        aiAssessment = await adviseFarmProblem({
          caseType: input.caseType,
          subjectName: input.subjectName,
          symptoms: input.symptoms,
          contextNotes: input.contextNotes,
          spreadRate: input.spreadRate,
          affectedPortion: input.affectedPortion,
          ...(image && imageType ? {
            image: {
              buffer: image.buffer,
              mimeType: imageType,
            },
          } : {}),
        });
        aiAssessmentStatus = "available";
      } catch (error) {
        aiAssessmentStatus = "unavailable";
        console.error(JSON.stringify({
          level: "error",
          method: req.method,
          path: req.path,
          message: `${cropAdviceProvider()} farm-health advice failed; the farmer's report will still be saved.`,
          cause: error instanceof Error ? error.message : `Unknown ${cropAdviceProvider()} error`,
        }));
      }
    }
    const result = await db.transaction(async (trx) => {
      const reference = `SL-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const [row] = await trx("crop_cases").insert({
        reference, farmer_id: req.auth!.userId, farm_id: input.farmId ?? null,
        field_id: input.fieldId ?? null, crop_type: input.subjectName, case_type: input.caseType,
        subject_name: input.subjectName, symptoms: input.symptoms,
        started_on: input.startedOn ?? null, spread_rate: input.spreadRate,
        affected_portion: input.affectedPortion, context_notes: input.contextNotes,
        ai_assessment: aiAssessment, ai_assessment_status: aiAssessmentStatus,
      }).returning("*");
      await trx("crop_case_events").insert({
        case_id: row.id, farmer_id: req.auth!.userId, event_type: "reported",
        notes: `${aiAssessment
          ? `${input.caseType === "livestock" ? "Animal" : "Crop"} problem reported. Unverified AI decision-support guidance is available.`
          : `${input.caseType === "livestock" ? "Animal" : "Crop"} problem reported. No AI assessment was available when the report was submitted.`}${mediaStorageFailures.length
          ? ` Optional ${mediaStorageFailures.join(" and ")} could not be stored; the report was saved without it.`
          : ""}`,
      });
      if (media) await trx("crop_case_events").insert({
        case_id: row.id, farmer_id: req.auth!.userId, event_type: "photo",
        notes: "Initial crop problem photo.", image_url: media.url,
      });
      if (videoMedia) await trx("crop_case_events").insert({
        case_id: row.id, farmer_id: req.auth!.userId, event_type: "video",
        notes: "Initial farm video context. This video was not sent for AI analysis.",
        video_url: videoMedia.url,
      });
      if (audioMedia) await trx("crop_case_events").insert({
        case_id: row.id, farmer_id: req.auth!.userId, event_type: "audio",
        notes: "Farmer voice description. This recording was not transcribed or sent for AI analysis.",
        audio_url: audioMedia.url,
      });
      return row as DbRecord;
    });
    const events = await db("crop_case_events").where({ case_id: result.id }).orderBy("created_at", "asc") as DbRecord[];
    res.status(201).json({ data: {
      ...caseRecord(result, events),
    } });
  } catch (error) {
    await Promise.all([
      media?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded case image", cleanupError)),
      videoMedia?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded case video", cleanupError)),
      audioMedia?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded case audio", cleanupError)),
    ]);
    throw error;
  }
}));

app.post("/api/cases/:caseId/ai-assessment", authenticate, requireRole("farmer"), authLimiter, asyncHandler(async (req, res) => {
  z.object({ consent: z.literal(true) }).parse(req.body);
  const caseId = z.string().uuid().parse(req.params.caseId);
  const row = await db("crop_cases").where({
    id: caseId,
    farmer_id: req.auth!.userId,
  }).first() as DbRecord | undefined;
  if (!row) throw new AppError(404, "CASE_NOT_FOUND", "This crop problem case was not found.");
  if (row.ai_assessment_status === "available" && row.ai_assessment) {
    const events = await db("crop_case_events").where({ case_id: caseId }).orderBy("created_at", "asc") as DbRecord[];
    res.json({ data: caseRecord(row, events) });
    return;
  }
  if (!isCropAdviceConfigured()) {
    await db("crop_cases").where({ id: caseId, farmer_id: req.auth!.userId })
      .update({ ai_assessment_status: "not_configured", updated_at: db.fn.now() });
    throw new AppError(503, "AI_NOT_CONFIGURED", "Crop advice is not configured. Contact the app administrator.");
  }

  let aiAssessment: CropAdvice;
  try {
    aiAssessment = await adviseFarmProblem({
      caseType: row.case_type ?? "crop",
      subjectName: row.subject_name ?? row.crop_type,
      symptoms: row.symptoms,
      contextNotes: row.context_notes,
      spreadRate: row.spread_rate,
      affectedPortion: row.affected_portion,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      method: req.method,
      path: req.path,
      message: `${cropAdviceProvider()} farm-health advice retry failed.`,
      cause: error instanceof Error ? error.message : `Unknown ${cropAdviceProvider()} error`,
    }));
    await db("crop_cases").where({ id: caseId, farmer_id: req.auth!.userId })
      .update({ ai_assessment_status: "unavailable", updated_at: db.fn.now() });
    throw new AppError(502, "AI_ADVICE_UNAVAILABLE", "The AI provider could not complete the assessment. Your report is saved; please try again.");
  }

  const [updated] = await db("crop_cases").where({ id: caseId, farmer_id: req.auth!.userId })
    .update({
      ai_assessment: aiAssessment,
      ai_assessment_status: "available",
      updated_at: db.fn.now(),
    })
    .returning("*") as DbRecord[];
  if (!updated) throw new AppError(404, "CASE_NOT_FOUND", "This crop problem case is no longer available.");
  const events = await db("crop_case_events").where({ case_id: caseId }).orderBy("created_at", "asc") as DbRecord[];
  res.json({ data: caseRecord(updated, events) });
}));

const caseEventSchema = z.object({
  eventType: z.enum(["action", "follow_up", "observation", "expert_request"]),
  notes: z.string().trim().min(3).max(2000),
  outcome: z.enum(outcomeValues).optional(),
  followUpOn: z.string().date().optional(),
}).superRefine((value, context) => {
  if (value.eventType === "observation" && !value.outcome) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Choose the observed crop outcome." });
  }
  if (value.eventType === "follow_up" && !value.followUpOn) {
    context.addIssue({ code: "custom", path: ["followUpOn"], message: "Choose a follow-up date." });
  }
});

app.post("/api/cases/:caseId/events", authenticate, requireRole("farmer"), upload.single("image"), asyncHandler(async (req, res) => {
  const caseId = z.string().uuid().parse(req.params.caseId);
  const row = await db("crop_cases").where({ id: caseId, farmer_id: req.auth!.userId }).first() as DbRecord | undefined;
  if (!row) throw new AppError(404, "CASE_NOT_FOUND", "This crop problem case was not found.");
  if (row.status === "closed") throw new AppError(409, "CASE_CLOSED", "This case is closed. Open a new report for a new problem.");
  let eventInput: z.infer<typeof caseEventSchema> | undefined;
  if (Object.keys(req.body ?? {}).length) eventInput = caseEventSchema.parse(req.body);
  if (!eventInput && !req.file) throw new AppError(400, "EVENT_REQUIRED", "Add a note, observation, or photo.");
  let media: Awaited<ReturnType<typeof saveDiagnosisImage>> | undefined;
  if (req.file) {
    const mimeType = detectedImageType(req.file.buffer);
    if (!mimeType || mimeType !== req.file.mimetype) throw new AppError(415, "UNSUPPORTED_IMAGE", "The image format could not be verified.");
    media = await saveDiagnosisImage(req.file.buffer, mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp");
  }
  try {
    await db.transaction(async (trx) => {
      let nextStatus: typeof caseStatuses[number] = row.status;
      let eventType: string = "photo";
      if (eventInput) {
        eventType = eventInput.eventType;
        if (eventInput.eventType === "action") nextStatus = "action_required";
        if (eventInput.eventType === "expert_request") nextStatus = "action_required";
        if (eventInput.eventType === "observation") {
          nextStatus = eventInput.outcome === "improved" ? "improving"
            : eventInput.outcome === "unchanged" && eventInput.followUpOn ? "follow_up_due"
              : "action_required";
        }
        if (eventInput.eventType === "follow_up") nextStatus = "follow_up_due";
        await trx("crop_case_events").insert({
          case_id: caseId, farmer_id: req.auth!.userId, event_type: eventType,
          notes: eventInput.eventType === "expert_request"
            ? `Expert help requested but not routed or confirmed by this demo. Farmer note: ${eventInput.notes}`
            : eventInput.notes,
          outcome: eventInput.outcome ?? null,
          follow_up_on: eventInput.followUpOn ?? null,
        });
        const changes: DbRecord = { status: nextStatus, updated_at: trx.fn.now() };
        if (eventInput.followUpOn !== undefined) changes.follow_up_on = eventInput.followUpOn;
        if (eventInput.outcome !== undefined) changes.latest_outcome = eventInput.outcome;
        await trx("crop_cases").where({ id: caseId, farmer_id: req.auth!.userId }).update(changes);
      }
      if (media) await trx("crop_case_events").insert({
        case_id: caseId, farmer_id: req.auth!.userId, event_type: "photo",
        notes: eventInput?.notes ?? "Follow-up crop photo.", image_url: media.url,
      });
    });
    const updated = await db("crop_cases").where({ id: caseId, farmer_id: req.auth!.userId }).first() as DbRecord;
    const events = await db("crop_case_events").where({ case_id: caseId }).orderBy("created_at", "asc") as DbRecord[];
    res.status(201).json({ data: caseRecord(updated, events) });
  } catch (error) {
    await media?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded case image", cleanupError));
    throw error;
  }
}));

app.patch("/api/cases/:caseId/status", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const input = z.object({
    status: z.enum(caseStatuses),
    notes: z.string().trim().min(3).max(2000),
  }).parse(req.body);
  const row = await db("crop_cases").where({ id: z.string().uuid().parse(req.params.caseId), farmer_id: req.auth!.userId }).first() as DbRecord | undefined;
  if (!row) throw new AppError(404, "CASE_NOT_FOUND", "This crop problem case was not found.");
  if (row.status === "closed") throw new AppError(409, "CASE_CLOSED", "This case is already closed.");
  if (input.status !== "closed") throw new AppError(400, "INVALID_STATUS", "Use a recovery timeline update for other case statuses.");
  if (!row.latest_outcome) throw new AppError(400, "OUTCOME_REQUIRED", "Record what you observed before closing this case.");
  await db.transaction(async (trx) => {
    await trx("crop_cases").where({ id: row.id, farmer_id: req.auth!.userId })
      .update({ status: "closed", updated_at: trx.fn.now() });
    await trx("crop_case_events").insert({
      case_id: row.id, farmer_id: req.auth!.userId, event_type: "status_change",
      notes: input.notes,
    });
  });
  const updated = await db("crop_cases").where({ id: row.id }).first() as DbRecord;
  const events = await db("crop_case_events").where({ case_id: row.id }).orderBy("created_at", "asc") as DbRecord[];
  res.json({ data: caseRecord(updated, events) });
}));

function detectedImageType(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function detectedVideoType(buffer: Buffer): "video/mp4" | "video/webm" | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  return null;
}

function detectedAudioType(buffer: Buffer): "audio/mp4" | "audio/webm" | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "audio/webm";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  return null;
}

app.get("/api/experts", asyncHandler(async (_req, res) => {
  const experts = await db("users")
    .leftJoin("expert_profiles", "users.id", "expert_profiles.user_id")
    .select(
      "users.id", "users.name", "users.location_region",
      "expert_profiles.expertise", "expert_profiles.service_radius_km",
      "expert_profiles.consultation_rate_kes",
    )
    .where({
      "users.role": "expert",
      "users.expert_credentials_verified": true,
      "users.expert_available": true,
    }).andWhere((query) => query
      .where("expert_profiles.verification_status", "verified")
      .orWhereNull("expert_profiles.user_id"))
    .orderBy("users.name").limit(50);
  res.json({ data: experts.map((expert) => ({
    id: expert.id, name: expert.name, locationRegion: expert.location_region,
    expertise: expert.expertise ?? null, serviceRadiusKm: expert.service_radius_km ?? null,
    consultationRateKes: expert.consultation_rate_kes == null ? null : Number(expert.consultation_rate_kes),
  })) });
}));

app.get("/api/admin/expert-verification", authenticate, requireRole("admin"), asyncHandler(async (req, res) => {
  const status = z.enum(["pending", "verified", "rejected"]).default("pending").parse(req.query.status);
  const profiles = await db("expert_profiles")
    .join("users", "expert_profiles.user_id", "users.id")
    .where("expert_profiles.verification_status", status)
    .select(
      "expert_profiles.*", "users.name", "users.email", "users.phone",
      "users.location_region",
    )
    .orderBy("expert_profiles.created_at", "asc")
    .limit(100) as DbRecord[];
  res.json({ data: profiles.map((profile) => ({
    userId: profile.user_id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    locationRegion: profile.location_region,
    ...expertProfileRecord(profile, profile.user_id),
  })) });
}));

app.patch("/api/admin/expert-verification/:userId", authenticate, requireRole("admin"), asyncHandler(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.userId);
  const input = z.object({
    status: z.enum(["verified", "rejected"]),
    reviewNote: z.string().trim().max(1000).default(""),
  }).superRefine((value, context) => {
    if (value.status === "rejected" && value.reviewNote.length < 3) {
      context.addIssue({ code: "custom", path: ["reviewNote"], message: "Give the professional a reason for rejection." });
    }
  }).parse(req.body);
  await db.transaction(async (trx) => {
    const profile = await trx("expert_profiles").where({ user_id: userId }).first("available");
    if (!profile) throw new AppError(404, "EXPERT_PROFILE_NOT_FOUND", "This professional has not submitted a profile for review.");
    await trx("expert_profiles").where({ user_id: userId }).update({
      verification_status: input.status,
      reviewed_by: req.auth!.userId,
      reviewed_at: trx.fn.now(),
      review_note: input.reviewNote,
      updated_at: trx.fn.now(),
    });
    await trx("users").where({ id: userId, role: "expert" }).update({
      expert_credentials_verified: input.status === "verified",
      expert_available: input.status === "verified" && profile.available,
    });
  });
  res.json({ data: { userId, verificationStatus: input.status } });
}));

app.get("/api/photo-payments/status", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const payment = await db("photo_feedback_payments")
    .where({ farmer_id: req.auth!.userId, session_id: req.auth!.sessionId })
    .first("receipt_code", "status", "created_at", "result_description");
  res.json({ data: {
    amountKes: photoFeedbackAmountKes,
    recipientPhone: env.PHOTO_FEEDBACK_RECIPIENT_PHONE,
    status: payment?.status ?? "not_submitted",
    receiptCode: payment?.receipt_code ?? null,
    createdAt: payment?.created_at ?? null,
    resultDescription: payment?.result_description ?? null,
  } });
}));

app.post("/api/photo-payments/request", authLimiter, authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const { receiptCode } = paymentReceiptSchema.parse(req.body);
  const key = { farmer_id: req.auth!.userId, session_id: req.auth!.sessionId };
  const existing = await db("photo_feedback_payments").where(key).first() as DbRecord | undefined;
  if (existing?.checkout_request_id) {
    throw new AppError(409, "OLD_AUTOMATIC_PAYMENT", "Sign out and back in to start a new manual Send Money payment session.");
  }
  if (existing && existing.status !== "rejected") {
    throw new AppError(409, "PAYMENT_REQUEST_EXISTS", "A receipt for this sign-in session is already awaiting review or has been approved.");
  }
  try {
    let payment: DbRecord;
    if (existing) {
      const [updated] = await db("photo_feedback_payments")
        .where({ id: existing.id, status: "rejected" })
        .update({
          receipt_code: receiptCode,
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          result_code: null,
          result_description: null,
          updated_at: db.fn.now(),
        })
        .returning("*") as DbRecord[];
      if (!updated) throw new AppError(409, "PAYMENT_REQUEST_CHANGED", "This payment request changed while being submitted. Refresh and try again.");
      payment = updated;
    } else {
      const [created] = await db("photo_feedback_payments").insert({
        ...key,
        receipt_code: receiptCode,
        amount_kes: photoFeedbackAmountKes,
        status: "pending",
      }).returning("*") as DbRecord[];
      if (!created) throw new AppError(500, "PAYMENT_REQUEST_FAILED", "The receipt request could not be saved.");
      payment = created;
    }
    res.status(201).json({ data: {
      amountKes: Number(payment.amount_kes),
      recipientPhone: env.PHOTO_FEEDBACK_RECIPIENT_PHONE,
      status: payment.status,
      receiptCode: payment.receipt_code,
      createdAt: payment.created_at,
      resultDescription: payment.result_description ?? null,
    } });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) {
      const receiptExists = await db("photo_feedback_payments")
        .where({ receipt_code: receiptCode })
        .first("id") as DbRecord | undefined;
      if (receiptExists && receiptExists.id !== existing?.id) {
        throw new AppError(409, "RECEIPT_ALREADY_USED", "That M-Pesa receipt code has already been submitted. Enter your own payment receipt.");
      }
      throw new AppError(409, "PAYMENT_REQUEST_EXISTS", "A payment request for this sign-in session already exists. Refresh the payment status.");
    }
    throw error;
  }
}));

app.get("/api/admin/photo-payments/capability", authenticate, asyncHandler(async (req, res) => {
  res.json({ data: { canReview: await isPaymentReviewer(req.auth!.userId) } });
}));

app.get("/api/admin/overview", authenticate, requireRole("admin"), asyncHandler(async (_req, res) => {
  const [userCounts, pendingPayments] = await Promise.all([
    db("users").select("role").count({ count: "id" }).groupBy("role") as Promise<{ role: UserRole; count: string }[]>,
    db("photo_feedback_payments")
      .where({ status: "pending" })
      .whereNull("checkout_request_id")
      .count({ count: "id" })
      .first() as Promise<CountRow>,
  ]);
  const counts = Object.fromEntries(userCounts.map(({ role, count }) => [role, Number(count)]));
  res.json({ data: {
    users: {
      total: userCounts.reduce((total, row) => total + Number(row.count), 0),
      farmers: counts.farmer ?? 0,
      agrovets: counts.agrovet ?? 0,
      experts: counts.expert ?? 0,
    },
    pendingPaymentReviews: Number(pendingPayments.count ?? 0),
  } });
}));

app.get("/api/admin/photo-payments", authenticate, asyncHandler(async (req, res) => {
  await requirePaymentReviewer(req.auth!.userId);
  const rows = await db("photo_feedback_payments as payment")
    .join("users as farmer", "payment.farmer_id", "farmer.id")
    .where("payment.status", "pending")
    .whereNull("payment.checkout_request_id")
    .select(
      "payment.id", "payment.farmer_id", "payment.receipt_code", "payment.amount_kes",
      "payment.status", "payment.created_at", "farmer.name as farmer_name",
      "farmer.email as farmer_email", "farmer.phone as farmer_phone",
    )
    .orderBy("payment.created_at", "asc")
    .limit(100) as DbRecord[];
  res.json({ data: rows.map(paymentRequestRecord) });
}));

app.patch("/api/admin/photo-payments/:paymentId", authenticate, asyncHandler(async (req, res) => {
  await requirePaymentReviewer(req.auth!.userId);
  const paymentId = z.string().uuid().parse(req.params.paymentId);
  const { status } = z.object({ status: z.enum(["approved", "rejected"]) }).parse(req.body);
  const [payment] = await db("photo_feedback_payments")
    .where({ id: paymentId, status: "pending" })
    .whereNull("checkout_request_id")
    .update({
      status,
      reviewed_by: req.auth!.userId,
      reviewed_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*") as DbRecord[];
  if (!payment) {
    const exists = await db("photo_feedback_payments").where({ id: paymentId }).first("id", "checkout_request_id");
    if (!exists) throw new AppError(404, "PAYMENT_NOT_FOUND", "This payment request was not found.");
    if (exists.checkout_request_id) {
      throw new AppError(409, "AUTOMATIC_PAYMENT", "M-Pesa payments are confirmed automatically and cannot be manually reviewed.");
    }
    throw new AppError(409, "PAYMENT_ALREADY_REVIEWED", "This payment request has already been reviewed.");
  }
  res.json({ data: { id: payment.id, status: payment.status } });
}));

app.post("/api/diagnoses", authenticate, requireRole("farmer"), authLimiter, requirePaidPhotoFeedback, diagnosisUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]), asyncHandler(async (req, res) => {
  const uploadedFiles = req.files as { image?: Express.Multer.File[]; video?: Express.Multer.File[] } | undefined;
  const image = uploadedFiles?.image?.[0];
  const video = uploadedFiles?.video?.[0];
  if (!image) throw new AppError(400, "IMAGE_REQUIRED", "Choose an image to continue.");
  if (image.size > 8 * 1024 * 1024) {
    throw new AppError(413, "IMAGE_TOO_LARGE", "Choose a photo smaller than 8 MB.");
  }
  const mimeType = detectedImageType(image.buffer);
  if (!mimeType || mimeType !== image.mimetype) {
    throw new AppError(415, "UNSUPPORTED_IMAGE", "The image format could not be verified.");
  }
  const videoType = video ? detectedVideoType(video.buffer) : null;
  if (video && (!videoType || videoType !== video.mimetype.split(";")[0])) {
    throw new AppError(415, "UNSUPPORTED_VIDEO", "The video format could not be verified. Choose an MP4 or WebM video.");
  }
  const subject = z.enum(["crop", "livestock"]).parse(req.body.subject);
  const result = await diagnose(image.buffer, mimeType, subject);
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  let imageMedia: Awaited<ReturnType<typeof saveDiagnosisImage>> | undefined;
  let videoMedia: Awaited<ReturnType<typeof saveDiagnosisVideo>> | undefined;
  try {
    imageMedia = await saveDiagnosisImage(image.buffer, extension);
    if (video && videoType) {
      videoMedia = await saveDiagnosisVideo(video.buffer, videoType === "video/mp4" ? "mp4" : "webm");
    }
    const [row] = await db("diagnoses").insert({
      farmer_id: req.auth!.userId,
      image_url: imageMedia.url,
      video_url: videoMedia?.url ?? null,
      detected_disease: result.detectedDisease,
      confidence_score: result.confidenceScore,
      severity_level: result.severityLevel,
      treatment_recommendations: result.treatmentRecommendations,
      preventive_measures: result.preventiveMeasures,
    }).returning("*");
    res.status(201).json({ data: {
      id: row.id, farmerId: row.farmer_id, imageUrl: privateMediaUrl(row.image_url, row.farmer_id),
      videoUrl: row.video_url ? privateMediaUrl(row.video_url, row.farmer_id) : null,
      detectedDisease: row.detected_disease, confidenceScore: Number(row.confidence_score),
      severityLevel: row.severity_level, treatmentRecommendations: row.treatment_recommendations,
      preventiveMeasures: row.preventive_measures, requiresExpertReview: result.requiresExpertReview,
      createdAt: row.created_at,
    } });
  } catch (error) {
    await Promise.all([
      imageMedia?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded diagnostic image", cleanupError)),
      videoMedia?.delete().catch((cleanupError: unknown) => console.error("Failed to clean up uploaded diagnostic video", cleanupError)),
    ]);
    throw error;
  }
}));

app.get("/api/diagnoses", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const pageSize = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.pageSize);
  const query = db("diagnoses").where({ farmer_id: req.auth!.userId });
  const [countRow] = await query.clone().count<CountRow[]>({ count: "*" });
  const rows = (await query.clone().orderBy("created_at", "desc").limit(pageSize).offset((page - 1) * pageSize)) as DbRecord[];
  res.json({ data: rows.map((row: DbRecord) => ({
    id: row.id, farmerId: row.farmer_id, imageUrl: privateMediaUrl(row.image_url, row.farmer_id),
    videoUrl: row.video_url ? privateMediaUrl(row.video_url, row.farmer_id) : null,
    detectedDisease: row.detected_disease, confidenceScore: Number(row.confidence_score),
    severityLevel: row.severity_level, treatmentRecommendations: row.treatment_recommendations,
    preventiveMeasures: row.preventive_measures, createdAt: row.created_at,
  })), page, pageSize, total: Number(countRow?.count ?? 0) });
}));

app.get("/api/products", asyncHandler(async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const pageSize = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.pageSize);
  const search = z.string().trim().max(100).optional().parse(req.query.search);
  const category = z.string().trim().max(80).optional().parse(req.query.category);
  const region = z.string().trim().max(100).optional().parse(req.query.region);
  const query = db("products")
    .join("users as vendor", "products.vendor_id", "vendor.id")
    .where("products.stock_quantity", ">", 0)
    .modify((builder) => {
      if (search) builder.whereILike("products.name", `%${search}%`);
      if (category && category !== "All") builder.where("products.category", category);
      if (region) builder.whereILike("vendor.location_region", region);
    });
  const [countRow] = await query.clone().countDistinct<CountRow[]>({ count: "products.id" });
  const rows = (await query.clone().select(
    "products.*", "vendor.name as vendor_name", "vendor.location_region as vendor_region",
  ).orderBy("products.created_at", "desc").limit(pageSize).offset((page - 1) * pageSize)) as DbRecord[];
  res.json({ data: rows.map((row: DbRecord) => ({
    id: row.id, vendorId: row.vendor_id, vendorName: row.vendor_name,
    vendorRegion: row.vendor_region, name: row.name, category: row.category,
    price: String(row.price), stockQuantity: row.stock_quantity,
    description: row.description, imageUrl: row.image_url, createdAt: row.created_at,
  })), page, pageSize, total: Number(countRow?.count ?? 0) });
}));

app.get("/api/products/mine", authenticate, requireRole("agrovet"), asyncHandler(async (req, res) => {
  const rows = await db("products").where({ vendor_id: req.auth!.userId })
    .orderBy("created_at", "desc").limit(100);
  res.json({ data: rows.map((row) => ({
    id: row.id, vendorId: row.vendor_id, name: row.name, category: row.category,
    price: String(row.price), stockQuantity: row.stock_quantity,
    description: row.description, imageUrl: row.image_url, createdAt: row.created_at,
  })) });
}));

app.post("/api/products", authenticate, requireRole("agrovet"), asyncHandler(async (req, res) => {
  const input = productSchema.parse(req.body);
  const [row] = await db("products").insert({
    vendor_id: req.auth!.userId, name: input.name, category: input.category,
    price: input.price.toFixed(2), stock_quantity: input.stockQuantity,
    description: input.description,
    image_url: input.imageUrl ?? "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80",
  }).returning("*");
  res.status(201).json({ data: {
    id: row.id, vendorId: row.vendor_id, name: row.name, category: row.category,
    price: String(row.price), stockQuantity: row.stock_quantity,
    description: row.description, imageUrl: row.image_url, createdAt: row.created_at,
  } });
}));

app.patch("/api/products/:id", authenticate, requireRole("agrovet"), asyncHandler(async (req, res) => {
  const input = productUpdateSchema.parse(req.body);
  const changes: Record<string, string | number> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.category !== undefined) changes.category = input.category;
  if (input.price !== undefined) changes.price = input.price.toFixed(2);
  if (input.stockQuantity !== undefined) changes.stock_quantity = input.stockQuantity;
  if (input.description !== undefined) changes.description = input.description;
  if (input.imageUrl !== undefined) changes.image_url = input.imageUrl;
  const updated = await db("products").where({
    id: z.string().uuid().parse(req.params.id),
    vendor_id: req.auth!.userId,
  }).update(changes).returning("*");
  if (!updated[0]) throw new AppError(404, "PRODUCT_NOT_FOUND", "This product was not found in your shop.");
  res.json({ data: {
    id: updated[0].id, vendorId: updated[0].vendor_id, name: updated[0].name,
    category: updated[0].category, price: String(updated[0].price),
    stockQuantity: updated[0].stock_quantity, description: updated[0].description,
    imageUrl: updated[0].image_url, createdAt: updated[0].created_at,
  } });
}));

app.get("/api/agrovets/nearby", asyncHandler(async (req, res) => {
  const region = z.string().trim().min(1).max(100).parse(req.query.region);
  const agrovets = await db("users").select("id", "name", "phone", "location_region")
    .where({ role: "agrovet" }).whereILike("location_region", region)
    .orderBy("name").limit(50);
  res.json({ data: agrovets.map((vendor) => ({
    id: vendor.id, name: vendor.name, phone: vendor.phone, locationRegion: vendor.location_region,
  })) });
}));

const orderSchema = z.object({
  vendorId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(10000) })).min(1).max(100),
}).superRefine((input, context) => {
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    context.addIssue({ code: "custom", message: "Each product may appear only once.", path: ["items"] });
  }
});

app.post("/api/orders", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const input = orderSchema.parse(req.body);
  const order = await db.transaction(async (trx) => {
    const products = await trx("products").where({ vendor_id: input.vendorId })
      .whereIn("id", input.items.map((item) => item.productId)).orderBy("id").forUpdate();
    if (products.length !== input.items.length) throw new AppError(409, "PRODUCT_UNAVAILABLE", "One or more products are no longer available.");
    const byId = new Map(products.map((product) => [product.id, product]));
    const lineItems = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      if (product.stock_quantity < item.quantity) throw new AppError(409, "INSUFFICIENT_STOCK", `${product.name} does not have enough stock.`);
      const priceCents = toCents(String(product.price));
      return { productId: product.id, quantity: item.quantity, priceCents, product };
    });
    const totalCents = lineItems.reduce((total, line) => total + line.priceCents * line.quantity, 0);
    const [created] = await trx("orders").insert({
      farmer_id: req.auth!.userId, vendor_id: input.vendorId,
      total_amount: (totalCents / 100).toFixed(2), status: "pending",
    }).returning("*");
    for (const line of lineItems) {
      await trx("order_items").insert({
        order_id: created.id, product_id: line.productId,
        quantity: line.quantity, price: (line.priceCents / 100).toFixed(2),
      });
      const updated = await trx("products").where({ id: line.productId })
        .where("stock_quantity", ">=", line.quantity)
        .decrement("stock_quantity", line.quantity);
      if (updated !== 1) throw new AppError(409, "INSUFFICIENT_STOCK", "Stock changed while placing your order. Please try again.");
    }
    return {
      id: created.id, farmerId: created.farmer_id, vendorId: created.vendor_id,
      totalAmount: String(created.total_amount), status: created.status, createdAt: created.created_at,
      items: lineItems.map((line) => ({
        productId: line.productId, name: line.product.name,
        quantity: line.quantity, price: (line.priceCents / 100).toFixed(2),
      })),
    };
  });
  res.status(201).json({ data: order });
}));

const consultationSchema = z.object({
  expertId: z.string().uuid(),
  diagnosisId: z.string().uuid().optional(),
  scheduledTime: z.string().datetime(),
  notes: z.string().trim().max(2000).default(""),
});

app.post("/api/consultations", authenticate, requireRole("farmer"), asyncHandler(async (req, res) => {
  const input = consultationSchema.parse(req.body);
  const scheduledTime = new Date(input.scheduledTime);
  if (scheduledTime.getTime() <= Date.now()) throw new AppError(400, "INVALID_TIME", "Choose a future appointment time.");
  const expert = await db("users").where({
    id: input.expertId, role: "expert",
    expert_credentials_verified: true, expert_available: true,
  }).first("id");
  if (!expert) throw new AppError(404, "EXPERT_NOT_FOUND", "This verified professional is not currently available.");
  if (input.diagnosisId) {
    const diagnosis = await db("diagnoses").where({ id: input.diagnosisId, farmer_id: req.auth!.userId }).first("id");
    if (!diagnosis) throw new AppError(404, "DIAGNOSIS_NOT_FOUND", "The selected diagnosis was not found.");
  }
  const conflict = await db("consultations").where({ expert_id: input.expertId, scheduled_time: scheduledTime.toISOString(), status: "pending" }).first("id");
  if (conflict) throw new AppError(409, "SLOT_UNAVAILABLE", "That time has just been booked. Please choose another.");
  const [row] = await db("consultations").insert({
    farmer_id: req.auth!.userId, expert_id: input.expertId, diagnosis_id: input.diagnosisId ?? null,
    scheduled_time: scheduledTime.toISOString(), notes: input.notes,
  }).returning("*");
  res.status(201).json({ data: {
    id: row.id, farmerId: row.farmer_id, expertId: row.expert_id,
    diagnosisId: row.diagnosis_id, status: row.status,
    scheduledTime: row.scheduled_time, notes: row.notes, createdAt: row.created_at,
  } });
}));

app.get("/api/consultations", authenticate, asyncHandler(async (req, res) => {
  if (req.auth!.role === "agrovet") throw new AppError(403, "FORBIDDEN", "Consultations are available to farmers and experts.");
  const column = req.auth!.role === "expert" ? "expert_id" : "farmer_id";
  const rows = await db("consultations").where({ [column]: req.auth!.userId })
    .orderBy("scheduled_time", "asc").limit(100);
  res.json({ data: rows.map((row) => ({
    id: row.id, farmerId: row.farmer_id, expertId: row.expert_id,
    diagnosisId: row.diagnosis_id, status: row.status,
    scheduledTime: row.scheduled_time, notes: row.notes, createdAt: row.created_at,
  })) });
}));

app.get("/api/orders", authenticate, asyncHandler(async (req, res) => {
  if (req.auth!.role === "expert") throw new AppError(403, "FORBIDDEN", "Orders are available to farmers and agrovets.");
  const column = req.auth!.role === "agrovet" ? "vendor_id" : "farmer_id";
  const rows = await db("orders").where({ [column]: req.auth!.userId }).orderBy("created_at", "desc").limit(100);
  res.json({ data: rows.map((row) => ({
    id: row.id, farmerId: row.farmer_id, vendorId: row.vendor_id,
    totalAmount: String(row.total_amount), status: row.status, createdAt: row.created_at,
  })) });
}));

app.patch("/api/orders/:id/status", authenticate, requireRole("agrovet"), asyncHandler(async (req, res) => {
  const status = z.enum(["processing", "delivered"]).parse(req.body.status);
  const updated = await db("orders").where({
    id: z.string().uuid().parse(req.params.id),
    vendor_id: req.auth!.userId,
    status: status === "processing" ? "pending" : "processing",
  }).update({ status }).returning("*");
  if (!updated[0]) throw new AppError(404, "ORDER_NOT_FOUND", "This order cannot be updated.");
  res.json({ data: {
    id: updated[0].id, totalAmount: String(updated[0].total_amount),
    status: updated[0].status, createdAt: updated[0].created_at,
  } });
}));

app.patch("/api/consultations/:id/status", authenticate, asyncHandler(async (req, res) => {
  if (!["farmer", "expert"].includes(req.auth!.role)) {
    throw new AppError(403, "FORBIDDEN", "Only the farmer or assigned expert can update this appointment.");
  }
  const status = z.enum(["completed", "cancelled"]).parse(req.body.status);
  const column = req.auth!.role === "expert" ? "expert_id" : "farmer_id";
  const updated = await db("consultations").where({ id: req.params.id, [column]: req.auth!.userId, status: "pending" })
    .update({ status }).returning("*");
  if (!updated[0]) throw new AppError(404, "CONSULTATION_NOT_FOUND", "This pending appointment was not found.");
  res.json({ data: { id: updated[0].id, status: updated[0].status } });
}));

app.use(notFound);
app.use(errorHandler);

if (env.NODE_ENV === "production" && !paymentReviewerEmails().size) {
  const admin = await db("users").where({ role: "admin" }).first("id");
  if (!admin) {
    throw new Error("Create an administrator account or configure PAYMENT_REVIEWER_EMAILS before starting in production.");
  }
}

const server = app.listen(env.PORT, () => {
  console.log(`Shamba Link API listening on http://localhost:${env.PORT}`);
});

async function shutdown() {
  server.close();
  await db.destroy();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

export { app };
