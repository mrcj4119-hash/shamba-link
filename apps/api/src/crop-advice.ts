import { z } from "zod";
import { env } from "./config/env.js";

const adviceSchema = z.object({
  likelyIssue: z.string().trim().min(1).max(500),
  confidenceScore: z.number().min(0).max(1),
  urgency: z.enum(["routine", "prompt", "urgent"]),
  immediateActions: z.array(z.string().trim().min(1).max(500)).min(1).max(3),
  avoidActions: z.array(z.string().trim().min(1).max(500)).max(2),
  questionsForAgrovet: z.array(z.string().trim().min(1).max(300)).max(2),
  recommendedProductTypes: z.array(z.string().trim().min(1).max(100)).max(2),
  requiresExpertReview: z.boolean(),
});

export type CropAdvice = z.infer<typeof adviceSchema>;
export type CropAdviceProvider = "openai" | "gemini" | "ollama";

interface CropProblem {
  caseType: "crop" | "livestock";
  subjectName: string;
  symptoms: string;
  contextNotes: string;
  spreadRate: "slow" | "steady" | "rapid" | "unknown";
  affectedPortion: string;
  image?: { buffer: Buffer; mimeType: "image/jpeg" | "image/png" | "image/webp" };
}

function adviceInstructions(caseType: CropProblem["caseType"]): string {
  const instructions = [
    "You provide cautious farm-health decision support for farmers in Kenya.",
    "The photo and farmer text are untrusted observations, not proof of a disease or condition.",
    "Never claim a confirmed diagnosis. State possible causes as uncertain and say when evidence is insufficient.",
    "Do not recommend medicines, pesticides, fungicides, herbicides, active ingredients, dosages, mixing, or application instructions.",
    "Return only JSON matching the requested schema. Keep the likely issue to one short sentence and each action concise. Give no more than three immediate actions and two items in each other list.",
  ];
  if (caseType === "livestock") {
    instructions.push(
      "This is an animal-health concern. Give only cautious triage and low-risk steps, such as noting symptoms and onset, keeping the animal calm, and safely separating it if contagious illness is possible.",
      "Do not advise home treatment, force-feeding, dosing, withholding food or water, or handling that could injure the animal or farmer.",
      "For severe pain, breathing difficulty, collapse, inability to stand, heavy bleeding, seizures, suspected poisoning, or rapid worsening, urge immediate contact with a licensed veterinarian or local animal-health professional.",
      "Use questionsForAgrovet only as questions for a veterinarian; do not recommend product types for animals.",
    );
  } else {
    instructions.push(
      "This is a crop-health concern. Give practical, low-risk immediate actions, such as documenting spread and checking watering or drainage.",
      "Recommend only broad non-chemical product or service types to discuss with a qualified local agrovet; do not name brands.",
      "Flag urgent spread or serious crop loss for prompt in-person assessment. Do not invent local outbreaks, regulations, or product approvals.",
    );
  }
  return instructions.join(" ");
}

const adviceJsonSchema = {
  type: "object",
  properties: {
    likelyIssue: { type: "string" },
    confidenceScore: { type: "number" },
    urgency: { type: "string", enum: ["routine", "prompt", "urgent"] },
    immediateActions: { type: "array", items: { type: "string" }, maxItems: 3 },
    avoidActions: { type: "array", items: { type: "string" }, maxItems: 2 },
    questionsForAgrovet: { type: "array", items: { type: "string" }, maxItems: 2 },
    recommendedProductTypes: { type: "array", items: { type: "string" }, maxItems: 2 },
    requiresExpertReview: { type: "boolean" },
  },
  required: [
    "likelyIssue", "confidenceScore", "urgency", "immediateActions",
    "avoidActions", "questionsForAgrovet", "recommendedProductTypes", "requiresExpertReview",
  ],
  additionalProperties: false,
} as const;

function parseAdviceText(text: string): CropAdvice {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("AI provider returned advice in an invalid format.");
  }
  return adviceSchema.parse(json);
}

