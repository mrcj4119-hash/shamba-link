import { describe, expect, it } from "vitest";
import { explainNutrients, explainSoilPh } from "./soil-guidance.js";

describe("soil guidance", () => {
  it("explains acidic pH without prescribing an amendment", () => {
    const text = explainSoilPh(5.2, "maize");
    expect(text).toContain("acidic");
    expect(text).toContain("maize");
    expect(text).toContain("before considering amendments");
  });

  it("keeps the broad pH interpretation qualified by the crop and soil", () => {
    expect(explainSoilPh(6.5, "beans")).toContain("Compare it with the target for beans and your soil type");
  });

  it("does not infer nutrient deficiency without results", () => {
    expect(explainNutrients("tomato", false, "")).toContain("No N/P/K lab results recorded");
  });

  it("requires units and local crop targets to interpret nutrient values", () => {
    expect(explainNutrients("maize", true, "mg/kg")).toContain("local maize target");
    expect(explainNutrients("maize", true, "mg/kg")).toContain("mg/kg");
  });
});
