import { describe, expect, it } from "vitest";
import { weatherAlerts } from "./weather-alerts.js";

describe("weather alerts", () => {
  it("prompts drainage checks when rain probability reaches the alert threshold", () => {
    expect(weatherAlerts({ rainProbability: 60, precipitationMm: 0, maximumC: 25, maximumHumidity: 50 }))
      .toContain("Rain is likely; check drainage and avoid unnecessary watering.");
  });

  it("prompts scouting for humid, wet conditions without naming a disease", () => {
    const alerts = weatherAlerts({ rainProbability: 40, precipitationMm: 1, maximumC: 25, maximumHumidity: 80 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain("may favor some crop diseases");
  });

  it("prompts a moisture check for hot and dry conditions", () => {
    expect(weatherAlerts({ rainProbability: 0, precipitationMm: 0, maximumC: 34, maximumHumidity: null }))
      .toContain("Hot, dry conditions are forecast; check soil moisture and young plants.");
  });

  it("does not raise a risk alert for mild conditions", () => {
    expect(weatherAlerts({ rainProbability: 15, precipitationMm: 0, maximumC: 26, maximumHumidity: 65 }))
      .toEqual([]);
  });
});
