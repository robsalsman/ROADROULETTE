import { GRAND_TOUR_EPISODE_STAGES } from "@/data/grand-tour-episode-stages";

export type PlayerStyle = "balanced" | "navigator" | "mechanic" | "charmer" | "daredevil";
export type PlayerStat = "navigation" | "mechanical" | "charm" | "confidence" | "endurance" | "luck";
export type InventoryCategory = "tool" | "supply" | "permit" | "special" | "souvenir";
export type BadgeCategory = "campaign" | "trivia" | "driving" | "garage" | "inventory" | "survival";

export interface PlayerCharacter {
  saveId: number;
  name: string;
  style: PlayerStyle;
  level: number;
  xp: number;
  unspentPoints: number;
  stats: Record<PlayerStat, number>;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  qty: number;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  description: string;
  effect: string;
}

export interface Badge {
  id: string;
  name: string;
  category: BadgeCategory;
  description: string;
  unlockedAt?: string;
  progress: number;
  target: number;
}

export interface CampaignState {
  saveId: number;
  journeyHours: number;
  currentDay: number;
  completedEpisodes: number[];
  triviaAnswered: string[];
  drivingChallengesCompleted: number;
  discoveredLocations: string[];
  updatedAt: string;
}

const characterKey = (saveId: string | number) => `tgrr-character-${saveId}`;
const inventoryKey = (saveId: string | number) => `tgrr-inventory-${saveId}`;
const badgesKey = (saveId: string | number) => `tgrr-badges-${saveId}`;
const campaignKey = (saveId: string | number) => `tgrr-campaign-${saveId}`;

export const PLAYER_STYLES: Record<PlayerStyle, { label: string; description: string; stats: Record<PlayerStat, number> }> = {
  balanced: {
    label: "All-Rounder",
    description: "Useful at most things, suspiciously bad at none.",
    stats: { navigation: 5, mechanical: 5, charm: 5, confidence: 5, endurance: 5, luck: 5 },
  },
  navigator: {
    label: "Navigator",
    description: "Finds shortcuts, avoids wrong turns, and still gets blamed.",
    stats: { navigation: 8, mechanical: 4, charm: 5, confidence: 5, endurance: 5, luck: 4 },
  },
  mechanic: {
    label: "Mechanic",
    description: "Can fix most breakdowns with wire, swearing, and optimism.",
    stats: { navigation: 4, mechanical: 8, charm: 4, confidence: 5, endurance: 5, luck: 4 },
  },
  charmer: {
    label: "Smooth Talker",
    description: "Better with locals, border guards, and deeply suspicious sellers.",
    stats: { navigation: 5, mechanical: 4, charm: 8, confidence: 5, endurance: 4, luck: 4 },
  },
  daredevil: {
    label: "Daredevil",
    description: "Makes risky ideas work more often than they deserve to.",
    stats: { navigation: 4, mechanical: 4, charm: 4, confidence: 8, endurance: 5, luck: 5 },
  },
};

export const STARTER_ITEMS: InventoryItem[] = [
  {
    id: "duct-tape",
    name: "Industrial Duct Tape",
    category: "tool",
    qty: 2,
    rarity: "common",
    description: "A roll of silver optimism.",
    effect: "Can reduce minor breakdown penalties.",
  },
  {
    id: "tow-rope",
    name: "Tow Rope",
    category: "tool",
    qty: 1,
    rarity: "uncommon",
    description: "For dragging a wounded car, or a wounded ego.",
    effect: "Unlocks safer recovery choices in mud, snow, and sand.",
  },
  {
    id: "phrasebook",
    name: "Questionable Phrasebook",
    category: "special",
    qty: 1,
    rarity: "common",
    description: "Half the useful phrases are about petrol, apologies, and livestock.",
    effect: "Improves some local interaction outcomes.",
  },
  {
    id: "jerrycan",
    name: "Empty Jerrycan",
    category: "supply",
    qty: 1,
    rarity: "common",
    description: "Currently empty, emotionally important.",
    effect: "Can be filled at shops or lucky fuel events.",
  },
];

