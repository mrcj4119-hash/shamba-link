import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default("shamba-link"),
  JWT_AUDIENCE: z.string().default("shamba-link-web"),
  JWT_ACCESS_TTL: z.string().default("8h"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(16).default(12),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  AI_API_URL: z.string().url().optional().or(z.literal("")),
  AI_API_KEY: z.string().optional(),
  CROP_ADVICE_PROVIDER: z.enum(["openai", "gemini", "ollama"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.5-flash-lite"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().trim().min(1).default("qwen2.5vl:3b"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  UPLOAD_DIR: z.string().default("./uploads"),
  PHOTO_FEEDBACK_RECIPIENT_PHONE: z.string().trim().regex(/^0\d{9}$/).default("0704189723"),
  PAYMENT_REVIEWER_EMAILS: z.string().default(""),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().trim().email().optional(),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && (
    !value.CLOUDINARY_CLOUD_NAME ||
    !value.CLOUDINARY_API_KEY ||
    !value.CLOUDINARY_API_SECRET
  )) {
    context.addIssue({
      code: "custom",
      path: ["CLOUDINARY_CLOUD_NAME"],
      message: "Cloudinary credentials are required in production.",
    });
  }
  const smtpConfigured = Boolean(value.SMTP_HOST);
  if (smtpConfigured && !value.SMTP_FROM) {
    context.addIssue({ code: "custom", path: ["SMTP_FROM"], message: "SMTP_FROM is required when SMTP_HOST is configured." });
  }
  if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
    context.addIssue({ code: "custom", path: ["SMTP_PASSWORD"], message: "Configure both SMTP_USER and SMTP_PASSWORD, or neither." });
  }
  if (!smtpConfigured && (value.SMTP_FROM || value.SMTP_USER || value.SMTP_PASSWORD)) {
    context.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST is required to configure email delivery." });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
