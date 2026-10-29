import { Router } from "express";
import { z } from "zod";
import { db } from "./db.js";
import { AppError, isUniqueViolation } from "./errors.js";
import { authenticate, requireRole } from "./middleware.js";
import { userRoles } from "./user-role.js";

type DbRecord = Record<string, any>;
const adminOnly = [authenticate, requireRole("admin")];
const guideCategories = ["crop", "pest", "disease", "soil", "livestock", "prevention"] as const;
const caseStatuses = ["reported", "under_review", "action_required", "follow_up_due", "improving", "referred_to_expert", "closed"] as const;

const guideInputSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(guideCategories),
  titleEn: z.string().trim().min(3).max(180),
  titleSw: z.string().trim().min(3).max(180),
  summaryEn: z.string().trim().min(5).max(500),
  summarySw: z.string().trim().min(5).max(500),
  bodyEn: z.string().trim().min(20).max(10000),
  bodySw: z.string().trim().min(20).max(10000),
  isPublished: z.boolean().default(true),
});

function guideRecord(row: Record<string, any>) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    titleEn: row.title_en,
    titleSw: row.title_sw,
    summaryEn: row.summary_en,
    summarySw: row.summary_sw,
    bodyEn: row.body_en,
    bodySw: row.body_sw,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const knowledgeRouter = Router();

knowledgeRouter.get("/", async (req, res, next) => {
  try {
    const query = z.string().trim().max(120).default("").parse(req.query.search);
    const category = z.enum(guideCategories).optional().parse(req.query.category);
    const rows = await db("knowledge_guides")
      .where({ is_published: true })
      .modify((builder) => {
        if (category) builder.where({ category });
        if (query) {
          const term = `%${query}%`;
          builder.andWhere((search) => search
            .whereILike("title_en", term)
            .orWhereILike("title_sw", term)
            .orWhereILike("summary_en", term)
            .orWhereILike("summary_sw", term)
            .orWhereILike("body_en", term)
            .orWhereILike("body_sw", term));
        }
      })
      .orderBy("category")
      .orderBy("title_en")
      .limit(100);
    res.json({ data: rows.map(guideRecord) });
  } catch (error) {
    next(error);
  }
});

export const adminManagementRouter = Router();

