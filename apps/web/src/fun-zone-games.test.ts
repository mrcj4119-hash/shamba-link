import { describe, expect, it } from "vitest";
import { funZoneGames } from "./fun-zone-games";

describe("Fun Zone game catalog", () => {
  it("offers 20 distinct games across several play styles", () => {
    expect(funZoneGames).toHaveLength(20);
    expect(new Set(funZoneGames.map((game) => game.id)).size).toBe(20);
    expect(new Set(funZoneGames.map((game) => game.title)).size).toBe(20);
    expect(new Set(funZoneGames.map((game) => game.kind))).toEqual(new Set(["quiz", "memory", "scramble"]));
  });

  it("provides complete, answerable content for every game", () => {
    for (const game of funZoneGames) {
      expect(game.description.trim().length).toBeGreaterThan(0);
      if (game.kind === "quiz") {
        expect(game.questions.length).toBeGreaterThanOrEqual(3);
        for (const question of game.questions) {
          expect(question.options).toContain(question.answer);
          expect(question.options.length).toBeGreaterThanOrEqual(2);
          expect(question.explanation.trim().length).toBeGreaterThan(0);
        }
      } else if (game.kind === "memory") {
        expect(game.pairs.length).toBeGreaterThanOrEqual(3);
      } else {
        expect(game.words.length).toBeGreaterThanOrEqual(3);
        for (const word of game.words) {
          expect(word.word).toMatch(/^[A-Z]+$/);
          expect(word.clue.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});
