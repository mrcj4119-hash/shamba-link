import { z } from "zod";
import { env } from "./config/env.js";

const resultSchema = z.object({
  detectedDisease: z.string().min(1).max(300),
  confidenceScore: z.number().min(0).max(1),
  severityLevel: z.enum(["low", "moderate", "high", "critical", "unknown"]),
  treatmentRecommendations: z.string().min(1).max(5000),
  preventiveMeasures: z.string().min(1).max(5000),
  requiresExpertReview: z.boolean(),
});

export type DiagnosticResult = z.infer<typeof resultSchema>;

export async function diagnose(
  image: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  subject: "crop" | "livestock",
): Promise<DiagnosticResult> {
  if (!env.AI_API_URL) {
    return {
      detectedDisease: "Demo mode — expert assessment recommended",
      confidenceScore: 0,
      severityLevel: "unknown",
      treatmentRecommendations: "An AI provider is not configured. Share this image with a verified agricultural expert before applying any treatment.",
      preventiveMeasures: "Keep the affected plant or animal under observation. Avoid unverified chemical treatments and book an expert consultation.",
      requiresExpertReview: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(env.AI_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(env.AI_API_KEY ? { authorization: `Bearer ${env.AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        imageBase64: image.toString("base64"),
        contentType: mimeType,
        subject,
      }),
    });
    if (!response.ok) {
      throw new Error(`Diagnostic provider returned HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    return resultSchema.parse(payload);
  } finally {
    clearTimeout(timeout);
  }
}
