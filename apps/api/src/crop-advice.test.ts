import { describe, expect, it } from "vitest";
import { parseGeminiAdvice, parseOllamaAdvice, parseOpenAiAdvice } from "./crop-advice.js";

const advice = {
  likelyIssue: "Leaf damage; the cause is uncertain.",
  confidenceScore: 0.42,
  urgency: "routine",
  immediateActions: ["Photograph the affected plants again in two days."],
  avoidActions: ["Do not mix or apply pesticides based on this assessment."],
  questionsForAgrovet: ["Can you inspect the crop before recommending a treatment?"],
  recommendedProductTypes: ["Crop diagnostic service"],
  requiresExpertReview: true,
} as const;

describe("parseGeminiAdvice", () => {
  it("validates structured advice from the Gemini response envelope", () => {
    expect(parseGeminiAdvice({
      candidates: [{ content: { parts: [{ text: JSON.stringify(advice) }] } }],
    })).toEqual(advice);
  });

  it("rejects malformed advice rather than returning unsafe partial guidance", () => {
    expect(() => parseGeminiAdvice({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ ...advice, confidenceScore: 2 }) }] } }],
    })).toThrow();
  });

  it("rejects advice that exceeds the concise response limits", () => {
    expect(() => parseGeminiAdvice({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        ...advice,
        immediateActions: ["One", "Two", "Three", "Four"],
      }) }] } }],
    })).toThrow();
  });

  it("rejects responses without a candidate", () => {
    expect(() => parseGeminiAdvice({ candidates: [] })).toThrow("Gemini returned no advice.");
  });

  it("validates structured advice from the OpenAI Responses API envelope", () => {
    expect(parseOpenAiAdvice({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(advice) }] }],
    })).toEqual(advice);
  });

  it("rejects OpenAI responses without structured output", () => {
    expect(() => parseOpenAiAdvice({ output: [{ content: [{ type: "refusal", refusal: "Not allowed." }] }] }))
      .toThrow("OpenAI returned no advice.");
  });

  it("validates structured advice from the Ollama chat response envelope", () => {
    expect(parseOllamaAdvice({
      message: { content: JSON.stringify(advice) },
    })).toEqual(advice);
  });

  it("rejects Ollama responses without structured output", () => {
    expect(() => parseOllamaAdvice({ message: { content: "" } }))
      .toThrow("Ollama returned no advice.");
  });
});
