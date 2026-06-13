import { canonicalVehicleKey } from "@/data/vehicles";
import type { GarageCar, Upgrades } from "@/data/garage";

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

export type OwnedVehicle = {
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
  upgrades: Upgrades;
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

export type GarageResponse = {
  profile: GarageProfile;
  vehicles: OwnedVehicle[];
  raceHistory: GarageRaceHistory[];
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

export const defaultGarageTuning: GarageTuning = {
  launchRpm: 4200,
  shiftRpm: 6400,
  gearing: 50,
  tireSetup: 50,
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data as T;
}

export function carToBuyInput(car: Pick<GarageCar, "id" | "missionId" | "name" | "year" | "price" | "reliability" | "power" | "offRoad" | "description">): BuyVehicleInput {
  return {
    canonicalVehicleKey: canonicalVehicleKey(car.name),
    sourceCarId: car.id,
    sourceMissionId: car.missionId,
    name: car.name,
    year: car.year,
    price: car.price,
    reliability: car.reliability,
    power: car.power,
    offRoad: car.offRoad,
    description: car.description,
  };
}

export function ownedToGarageCar(vehicle: OwnedVehicle): GarageCar {
  return {
    id: vehicle.sourceCarId ?? vehicle.id,
    missionId: vehicle.sourceMissionId ?? 0,
    name: vehicle.name,
    year: vehicle.year,
    price: vehicle.purchasePrice,
    reliability: vehicle.reliability,
    power: vehicle.power,
    offRoad: vehicle.offRoad,
    description: vehicle.description,
    purchasedAt: new Date(vehicle.acquiredAt).getTime(),
    paintColor: vehicle.paintColor ?? undefined,
  };
}

export const garageApi = {
  getGarage: () => jsonFetch<GarageResponse>("/api/garage"),
  migrateGarage: (vehicles: BuyVehicleInput[]) => jsonFetch<GarageResponse>("/api/garage/migrate", {
    method: "POST",
    body: JSON.stringify({ vehicles }),
  }),
  buyVehicle: (vehicle: BuyVehicleInput) => jsonFetch<{ alreadyOwned: boolean; vehicle: OwnedVehicle; profile: GarageProfile }>("/api/garage/vehicles/buy", {
    method: "POST",
    body: JSON.stringify(vehicle),
  }),
  setActive: (canonicalKey: string) => jsonFetch<{ vehicle: OwnedVehicle; garage: GarageResponse }>(`/api/garage/vehicles/${encodeURIComponent(canonicalKey)}/active`, {
    method: "PATCH",
    body: JSON.stringify({}),
  }),
  patchVehicle: (canonicalKey: string, patch: { paintColor?: string | null; condition?: number }) =>
    jsonFetch<{ vehicle: OwnedVehicle; garage: GarageResponse }>(`/api/garage/vehicles/${encodeURIComponent(canonicalKey)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  saveUpgrades: (canonicalKey: string, upgrades: Upgrades, spent: number, creditsDelta = 0) =>
    jsonFetch<{ profile: GarageProfile; vehicle: OwnedVehicle; garage: GarageResponse }>(`/api/garage/vehicles/${encodeURIComponent(canonicalKey)}/upgrades`, {
      method: "PATCH",
      body: JSON.stringify({ upgrades, spent, creditsDelta }),
    }),
  saveTuning: (canonicalKey: string, tuning: GarageTuning, creditsDelta = 0) =>
    jsonFetch<{ profile: GarageProfile; vehicle: OwnedVehicle; garage: GarageResponse }>(`/api/garage/vehicles/${encodeURIComponent(canonicalKey)}/tuning`, {
      method: "PATCH",
      body: JSON.stringify({ tuning, creditsDelta }),
    }),
  completeDragRace: (result: {
    canonicalVehicleKey: string;
    opponentKey: string;
    opponentName: string;
    elapsedMs: number;
    opponentElapsedMs: number;
    trapSpeed: number;
    won: boolean;
    rewardCredits: number;
    breakdown: unknown;
  }) => jsonFetch<{ profile: GarageProfile; race: GarageRaceHistory; garage: GarageResponse }>("/api/garage/drag-race/complete", {
    method: "POST",
    body: JSON.stringify(result),
  }),
};
