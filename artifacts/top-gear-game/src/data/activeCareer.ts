import {
  addPlayerXp,
  loadBadges,
  loadCampaignState,
  loadInventory,
  loadPlayerCharacter,
  updateBadgeProgress,
  type Badge,
  type CampaignState,
  type InventoryItem,
  type PlayerCharacter,
} from "@/data/campaign";
import type { GarageRaceHistory, GarageResponse } from "@/services/garageApi";

export type CareerSaveLike = {
  id: number;
  mode: string;
  status: string;
  missionId: number;
  playerName?: string | null;
  seriesStageIndex?: number | null;
  funds: number;
  carId?: number | null;
  updatedAt: string;
};

export type CareerDragStats = {
  races: number;
  wins: number;
  winnings: number;
  bestEt: number | null;
  lastOpponent: string | null;
  lastResultAt: string | null;
};

export type ActiveCareer = {
  save: CareerSaveLike;
  character: PlayerCharacter;
  campaignState: CampaignState | null;
  inventory: InventoryItem[];
  badges: Badge[];
  garage: GarageResponse | undefined;
  dragStats: CareerDragStats;
};

const careerDragStatsKey = (saveId: string | number) => `tgrr-career-drag-stats-${saveId}`;

export function latestActiveSeriesSave(saves: CareerSaveLike[] | undefined): CareerSaveLike | undefined {
  const seriesSaves = [...(saves ?? [])].filter((save) => save.mode === "series");
  const active = seriesSaves.filter((save) => save.status !== "completed" && save.status !== "failed");
  return [...(active.length > 0 ? active : seriesSaves)]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

export function continueHrefForCareer(save: CareerSaveLike | undefined): string {
  if (!save) return "/series-start";
  if (save.status === "car_selection" || !save.carId) return `/mission/${save.missionId}?saveId=${save.id}&series=1`;
  if (save.status === "completed" || save.status === "failed") return `/results/${save.id}`;
  return `/game/${save.id}`;
}

export function loadCareerDragStats(saveId: string | number | null | undefined): CareerDragStats {
  const fallback: CareerDragStats = {
    races: 0,
    wins: 0,
    winnings: 0,
    bestEt: null,
    lastOpponent: null,
    lastResultAt: null,
  };
  if (saveId == null) return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(careerDragStatsKey(saveId)) ?? "{}") as Partial<CareerDragStats>;
    return {
      races: Number.isFinite(parsed.races) ? parsed.races ?? 0 : 0,
      wins: Number.isFinite(parsed.wins) ? parsed.wins ?? 0 : 0,
      winnings: Number.isFinite(parsed.winnings) ? parsed.winnings ?? 0 : 0,
      bestEt: typeof parsed.bestEt === "number" ? parsed.bestEt : null,
      lastOpponent: typeof parsed.lastOpponent === "string" ? parsed.lastOpponent : null,
      lastResultAt: typeof parsed.lastResultAt === "string" ? parsed.lastResultAt : null,
    };
  } catch {
    return fallback;
  }
}

export function resolveActiveCareer(saves: CareerSaveLike[] | undefined, garage?: GarageResponse): ActiveCareer | null {
  const save = latestActiveSeriesSave(saves);
  if (!save) return null;
  const character = loadPlayerCharacter(save.id, save.playerName ?? "The New Bloke");
  if (!character) return null;
  return {
    save,
    character,
    campaignState: loadCampaignState(save.id),
    inventory: loadInventory(save.id),
    badges: loadBadges(save.id),
    garage,
    dragStats: loadCareerDragStats(save.id),
  };
}

export function recordCareerDragRace(save: CareerSaveLike | undefined, race: Pick<GarageRaceHistory, "won" | "rewardCredits" | "elapsedMs" | "opponentName"> & { xpBonus?: number }): CareerDragStats | null {
  if (!save) return null;
  const current = loadCareerDragStats(save.id);
  const next: CareerDragStats = {
    races: current.races + 1,
    wins: current.wins + (race.won ? 1 : 0),
    winnings: current.winnings + race.rewardCredits,
    bestEt: race.elapsedMs > 0 ? Math.min(current.bestEt ?? race.elapsedMs, race.elapsedMs) : current.bestEt,
    lastOpponent: race.opponentName,
    lastResultAt: new Date().toISOString(),
  };
  localStorage.setItem(careerDragStatsKey(save.id), JSON.stringify(next));

  addPlayerXp(save.id, (race.won ? 35 : 15) + (race.xpBonus ?? 0), save.playerName ?? undefined);
  updateBadgeProgress(save.id, "drag-racer", next.races);
  updateBadgeProgress(save.id, "drag-winner", next.wins);

  return next;
}
