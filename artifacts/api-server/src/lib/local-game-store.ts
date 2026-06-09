import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GRAND_TOUR_EPISODE_STAGES } from "../data/grand-tour-episode-stages";

type Character = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  personality: string;
  stats: { confidence: number; mechanical: number; navigation: number; budget: number };
};

type Mission = {
  id: number;
  title: string;
  location: string;
  terrain: string;
  description: string;
  budget: number;
  difficulty: "easy" | "medium" | "hard" | "insane";
};

type Car = {
  id: number;
  missionId: number;
  name: string;
  year: number;
  price: number;
  reliability: number;
  power: number;
  offRoad: number;
  description: string;
};

type Challenge = {
  id: number;
  missionId: number;
  title: string;
  type: "race" | "skill" | "survival" | "beauty" | "drag";
  description: string;
};

type Save = {
  id: number;
  characterId: number | null;
  missionId: number;
  status: "car_selection" | "on_road" | "challenge" | "completed" | "failed";
  mode: "arcade" | "series";
  playerName: string | null;
  seriesStageIndex: number;
  funds: number;
  carId: number | null;
  food: number;
  parts: number;
  camaraderie: number;
  distanceTravelled: number;
  score: number;
  createdAt: string;
  updatedAt: string;
};

type RoadEvent = {
  id: number;
  saveId: number;
  eventType: "breakdown" | "weather" | "police" | "shortcut" | "fuel" | "mechanical" | "wildlife" | "banter";
  title: string;
  description: string;
  outcome: string;
  fundsChange: number;
  createdAt: string;
};

type LeaderboardEntry = {
  id: number;
  saveId: number | null;
  playerName: string;
  characterSlug: string;
  missionTitle: string;
  score: number;
  distance: number;
  createdAt: string;
};

type Store = {
  nextSaveId: number;
  nextEventId: number;
  nextLeaderboardId: number;
  saves: Save[];
  events: RoadEvent[];
  leaderboard: LeaderboardEntry[];
};

const characters: Character[] = [
  {
    id: 1,
    slug: "jeremy",
    name: "Jeremy Clarkson",
    tagline: "Power, noise, and absolute certainty.",
    personality: "Bombastic, brave, impatient, and somehow usually facing the wrong way.",
    stats: { confidence: 10, mechanical: 3, navigation: 4, budget: 1800 },
  },
  {
    id: 2,
    slug: "richard",
    name: "Richard Hammond",
    tagline: "Optimism with a roll cage.",
    personality: "Cheerful, fearless, very attached to terrible muscle cars.",
    stats: { confidence: 8, mechanical: 6, navigation: 5, budget: 1600 },
  },
  {
    id: 3,
    slug: "james",
    name: "James May",
    tagline: "Measured, methodical, late.",
    personality: "Careful, mechanically sympathetic, and quietly competitive.",
    stats: { confidence: 6, mechanical: 9, navigation: 8, budget: 1500 },
  },
];

const missions: Mission[] = GRAND_TOUR_EPISODE_STAGES.map((episode) => ({
  id: episode.id,
  title: `E${episode.episodeNumber}: ${episode.title}`,
  location: episode.locationTheme,
  terrain: episode.terrain,
  description: `Series ${episode.series}, episode ${episode.episodeInSeries} (${episode.releaseDate}). ${episode.challengeInspiration}`,
  budget: 1500 + Math.min(800, episode.episodeNumber * 20),
  difficulty: episode.difficulty,
}));

function statFromName(name: string, salt: number, min = 2): number {
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), salt);
  return min + (total % (11 - min));
}

function displayYear(name: string, releaseDate: string): number {
  const match = name.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : Number(releaseDate.slice(0, 4));
}

const cars: Car[] = GRAND_TOUR_EPISODE_STAGES.flatMap((episode) =>
  episode.featuredVehicles.slice(0, 3).map((name, index) => ({
    id: episode.id * 10 + index + 1,
    missionId: episode.id,
    name,
    year: displayYear(name, episode.releaseDate),
    price: 450 + index * 180 + (episode.difficulty === "insane" ? 200 : episode.difficulty === "hard" ? 120 : 0),
    reliability: statFromName(name, 7 + index),
    power: statFromName(name, 19 + index),
    offRoad: episode.terrain === "desert" || episode.terrain === "jungle" || episode.terrain === "snow" ? statFromName(name, 31 + index, 3) : statFromName(name, 31 + index),
    description: `Featured in episode ${episode.episodeNumber}, ${episode.title}. Chosen for the ${episode.locationTheme} stage.`,
  }))
);