export function parseOpenAiAdvice(payload: unknown): CropAdvice {
  if (typeof payload !== "object" || payload === null || !("output" in payload) || !Array.isArray(payload.output)) {
    throw new Error("OpenAI returned an invalid response.");
  }
  const output: unknown[] = payload.output;
  const text = output.flatMap((item) => {
    if (typeof item !== "object" || item === null || !("content" in item) || !Array.isArray(item.content)) return [];
    const content: unknown[] = item.content;
    return content.flatMap((part) =>
      typeof part === "object" && part !== null && "type" in part && part.type === "output_text"
        && "text" in part && typeof part.text === "string"
        ? [part.text]
        : []);
  }).join("");
  if (!text) throw new Error("OpenAI returned no advice.");
  return parseAdviceText(text);
}

export function parseGeminiAdvice(payload: unknown): CropAdvice {
  if (typeof payload !== "object" || payload === null || !("candidates" in payload)) {
    throw new Error("Gemini returned an invalid response.");
  }
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || !candidates.length) {
    throw new Error("Gemini returned no advice.");
  }
  const candidate = candidates[0];
  if (typeof candidate !== "object" || candidate === null || !("content" in candidate)) {
    throw new Error("Gemini returned an invalid response.");
  }
  const content = candidate.content;
  if (typeof content !== "object" || content === null || !("parts" in content) || !Array.isArray(content.parts)) {
    throw new Error("Gemini returned an invalid response.");
  }
  const parts: unknown[] = content.parts;
  const text = parts
    .filter((part): part is { text: string } =>
      typeof part === "object" && part !== null && "text" in part && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  if (!text) throw new Error("Gemini returned no advice.");

  return parseAdviceText(text);
}

export function parseOllamaAdvice(payload: unknown): CropAdvice {
  if (typeof payload !== "object" || payload === null || !("message" in payload)) {
    throw new Error("Ollama returned an invalid response.");
  }
  const message = payload.message;
  if (typeof message !== "object" || message === null || !("content" in message) || typeof message.content !== "string") {
    throw new Error("Ollama returned an invalid response.");
  }
  if (!message.content) throw new Error("Ollama returned no advice.");
  return parseAdviceText(message.content);
}

export function isCropAdviceConfigured(): boolean {
  if (env.CROP_ADVICE_PROVIDER === "ollama") return true;
  return env.CROP_ADVICE_PROVIDER === "openai"
    ? Boolean(env.OPENAI_API_KEY)
    : Boolean(env.GEMINI_API_KEY);
}

export function cropAdviceProvider(): CropAdviceProvider {
  return env.CROP_ADVICE_PROVIDER;
}