adminManagementRouter.get("/users", ...adminOnly, async (req, res, next) => {
  try {
    const search = z.string().trim().max(120).default("").parse(req.query.search);
    const role = z.enum(userRoles).optional().parse(req.query.role);
    const rows = await db("users")
      .select("id", "name", "email", "role", "phone", "location_region", "is_active", "created_at")
      .modify((builder) => {
        if (role) builder.where({ role });
        if (search) builder.andWhere((match) => match
          .whereILike("name", `%${search}%`)
          .orWhereILike("email", `%${search}%`)
          .orWhereILike("location_region", `%${search}%`));
      })
      .orderBy("created_at", "desc")
      .limit(200);
    res.json({ data: rows.map((row: DbRecord) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      phone: row.phone,
      locationRegion: row.location_region,
      isActive: row.is_active,
      createdAt: row.created_at,
    })) });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.patch("/users/:userId", ...adminOnly, async (req, res, next) => {
  try {
    const userId = z.string().uuid().parse(req.params.userId);
    const input = z.object({
      role: z.enum(["farmer", "agrovet", "expert"]).optional(),
      isActive: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0, "Change a role or account status.").parse(req.body);
    const actingAdminId = req.auth!.userId;
    if (userId === actingAdminId) throw new AppError(400, "SELF_MANAGEMENT_FORBIDDEN", "You cannot change your own account access.");
    const target = await db("users").where({ id: userId }).first("id", "role", "is_active");
    if (!target) throw new AppError(404, "USER_NOT_FOUND", "This account was not found.");
    if (target.role === "admin") throw new AppError(403, "ADMIN_ACCOUNT_PROTECTED", "Administrator accounts cannot be changed here.");
    const [updated] = await db("users")
      .where({ id: userId })
      .update({
        ...(input.role ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
        auth_version: db.raw("auth_version + 1"),
      })
      .returning(["id", "name", "email", "role", "phone", "location_region", "is_active", "created_at"]);
    res.json({ data: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      phone: updated.phone,
      locationRegion: updated.location_region,
      isActive: updated.is_active,
      createdAt: updated.created_at,
    } });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.get("/guides", ...adminOnly, async (_req, res, next) => {
  try {
    const rows = await db("knowledge_guides").orderBy("updated_at", "desc").limit(200);
    res.json({ data: rows.map(guideRecord) });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.post("/guides", ...adminOnly, async (req, res, next) => {
  try {
    const input = guideInputSchema.parse(req.body);
    const [row] = await db("knowledge_guides").insert({
      slug: input.slug,
      category: input.category,
      title_en: input.titleEn,
      title_sw: input.titleSw,
      summary_en: input.summaryEn,
      summary_sw: input.summarySw,
      body_en: input.bodyEn,
      body_sw: input.bodySw,
      is_published: input.isPublished,
      created_by: req.auth!.userId,
    }).returning("*");
    res.status(201).json({ data: guideRecord(row) });
  } catch (error) {
    next(isUniqueViolation(error)
      ? new AppError(409, "GUIDE_SLUG_IN_USE", "A guide already uses this slug.")
      : error);
  }
});

adminManagementRouter.patch("/guides/:guideId", ...adminOnly, async (req, res, next) => {
  try {
    const guideId = z.string().uuid().parse(req.params.guideId);
    const input = guideInputSchema.partial().refine((value) => Object.keys(value).length > 0, "Update at least one guide field.").parse(req.body);
    const [row] = await db("knowledge_guides")
      .where({ id: guideId })
      .update({
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.titleEn !== undefined ? { title_en: input.titleEn } : {}),
        ...(input.titleSw !== undefined ? { title_sw: input.titleSw } : {}),
        ...(input.summaryEn !== undefined ? { summary_en: input.summaryEn } : {}),
        ...(input.summarySw !== undefined ? { summary_sw: input.summarySw } : {}),
        ...(input.bodyEn !== undefined ? { body_en: input.bodyEn } : {}),
        ...(input.bodySw !== undefined ? { body_sw: input.bodySw } : {}),
        ...(input.isPublished !== undefined ? { is_published: input.isPublished } : {}),
        updated_at: db.fn.now(),
      })
      .returning("*");
    if (!row) throw new AppError(404, "GUIDE_NOT_FOUND", "This guide was not found.");
    res.json({ data: guideRecord(row) });
  } catch (error) {
    next(isUniqueViolation(error)
      ? new AppError(409, "GUIDE_SLUG_IN_USE", "A guide already uses this slug.")
      : error);
  }
});

adminManagementRouter.get("/cases", ...adminOnly, async (req, res, next) => {
  try {
    const status = z.enum(caseStatuses).optional().parse(req.query.status);
    const search = z.string().trim().max(120).default("").parse(req.query.search);
    const rows = await db("crop_cases as cases")
      .join("users as farmer", "cases.farmer_id", "farmer.id")
      .select(
        "cases.id", "cases.reference", "cases.farmer_id", "cases.case_type", "cases.subject_name",
        "cases.crop_type", "cases.symptoms",
        "cases.status", "cases.created_at", "cases.updated_at", "farmer.name as farmer_name",
        "farmer.email as farmer_email", "farmer.location_region as farmer_region",
      )
      .modify((builder) => {
        if (status) builder.where("cases.status", status);
        if (search) builder.andWhere((match) => match
          .whereILike("cases.reference", `%${search}%`)
          .orWhereILike("cases.subject_name", `%${search}%`)
          .orWhereILike("cases.crop_type", `%${search}%`)
          .orWhereILike("cases.case_type", `%${search}%`)
          .orWhereILike("cases.symptoms", `%${search}%`)
          .orWhereILike("farmer.name", `%${search}%`));
      })
      .orderBy("cases.updated_at", "desc")
      .limit(200);
    res.json({ data: rows.map((row: DbRecord) => ({
      id: row.id,
      reference: row.reference,
      farmerId: row.farmer_id,
      farmerName: row.farmer_name,
      farmerEmail: row.farmer_email,
      farmerRegion: row.farmer_region,
      caseType: row.case_type,
      subjectName: row.subject_name,
      cropType: row.crop_type,
      symptoms: row.symptoms,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.patch("/cases/:caseId/status", ...adminOnly, async (req, res, next) => {
  try {
    const caseId = z.string().uuid().parse(req.params.caseId);
    const input = z.object({
      status: z.enum(caseStatuses),
      notes: z.string().trim().max(500).default(""),
    }).parse(req.body);
    const result = await db.transaction(async (trx) => {
      const current = await trx("crop_cases").where({ id: caseId }).forUpdate().first("id", "farmer_id", "status");
      if (!current) throw new AppError(404, "CASE_NOT_FOUND", "This crop report was not found.");
      if (current.status === input.status && !input.notes) return current;
      const [updated] = await trx("crop_cases").where({ id: caseId }).update({
        status: input.status,
        updated_at: trx.fn.now(),
      }).returning(["id", "farmer_id", "status"]);
      await trx("crop_case_events").insert({
        case_id: caseId,
        farmer_id: current.farmer_id,
        event_type: "status_change",
        notes: `Status updated by the Shamba Link admin team to ${input.status.replaceAll("_", " ")}.${input.notes ? ` ${input.notes}` : ""}`,
      });
      return updated;
    });
    res.json({ data: { id: result.id, status: result.status } });
  } catch (error) {
    next(error);
  }
});