const challenges: Challenge[] = GRAND_TOUR_EPISODE_STAGES.map((episode) => ({
  id: episode.id,
  missionId: episode.id,
  title: episode.challengeInspiration.split(".")[0],
  type: episode.trialType,
  description: episode.challengeInspiration,
}));

const storePath = path.resolve(process.cwd(), "..", "..", ".local", "road-roulette-game-store.json");

function emptyStore(): Store {
  return { nextSaveId: 1, nextEventId: 1, nextLeaderboardId: 1, saves: [], events: [], leaderboard: [] };
}

function loadStore(): Store {
  try {
    if (!existsSync(storePath)) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(readFileSync(storePath, "utf8")) } as Store;
  } catch {
    return emptyStore();
  }
}

function saveStore(store: Store): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export const localGameStore = {
  characters: () => characters,
  character: (id: number) => characters.find((character) => character.id === id),
  missions: () => missions,
  mission: (id: number) => missions.find((mission) => mission.id === id),
  missionDetail: (id: number) => {
    const mission = missions.find((item) => item.id === id);
    if (!mission) return undefined;
    return {
      ...mission,
      availableCars: cars.filter((car) => car.missionId === id).map(({ missionId: _missionId, ...car }) => car),
      challenges: challenges.filter((challenge) => challenge.missionId === id).map(({ missionId: _missionId, ...challenge }) => challenge),
    };
  },
  saves: () => loadStore().saves.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
  createSave: (input: { characterId?: number | null; missionId: number; mode?: "arcade" | "series"; playerName?: string | null; seriesStageIndex?: number }) => {
    const store = loadStore();
    const now = new Date().toISOString();
    const character = input.characterId == null ? undefined : characters.find((item) => item.id === input.characterId);
    const save: Save = {
      id: store.nextSaveId++,
      characterId: input.characterId ?? null,
      missionId: input.missionId,
      status: "car_selection",
      mode: input.mode ?? "arcade",
      playerName: input.playerName ?? null,
      seriesStageIndex: input.seriesStageIndex ?? 0,
      funds: character?.stats.budget ?? 1500,
      carId: null,
      food: 3,
      parts: 2,
      camaraderie: 0,
      distanceTravelled: 0,
      score: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.saves.push(save);
    saveStore(store);
    return save;
  },
  save: (id: number) => loadStore().saves.find((save) => save.id === id),
  updateSave: (id: number, patch: Partial<Omit<Save, "id" | "createdAt" | "updatedAt">>) => {
    const store = loadStore();
    const index = store.saves.findIndex((save) => save.id === id);
    if (index < 0) return undefined;
    store.saves[index] = { ...store.saves[index], ...patch, updatedAt: new Date().toISOString() };
    saveStore(store);
    return store.saves[index];
  },
  deleteSave: (id: number) => {
    const store = loadStore();
    store.saves = store.saves.filter((save) => save.id !== id);
    store.events = store.events.filter((event) => event.saveId !== id);
    saveStore(store);
  },
  events: (saveId: number) => loadStore().events.filter((event) => event.saveId === saveId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  recordEvent: (saveId: number, input: Omit<RoadEvent, "id" | "saveId" | "createdAt">) => {
    const store = loadStore();
    const event: RoadEvent = { id: store.nextEventId++, saveId, ...input, createdAt: new Date().toISOString() };
    store.events.push(event);
    saveStore(store);
    return event;
  },
  leaderboard: (limit: number) =>
    loadStore().leaderboard.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
  addLeaderboardEntry: (input: { saveId: number; playerName: string; characterSlug: string; missionTitle: string }) => {
    const store = loadStore();
    const save = store.saves.find((item) => item.id === input.saveId);
    if (!save) return undefined;
    const character = save.characterId == null ? undefined : characters.find((item) => item.id === save.characterId);
    const mission = missions.find((item) => item.id === save.missionId);
    const entry: LeaderboardEntry = {
      id: store.nextLeaderboardId++,
      saveId: save.id,
      playerName: input.playerName.slice(0, 40),
      characterSlug: character?.slug ?? input.characterSlug,
      missionTitle: mission?.title ?? input.missionTitle,
      score: save.score,
      distance: save.distanceTravelled,
      createdAt: new Date().toISOString(),
    };
    store.leaderboard.push(entry);
    saveStore(store);
    return entry;
  },
};