export const BADGE_DEFS: Badge[] = [
  { id: "first-stage", name: "Leaving The Tent", category: "campaign", description: "Complete your first campaign episode.", progress: 0, target: 1 },
  { id: "trivia-five", name: "Pub Bore", category: "trivia", description: "Answer 5 trivia questions correctly.", progress: 0, target: 5 },
  { id: "trivia-vehicle", name: "Spec Sheet Scholar", category: "trivia", description: "Answer 10 vehicle-fact questions.", progress: 0, target: 10 },
  { id: "challenge-five", name: "Actually Driving", category: "driving", description: "Complete 5 driving challenges.", progress: 0, target: 5 },
  { id: "collector-five", name: "Rust Collector", category: "garage", description: "Own 5 cars in a series garage.", progress: 0, target: 5 },
  { id: "rare-item", name: "Found Something Weird", category: "inventory", description: "Acquire a rare or legendary item.", progress: 0, target: 1 },
  { id: "survive-low-condition", name: "Held Together By Hope", category: "survival", description: "Finish a leg with a car below 20% condition.", progress: 0, target: 1 },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createPlayerCharacter(saveId: string | number, name: string, style: PlayerStyle): PlayerCharacter {
  const template = PLAYER_STYLES[style] ?? PLAYER_STYLES.balanced;
  const character: PlayerCharacter = {
    saveId: Number(saveId),
    name,
    style,
    level: 1,
    xp: 0,
    unspentPoints: 0,
    stats: template.stats,
    createdAt: new Date().toISOString(),
  };
  writeJson(characterKey(saveId), character);
  return character;
}

export function loadPlayerCharacter(saveId: string | number | null | undefined, fallbackName = "The New Bloke"): PlayerCharacter | null {
  if (saveId == null) return null;
  const raw = localStorage.getItem(characterKey(saveId));
  if (!raw) return createPlayerCharacter(saveId, fallbackName, "balanced");
  try {
    return JSON.parse(raw) as PlayerCharacter;
  } catch {
    return createPlayerCharacter(saveId, fallbackName, "balanced");
  }
}

export function savePlayerCharacter(character: PlayerCharacter): void {
  writeJson(characterKey(character.saveId), character);
}

export function addPlayerXp(saveId: string | number, amount: number, fallbackName?: string): PlayerCharacter {
  const character = loadPlayerCharacter(saveId, fallbackName) ?? createPlayerCharacter(saveId, fallbackName ?? "The New Bloke", "balanced");
  const nextXp = character.xp + amount;
  const nextLevel = Math.max(character.level, Math.floor(nextXp / 250) + 1);
  const gained = nextLevel - character.level;
  const next = {
    ...character,
    xp: nextXp,
    level: nextLevel,
    unspentPoints: character.unspentPoints + gained,
  };
  savePlayerCharacter(next);
  return next;
}

export function upgradePlayerStat(saveId: string | number, stat: PlayerStat, fallbackName?: string): PlayerCharacter {
  const character = loadPlayerCharacter(saveId, fallbackName) ?? createPlayerCharacter(saveId, fallbackName ?? "The New Bloke", "balanced");
  if (character.unspentPoints <= 0 || character.stats[stat] >= 10) return character;
  const next = {
    ...character,
    unspentPoints: character.unspentPoints - 1,
    stats: { ...character.stats, [stat]: character.stats[stat] + 1 },
  };
  savePlayerCharacter(next);
  return next;
}

export function loadInventory(saveId: string | number | null | undefined): InventoryItem[] {
  if (saveId == null) return [];
  try {
    const raw = localStorage.getItem(inventoryKey(saveId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveInventory(saveId: string | number, items: InventoryItem[]): void {
  writeJson(inventoryKey(saveId), items);
}

export function ensureStarterInventory(saveId: string | number): InventoryItem[] {
  const existing = loadInventory(saveId);
  if (existing.length > 0) return existing;
  saveInventory(saveId, STARTER_ITEMS);
  return STARTER_ITEMS;
}

export function loadBadges(saveId: string | number | null | undefined): Badge[] {
  if (saveId == null) return BADGE_DEFS;
  const saved = readJson<{ badges: Badge[] }>(badgesKey(saveId), { badges: BADGE_DEFS }).badges;
  const savedById = new Map(saved.map((badge) => [badge.id, badge]));
  return BADGE_DEFS.map((def) => ({ ...def, ...(savedById.get(def.id) ?? {}) }));
}

export function saveBadges(saveId: string | number, badges: Badge[]): void {
  writeJson(badgesKey(saveId), { badges });
}

export function loadCampaignState(saveId: string | number | null | undefined): CampaignState | null {
  if (saveId == null) return null;
  const key = campaignKey(saveId);
  if (!localStorage.getItem(key)) return null;
  return readJson<CampaignState>(campaignKey(saveId), {
    saveId: Number(saveId),
    journeyHours: 0,
    currentDay: 1,
    completedEpisodes: [],
    triviaAnswered: [],
    drivingChallengesCompleted: 0,
    discoveredLocations: [],
    updatedAt: new Date().toISOString(),
  });
}

export function saveCampaignState(state: CampaignState): void {
  writeJson(campaignKey(state.saveId), { ...state, updatedAt: new Date().toISOString() });
}

export function ensureCampaignState(saveId: string | number): CampaignState {
  const state = loadCampaignState(saveId);
  if (state) return state;
  const next = {
    saveId: Number(saveId),
    journeyHours: 0,
    currentDay: 1,
    completedEpisodes: [],
    triviaAnswered: [],
    drivingChallengesCompleted: 0,
    discoveredLocations: [GRAND_TOUR_EPISODE_STAGES[0]?.locationTheme ?? "Opening stage"],
    updatedAt: new Date().toISOString(),
  };
  saveCampaignState(next);
  return next;
}

export function initializeCampaignSave(saveId: string | number, name: string, style: PlayerStyle): void {
  createPlayerCharacter(saveId, name, style);
  ensureStarterInventory(saveId);
  saveBadges(saveId, BADGE_DEFS);
  ensureCampaignState(saveId);
}
