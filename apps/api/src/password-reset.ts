import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "./config/env.js";

export function createPasswordResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  if (!isPasswordResetEmailConfigured()) {
    throw new Error("Password reset email is not configured.");
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });
  const resetUrl = new URL("/reset-password", env.WEB_ORIGIN);
  resetUrl.searchParams.set("token", token);
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Reset your Shamba Link password",
    text: `Use this link within 30 minutes to reset your Shamba Link password:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use the link below within 30 minutes to reset your Shamba Link password.</p><p><a href="${resetUrl.toString()}">Reset your Shamba Link password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}
