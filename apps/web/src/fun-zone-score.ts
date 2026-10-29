export type FunZoneActivity = "quiz" | "memory" | "scramble";

export interface FunZoneScore {
  best: number;
  totalPlays: number;
  lastPlayed: string;
}

export type FunZoneScores = Partial<Record<FunZoneActivity, FunZoneScore>>;

const storageKey = "shamba-fun-zone-scores-v1";

export function readFunZoneScores(storage: Pick<Storage, "getItem">): FunZoneScores {
  const stored = storage.getItem(storageKey);
  if (!stored) return {};
  const parsed: unknown = JSON.parse(stored);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Saved Fun Zone scores are invalid.");
  }
  const scores: FunZoneScores = {};
  for (const activity of ["quiz", "memory", "scramble"] as const) {
    const score = Reflect.get(parsed, activity) as unknown;
    if (score === undefined) continue;
    if (
      typeof score !== "object" || score === null ||
      typeof Reflect.get(score, "best") !== "number" ||
      !Number.isInteger(Reflect.get(score, "best")) ||
      typeof Reflect.get(score, "totalPlays") !== "number" ||
      !Number.isInteger(Reflect.get(score, "totalPlays")) ||
      typeof Reflect.get(score, "lastPlayed") !== "string"
    ) {
      throw new Error("Saved Fun Zone scores are invalid.");
    }
    scores[activity] = {
      best: Reflect.get(score, "best") as number,
      totalPlays: Reflect.get(score, "totalPlays") as number,
      lastPlayed: Reflect.get(score, "lastPlayed") as string,
    };
  }
  return scores;
}

export function recordFunZoneScore(
  storage: Pick<Storage, "getItem" | "setItem">,
  activity: FunZoneActivity,
  score: number,
  now: Date = new Date(),
): FunZoneScores {
  if (!Number.isInteger(score) || score < 0) throw new RangeError("Fun Zone scores must be non-negative integers.");
  const scores = readFunZoneScores(storage);
  const previous = scores[activity];
  scores[activity] = {
    best: Math.max(previous?.best ?? 0, score),
    totalPlays: (previous?.totalPlays ?? 0) + 1,
    lastPlayed: now.toISOString(),
  };
  storage.setItem(storageKey, JSON.stringify(scores));
  return scores;
}
