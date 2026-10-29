import { describe, expect, it } from "vitest";
import { readFunZoneScores, recordFunZoneScore } from "./fun-zone-score";

function createStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  };
}

describe("Fun Zone score persistence", () => {
  it("records best scores and total plays per activity", () => {
    const storage = createStorage();
    const first = recordFunZoneScore(storage, "quiz", 3, new Date("2026-01-01T00:00:00Z"));
    const second = recordFunZoneScore(storage, "quiz", 2, new Date("2026-01-02T00:00:00Z"));
    recordFunZoneScore(storage, "memory", 6);

    expect(first.quiz).toMatchObject({ best: 3, totalPlays: 1 });
    expect(second.quiz).toMatchObject({ best: 3, totalPlays: 2, lastPlayed: "2026-01-02T00:00:00.000Z" });
    expect(readFunZoneScores(storage)).toMatchObject({
      quiz: { best: 3, totalPlays: 2 },
      memory: { best: 6, totalPlays: 1 },
    });
  });

  it("rejects malformed or invalid score records", () => {
    const storage = createStorage();
    expect(() => recordFunZoneScore(storage, "quiz", -1)).toThrow(RangeError);
    storage.setItem("shamba-fun-zone-scores-v1", "not-json");
    expect(() => readFunZoneScores(storage)).toThrow();
  });
});
