import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ECONOMY, vehiclePrice } from "@workspace/economy";

export type GarageUpgrades = Record<string, number>;
export type GarageTuning = {
  launchRpm: number;
  shiftRpm: number;
  gearing: number;
  tireSetup: number;
  suspension: number;
  downforce: number;
  tirePressure: number;
  nitrousShots: number;
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

function storePathForDriver(driverName?: string | null): string {
  const basePath = path.resolve(process.cwd(), "..", "..", ".local");
  if (!driverName) return path.join(basePath, "road-roulette-garage-store.json");
  const key = driverName
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40);
  return path.join(basePath, `road-roulette-garage-store-${key || "driver"}.json`);
}

export const defaultGarageTuning: GarageTuning = {
  launchRpm: 4200,
  shiftRpm: 6400,
  gearing: 50,
  tireSetup: 50,
  suspension: 50,
  downforce: 35,
  tirePressure: 32,
  nitrousShots: 0,
};

function now(): string {
  return new Date().toISOString();
}

function emptyStore(driverName?: string | null): Store {
  const createdAt = now();
  return {
    nextVehicleId: 1,
    nextRaceId: 1,
    profile: {
      id: 1,
      name: driverName ?? "Road Roulette Driver",
      credits: ECONOMY.defaultProfileCredits,
      createdAt,
      updatedAt: createdAt,
    },
    vehicles: [],
    raceHistory: [],
  };
}

function loadStore(driverName?: string | null): Store {
  try {
    const storePath = storePathForDriver(driverName);
    if (!existsSync(storePath)) return emptyStore(driverName);
    const store = { ...emptyStore(driverName), ...JSON.parse(readFileSync(storePath, "utf8")) } as Store;
    if (store.profile.credits > 0 && store.profile.credits < 10_000) {
      store.profile = { ...store.profile, credits: store.profile.credits * ECONOMY.dragRewardMultiplier };
    }
    if (driverName && store.profile.name !== driverName) {
      store.profile = { ...store.profile, name: driverName, updatedAt: now() };
    }
    return store;
  } catch {
    return emptyStore(driverName);
  }
}

function saveStore(store: Store, driverName?: string | null): void {
  const storePath = storePathForDriver(driverName);
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function normalizeVehicle(vehicle: GarageVehicle): GarageVehicle {
  const normalizedPrice = vehiclePrice({
    name: vehicle.name,
    reliability: vehicle.reliability,
    power: vehicle.power,
    offRoad: vehicle.offRoad,
  });
  return {
    ...vehicle,
    purchasePrice: vehicle.purchasePrice < 2_000 ? normalizedPrice : vehicle.purchasePrice,
    upgradeSpend: vehicle.purchasePrice < 2_000 && vehicle.upgradeSpend > 0 && vehicle.upgradeSpend < 3_000
      ? vehicle.upgradeSpend * ECONOMY.dragRewardMultiplier
      : vehicle.upgradeSpend,
    isActive: Boolean(vehicle.isActive),
    upgrades: vehicle.upgrades ?? {},
    tuning: { ...defaultGarageTuning, ...(vehicle.tuning ?? {}) },
  };
}

export function localGarageStoreFor(driverName?: string | null) {
  return {
  profile: () => loadStore(driverName).profile,
  garage: () => {
    const store = loadStore(driverName);
    return {
      profile: store.profile,
      vehicles: store.vehicles.map(normalizeVehicle),
      raceHistory: store.raceHistory,
    };
  },
  buyVehicle: (input: BuyVehicleInput) => {
    const store = loadStore(driverName);
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
    saveStore(store, driverName);
    return { alreadyOwned: false, vehicle, profile: store.profile };
  },
  upsertVehicle: (input: BuyVehicleInput) => {
    const store = loadStore(driverName);
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
    saveStore(store, driverName);
    return vehicle;
  },
  setActive: (canonicalVehicleKey: string) => {
    const store = loadStore(driverName);
    store.vehicles = store.vehicles.map((vehicle) => ({ ...vehicle, isActive: vehicle.canonicalVehicleKey === canonicalVehicleKey }));
    saveStore(store, driverName);
    return store.vehicles.find((vehicle) => vehicle.canonicalVehicleKey === canonicalVehicleKey);
  },
  patchVehicle: (canonicalVehicleKey: string, patch: Partial<Pick<GarageVehicle, "paintColor" | "condition" | "upgrades" | "upgradeSpend" | "tuning">>) => {
    const store = loadStore(driverName);
    let updated: GarageVehicle | undefined;
    store.vehicles = store.vehicles.map((vehicle) => {
      if (vehicle.canonicalVehicleKey !== canonicalVehicleKey) return vehicle;
      updated = normalizeVehicle({ ...vehicle, ...patch, updatedAt: now() });
      return updated;
    });
    saveStore(store, driverName);
    return updated;
  },
  changeCredits: (delta: number) => {
    const store = loadStore(driverName);
    store.profile = { ...store.profile, credits: Math.max(0, store.profile.credits + delta), updatedAt: now() };
    saveStore(store, driverName);
    return store.profile;
  },
  sellVehicle: (canonicalVehicleKey: string, saleCredits: number) => {
    const store = loadStore(driverName);
    const vehicle = store.vehicles.find((item) => item.canonicalVehicleKey === canonicalVehicleKey);
    if (!vehicle) return undefined;
    store.vehicles = store.vehicles.filter((item) => item.canonicalVehicleKey !== canonicalVehicleKey);
    if (vehicle.isActive && store.vehicles[0]) store.vehicles[0].isActive = true;
    store.profile = { ...store.profile, credits: store.profile.credits + saleCredits, updatedAt: now() };
    saveStore(store, driverName);
    return { vehicle, profile: store.profile };
  },
  repairVehicle: (canonicalVehicleKey: string, cost: number) => {
    const store = loadStore(driverName);
    if (store.profile.credits < cost) return { error: "Not enough credits" as const, profile: store.profile };
    let updated: GarageVehicle | undefined;
    store.vehicles = store.vehicles.map((vehicle) => {
      if (vehicle.canonicalVehicleKey !== canonicalVehicleKey) return vehicle;
      updated = normalizeVehicle({ ...vehicle, condition: 100, updatedAt: now() });
      return updated;
    });
    if (!updated) return undefined;
    store.profile = { ...store.profile, credits: store.profile.credits - cost, updatedAt: now() };
    saveStore(store, driverName);
    return { vehicle: updated, profile: store.profile };
  },
  recordRace: (entry: Omit<GarageRaceHistory, "id" | "profileId" | "createdAt">) => {
    const store = loadStore(driverName);
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
    saveStore(store, driverName);
    return { race, profile: store.profile };
  },
  };
}

export const localGarageStore = localGarageStoreFor();