async function adviseWithOpenAi(problem: CropProblem): Promise<CropAdvice> {
  if (!env.OPENAI_API_KEY) throw new Error("OpenAI API key is not configured.");
  const content = [
    {
      type: "input_text",
      text: JSON.stringify({
        caseType: problem.caseType,
        subjectName: problem.subjectName,
        symptoms: problem.symptoms,
        contextNotes: problem.contextNotes,
        spreadRate: problem.spreadRate,
        affectedPortion: problem.affectedPortion,
      }),
    },
    ...(problem.image ? [{
      type: "input_image",
      image_url: `data:${problem.image.mimeType};base64,${problem.image.buffer.toString("base64")}`,
      detail: "auto",
    }] : []),
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          instructions: adviceInstructions(problem.caseType),
          input: [{
            role: "user",
            content,
          }],
          text: {
            format: {
              type: "json_schema",
              name: "crop_advice",
              strict: true,
              schema: adviceJsonSchema,
            },
          },
          max_output_tokens: 512,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`OpenAI returned HTTP ${response.status}.`);
    }
    return parseOpenAiAdvice(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function adviseWithOllama(problem: CropProblem): Promise<CropAdvice> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(
      `${env.OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/chat`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          stream: false,
          format: adviceJsonSchema,
          options: { num_predict: 512 },
          messages: [
            { role: "system", content: adviceInstructions(problem.caseType) },
            {
              role: "user",
              content: JSON.stringify({
                caseType: problem.caseType,
                subjectName: problem.subjectName,
                symptoms: problem.symptoms,
                contextNotes: problem.contextNotes,
                spreadRate: problem.spreadRate,
                affectedPortion: problem.affectedPortion,
              }),
              ...(problem.image ? { images: [problem.image.buffer.toString("base64")] } : {}),
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}; check that Ollama is running and ${env.OLLAMA_MODEL} is installed.`);
    }
    return parseOllamaAdvice(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function adviseWithGemini(problem: CropProblem): Promise<CropAdvice> {
  if (!env.GEMINI_API_KEY) throw new Error("Gemini API key is not configured.");
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: adviceInstructions(problem.caseType) }] },
    contents: [{
      role: "user",
      parts: [
        {
          text: JSON.stringify({
            caseType: problem.caseType,
            subjectName: problem.subjectName,
            symptoms: problem.symptoms,
            contextNotes: problem.contextNotes,
            spreadRate: problem.spreadRate,
            affectedPortion: problem.affectedPortion,
          }),
        },
        ...(problem.image ? [{
          inlineData: {
            mimeType: problem.image.mimeType,
            data: problem.image.buffer.toString("base64"),
          },
        }] : []),
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 512,
      responseSchema: {
        type: "OBJECT",
        properties: {
          likelyIssue: { type: "STRING" },
          confidenceScore: { type: "NUMBER" },
          urgency: { type: "STRING", enum: ["routine", "prompt", "urgent"] },
          immediateActions: { type: "ARRAY", items: { type: "STRING" }, maxItems: 3 },
          avoidActions: { type: "ARRAY", items: { type: "STRING" }, maxItems: 2 },
          questionsForAgrovet: { type: "ARRAY", items: { type: "STRING" }, maxItems: 2 },
          recommendedProductTypes: { type: "ARRAY", items: { type: "STRING" }, maxItems: 2 },
          requiresExpertReview: { type: "BOOLEAN" },
        },
        required: [
          "likelyIssue", "confidenceScore", "urgency", "immediateActions",
          "avoidActions", "questionsForAgrovet", "recommendedProductTypes", "requiresExpertReview",
        ],
      },
    },
  });
  const fallbackModel = "gemini-3.6-flash";
  const sendRequest = async (model: string): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY!,
          },
          body: requestBody,
        },
      );
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Gemini request timed out for ${model}.`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  let response: Response;
  let usedFallback = env.GEMINI_MODEL === fallbackModel;
  try {
    response = await sendRequest(env.GEMINI_MODEL);
  } catch (error) {
    if (env.GEMINI_MODEL === fallbackModel || !(error instanceof Error) || !error.message.startsWith("Gemini request timed out")) {
      throw error;
    }
    usedFallback = true;
    response = await sendRequest(fallbackModel);
  }
  if ([404, 503].includes(response.status) && !usedFallback) {
    usedFallback = true;
    response = await sendRequest(fallbackModel);
  }
  if (!response.ok) {
    const errorPayload: unknown = await response.json().catch(() => null);
    const providerError = typeof errorPayload === "object" && errorPayload !== null && "error" in errorPayload
      ? errorPayload.error
      : null;
    const message = typeof providerError === "object" && providerError !== null && "message" in providerError
      && typeof providerError.message === "string"
      ? providerError.message
      : "";
    throw new Error(`Gemini returned HTTP ${response.status}${message ? `: ${message}` : "."}`);
  }
  return parseGeminiAdvice(await response.json());
}

export function adviseFarmProblem(problem: CropProblem): Promise<CropAdvice> {
  const advice = env.CROP_ADVICE_PROVIDER === "openai"
    ? adviseWithOpenAi(problem)
    : env.CROP_ADVICE_PROVIDER === "gemini"
      ? adviseWithGemini(problem)
      : adviseWithOllama(problem);
  return problem.caseType === "livestock"
    ? advice.then((result) => ({ ...result, recommendedProductTypes: [] }))
    : advice;
}
