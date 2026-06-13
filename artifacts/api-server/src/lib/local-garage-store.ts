import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type GarageUpgrades = Record<string, number>;
export type GarageTuning = {
  launchRpm: number;
  shiftRpm: number;
  gearing: number;
  tireSetup: number;
};

export type GarageProfile = {
  id: number;
  name: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
};

export type GarageVehicle = {
  id: number;
  profileId: number;
  canonicalVehicleKey: string;
  sourceCarId: number | null;
  sourceMissionId: number | null;
  name: string;
  year: number;
  purchasePrice: number;
  reliability: number;
  power: number;
  offRoad: number;
  description: string;
  condition: number;
  paintColor: string | null;
  isActive: boolean;
  upgrades: GarageUpgrades;
  upgradeSpend: number;
  tuning: GarageTuning;
  acquiredAt: string;
  updatedAt: string;
};

export type GarageRaceHistory = {
  id: number;
  profileId: number;
  ownedVehicleId: number | null;
  canonicalVehicleKey: string;
  opponentKey: string;
  opponentName: string;
  elapsedMs: number;
  opponentElapsedMs: number;
  trapSpeed: number;
  won: boolean;
  rewardCredits: number;
  breakdown: unknown;
  createdAt: string;
};

export type BuyVehicleInput = {
  canonicalVehicleKey: string;
  sourceCarId?: number | null;
  sourceMissionId?: number | null;
  name: string;
  year: number;
  price: number;
  reliability: number;
  power: number;
  offRoad: number;
  description: string;
};

type Store = {
  nextVehicleId: number;
  nextRaceId: number;
  profile: GarageProfile;
  vehicles: GarageVehicle[];
  raceHistory: GarageRaceHistory[];
};

const storePath = path.resolve(process.cwd(), "..", "..", ".local", "road-roulette-garage-store.json");

export const defaultGarageTuning: GarageTuning = {
  launchRpm: 4200,
  shiftRpm: 6400,
  gearing: 50,
  tireSetup: 50,
};

function now(): string {
  return new Date().toISOString();
}

function emptyStore(): Store {
  const createdAt = now();
  return {
    nextVehicleId: 1,
    nextRaceId: 1,
    profile: {
      id: 1,
      name: "Road Roulette Driver",
      credits: 1500,
      createdAt,
      updatedAt: createdAt,
    },
    vehicles: [],
    raceHistory: [],
  };
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

function normalizeVehicle(vehicle: GarageVehicle): GarageVehicle {
  return {
    ...vehicle,
    isActive: Boolean(vehicle.isActive),
    upgrades: vehicle.upgrades ?? {},
    tuning: { ...defaultGarageTuning, ...(vehicle.tuning ?? {}) },
  };
}

export const localGarageStore = {
  profile: () => loadStore().profile,
  garage: () => {
    const store = loadStore();
    return {
      profile: store.profile,
      vehicles: store.vehicles.map(normalizeVehicle),
      raceHistory: store.raceHistory,
    };
  },
  buyVehicle: (input: BuyVehicleInput) => {
    const store = loadStore();
    const existing = store.vehicles.find((vehicle) => vehicle.canonicalVehicleKey === input.canonicalVehicleKey);
    if (existing) return { alreadyOwned: true, vehicle: normalizeVehicle(existing), profile: store.profile };

    if (store.profile.credits < input.price) {
      return { error: "Not enough credits" as const, profile: store.profile };
    }

    const timestamp = now();
    store.vehicles = store.vehicles.map((vehicle) => ({ ...vehicle, isActive: false }));
    store.profile = { ...store.profile, credits: store.profile.credits - input.price, updatedAt: timestamp };
    const vehicle: GarageVehicle = {
      id: store.nextVehicleId++,
      profileId: store.profile.id,
      canonicalVehicleKey: input.canonicalVehicleKey,
      sourceCarId: input.sourceCarId ?? null,
      sourceMissionId: input.sourceMissionId ?? null,
      name: input.name,
      year: input.year,
      purchasePrice: input.price,
      reliability: input.reliability,
      power: input.power,
      offRoad: input.offRoad,
      description: input.description,
      condition: 100,
      paintColor: null,
      isActive: true,
      upgrades: {},
      upgradeSpend: 0,
      tuning: defaultGarageTuning,
      acquiredAt: timestamp,
      updatedAt: timestamp,
    };
    store.vehicles.push(vehicle);
    saveStore(store);
    return { alreadyOwned: false, vehicle, profile: store.profile };
  },
  upsertVehicle: (input: BuyVehicleInput) => {
    const store = loadStore();
    const existing = store.vehicles.find((vehicle) => vehicle.canonicalVehicleKey === input.canonicalVehicleKey);
    if (existing) return normalizeVehicle(existing);
    const timestamp = now();
    const vehicle: GarageVehicle = {
      id: store.nextVehicleId++,
      profileId: store.profile.id,
      canonicalVehicleKey: input.canonicalVehicleKey,
      sourceCarId: input.sourceCarId ?? null,
      sourceMissionId: input.sourceMissionId ?? null,
      name: input.name,
      year: input.year,
      purchasePrice: input.price,
      reliability: input.reliability,
      power: input.power,
      offRoad: input.offRoad,
      description: input.description,
      condition: 100,
      paintColor: null,
      isActive: store.vehicles.length === 0,
      upgrades: {},
      upgradeSpend: 0,
      tuning: defaultGarageTuning,
      acquiredAt: timestamp,
      updatedAt: timestamp,
    };
    store.vehicles.push(vehicle);
    saveStore(store);
    return vehicle;
  },
  setActive: (canonicalVehicleKey: string) => {
    const store = loadStore();
    store.vehicles = store.vehicles.map((vehicle) => ({ ...vehicle, isActive: vehicle.canonicalVehicleKey === canonicalVehicleKey }));
    saveStore(store);
    return store.vehicles.find((vehicle) => vehicle.canonicalVehicleKey === canonicalVehicleKey);
  },
  patchVehicle: (canonicalVehicleKey: string, patch: Partial<Pick<GarageVehicle, "paintColor" | "condition" | "upgrades" | "upgradeSpend" | "tuning">>) => {
    const store = loadStore();
    let updated: GarageVehicle | undefined;
    store.vehicles = store.vehicles.map((vehicle) => {
      if (vehicle.canonicalVehicleKey !== canonicalVehicleKey) return vehicle;
      updated = normalizeVehicle({ ...vehicle, ...patch, updatedAt: now() });
      return updated;
    });
    saveStore(store);
    return updated;
  },
  changeCredits: (delta: number) => {
    const store = loadStore();
    store.profile = { ...store.profile, credits: Math.max(0, store.profile.credits + delta), updatedAt: now() };
    saveStore(store);
    return store.profile;
  },
  recordRace: (entry: Omit<GarageRaceHistory, "id" | "profileId" | "createdAt">) => {
    const store = loadStore();
    const timestamp = now();
    const race: GarageRaceHistory = {
      ...entry,
      id: store.nextRaceId++,
      profileId: store.profile.id,
      createdAt: timestamp,
    };
    store.profile = { ...store.profile, credits: Math.max(0, store.profile.credits + entry.rewardCredits), updatedAt: timestamp };
    store.raceHistory.unshift(race);
    store.raceHistory = store.raceHistory.slice(0, 50);
    saveStore(store);
    return { race, profile: store.profile };
  },
};
