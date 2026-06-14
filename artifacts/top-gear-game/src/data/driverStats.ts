import { GRAND_TOUR_EPISODE_COUNT } from "@/data/grand-tour-episode-stages";
import { ALL_TRIVIA } from "@/data/trivia";

const standaloneTriviaKey = "tgrr-driver-standalone-trivia";

export type StandaloneTriviaStats = {
  correct: number;
  total: number;
  answeredIds: string[];
  winnings: number;
};

export function loadStandaloneTriviaStats(): StandaloneTriviaStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(standaloneTriviaKey) ?? "{}") as Partial<StandaloneTriviaStats>;
    return {
      correct: Number.isFinite(parsed.correct) ? parsed.correct ?? 0 : 0,
      total: Number.isFinite(parsed.total) ? parsed.total ?? 0 : 0,
      answeredIds: Array.isArray(parsed.answeredIds) ? parsed.answeredIds.filter((id): id is string => typeof id === "string") : [],
      winnings: Number.isFinite(parsed.winnings) ? parsed.winnings ?? 0 : 0,
    };
  } catch {
    return { correct: 0, total: 0, answeredIds: [], winnings: 0 };
  }
}

export function recordStandaloneTriviaResult(questionId: string, correct: boolean, rewardCredits: number): StandaloneTriviaStats {
  const current = loadStandaloneTriviaStats();
  const next: StandaloneTriviaStats = {
    correct: current.correct + (correct ? 1 : 0),
    total: current.total + 1,
    answeredIds: current.answeredIds.includes(questionId) ? current.answeredIds : [...current.answeredIds, questionId],
    winnings: current.winnings + (correct ? rewardCredits : 0),
  };
  localStorage.setItem(standaloneTriviaKey, JSON.stringify(next));
  return next;
}

export function standaloneTriviaCompletion(stats = loadStandaloneTriviaStats()): number {
  if (ALL_TRIVIA.length === 0) return 0;
  return Math.round((new Set(stats.answeredIds).size / ALL_TRIVIA.length) * 100);
}

export function campaignCompletionFromLocalStorage(): { completedEpisodes: number; percent: number } {
  const completed = new Set<number>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("tgrr-campaign-")) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "{}") as { completedEpisodes?: unknown };
      if (!Array.isArray(parsed.completedEpisodes)) continue;
      for (const episodeId of parsed.completedEpisodes) {
        if (typeof episodeId === "number") completed.add(episodeId);
      }
    } catch {
      // Ignore malformed local campaign entries.
    }
  }
  return {
    completedEpisodes: completed.size,
    percent: GRAND_TOUR_EPISODE_COUNT > 0 ? Math.round((completed.size / GRAND_TOUR_EPISODE_COUNT) * 100) : 0,
  };
}

export function arcadeCompletionPercent(saves: Array<{ mode: string; status: string; missionId: number }> | undefined): number {
  const completedArcadeMissions = new Set((saves ?? [])
    .filter((save) => save.mode === "arcade" && save.status === "completed")
    .map((save) => save.missionId));
  return GRAND_TOUR_EPISODE_COUNT > 0 ? Math.round((completedArcadeMissions.size / GRAND_TOUR_EPISODE_COUNT) * 100) : 0;
}
