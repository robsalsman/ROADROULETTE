import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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

const missions: Mission[] = [
  {
    id: 1,
    title: "Bolivian Death Road",
    location: "Bolivia",
    terrain: "mountain",
    description: "Thin air, thinner roads, and a cliff edge that appears to be personally offended by cars.",
    budget: 1500,
    difficulty: "hard",
  },
  {
    id: 2,
    title: "Botswana Salt Pan",
    location: "Botswana",
    terrain: "desert",
    description: "Cross the pans with too little shade, too much dust, and an unreasonable faith in old machinery.",
    budget: 1400,
    difficulty: "medium",
  },
  {
    id: 3,
    title: "Vietnam Coastal Dash",
    location: "Vietnam",
    terrain: "coastal",
    description: "A long, damp, beautiful run where the weather and the traffic both have strong opinions.",
    budget: 1200,
    difficulty: "medium",
  },
  {
    id: 4,
    title: "Patagonia Border Sprint",
    location: "Patagonia",
    terrain: "gravel",
    description: "Wind, gravel, suspicious paperwork, and the looming sense that everything is about to become diplomatic.",
    budget: 1700,
    difficulty: "insane",
  },
];

const cars: Car[] = [
  { id: 1, missionId: 1, name: "Range Rover Classic", year: 1989, price: 900, reliability: 5, power: 6, offRoad: 9, description: "Magnificent when working. A decorative shed when not." },
  { id: 2, missionId: 1, name: "Toyota Land Cruiser", year: 1994, price: 1150, reliability: 9, power: 5, offRoad: 8, description: "Not glamorous, because arriving is apparently considered important." },
  { id: 3, missionId: 1, name: "Subaru Legacy Estate", year: 1998, price: 650, reliability: 7, power: 5, offRoad: 5, description: "All-wheel-drive common sense with a boot full of optimism." },
  { id: 4, missionId: 2, name: "Mercedes 230E", year: 1985, price: 700, reliability: 8, power: 4, offRoad: 3, description: "A taxi in evening wear. Slow, but deeply unwilling to die." },
  { id: 5, missionId: 2, name: "Opel Kadett", year: 1976, price: 500, reliability: 6, power: 3, offRoad: 4, description: "Small, simple, and worryingly endearing." },
  { id: 6, missionId: 2, name: "Lancia Beta Coupe", year: 1981, price: 450, reliability: 2, power: 6, offRoad: 2, description: "Stylish in the way a lit match is stylish near petrol." },
  { id: 7, missionId: 3, name: "Honda Cub", year: 1992, price: 300, reliability: 10, power: 1, offRoad: 4, description: "Barely a car, but annoyingly perfect at existing." },
  { id: 8, missionId: 3, name: "Mitsubishi Pajero Mini", year: 1996, price: 800, reliability: 7, power: 4, offRoad: 7, description: "A tiny box of determination with actual four-wheel drive." },
  { id: 9, missionId: 3, name: "Ford Laser", year: 1997, price: 550, reliability: 6, power: 4, offRoad: 3, description: "Transport. Not a compliment, not an insult." },
  { id: 10, missionId: 4, name: "Porsche 928", year: 1983, price: 1200, reliability: 4, power: 9, offRoad: 1, description: "Completely wrong for gravel, therefore extremely tempting." },
  { id: 11, missionId: 4, name: "Volvo 240 Estate", year: 1990, price: 650, reliability: 8, power: 3, offRoad: 4, description: "A brick with seats. This is praise." },
  { id: 12, missionId: 4, name: "Jeep Cherokee", year: 1995, price: 950, reliability: 6, power: 6, offRoad: 8, description: "Built for places where roads are more of a rumour." },
];

const challenges: Challenge[] = [
  { id: 1, missionId: 1, title: "Cliff Edge Overtake", type: "skill", description: "Pass a lorry on a ledge while everyone pretends this was in the plan." },
  { id: 2, missionId: 2, title: "Salt Pan Speed Run", type: "race", description: "Go flat out across the white nothing and hope the white nothing stays solid." },
  { id: 3, missionId: 3, title: "Monsoon Time Trial", type: "survival", description: "Beat the rain, the traffic, and the deeply suspicious bridge." },
  { id: 4, missionId: 4, title: "Border Dash", type: "drag", description: "A final sprint over gravel with the paperwork catching up behind you." },
];

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
