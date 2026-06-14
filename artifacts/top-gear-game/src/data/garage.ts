import { recordGarageCount } from "@/data/campaign";

export type UpgradeCat = "engine" | "suspension" | "fuel" | "bodywork" | "tyres" | "sponsor" | "charm";
export type UpgradeTier = 1 | 2 | 3;
export type Upgrades = Partial<Record<UpgradeCat, UpgradeTier>>;

export interface GarageCar {
  id: number;
  missionId: number;
  name: string;
  year: number;
  price: number;
  reliability: number;
  power: number;
  offRoad: number;
  description: string;
  purchasedAt: number;
  paintColor?: string;
}

export interface GarageState {
  activeCarId: number | null;
  cars: GarageCar[];
}

export const garageKey = (saveId: string | number) => `tgrr-garage-${saveId}`;
export const upgradeKey = (saveId: string | number, carId: string | number) => `tgrr-upgrades-${saveId}-car-${carId}`;

export function normalizeGarage(garage: GarageState): GarageState {
  const carsById = new Map<number, GarageCar>();
  for (const car of garage.cars) carsById.set(car.id, { ...carsById.get(car.id), ...car });
  const cars = [...carsById.values()].sort((a, b) => a.purchasedAt - b.purchasedAt);
  const activeCarId = garage.activeCarId != null && cars.some((car) => car.id === garage.activeCarId)
    ? garage.activeCarId
    : cars[0]?.id ?? null;
  return { activeCarId, cars };
}

export function loadGarage(saveId: string | number): GarageState {
  try {
    const raw = localStorage.getItem(garageKey(saveId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.cars)) {
        return normalizeGarage({
          activeCarId: typeof parsed.activeCarId === "number" ? parsed.activeCarId : null,
          cars: parsed.cars,
        });
      }
    }
  } catch { /* ignore */ }
  return { activeCarId: null, cars: [] };
}

export function saveGarage(saveId: string | number, garage: GarageState): void {
  const normalized = normalizeGarage(garage);
  localStorage.setItem(garageKey(saveId), JSON.stringify(normalized));
  recordGarageCount(saveId, normalized.cars.length);
}

export function updateGarageCar(saveId: string | number, carId: number, patch: Partial<GarageCar>): GarageState {
  const garage = loadGarage(saveId);
  const nextGarage = normalizeGarage({
    ...garage,
    cars: garage.cars.map((car) => (car.id === carId ? { ...car, ...patch } : car)),
  });
  saveGarage(saveId, nextGarage);
  return nextGarage;
}

export function removeGarageCar(saveId: string | number, carId: number): GarageState {
  const garage = loadGarage(saveId);
  const nextGarage = normalizeGarage({
    activeCarId: garage.activeCarId === carId ? null : garage.activeCarId,
    cars: garage.cars.filter((car) => car.id !== carId),
  });
  saveGarage(saveId, nextGarage);
  return nextGarage;
}

export function loadUpgrades(saveId: string | number, carId: string | number | null | undefined): Upgrades {
  if (carId == null) return {};
  try {
    const raw = localStorage.getItem(upgradeKey(saveId, carId));
    if (raw) return JSON.parse(raw).upgrades ?? {};
  } catch { /* ignore */ }
  return {};
}

export function saveUpgrades(saveId: string | number, carId: string | number, upgrades: Upgrades, spent: number): void {
  localStorage.setItem(upgradeKey(saveId, carId), JSON.stringify({ upgrades, spent }));
}

export function loadUpgradeSpend(saveId: string | number, carId: string | number | null | undefined): number {
  if (carId == null) return 0;
  try {
    const raw = localStorage.getItem(upgradeKey(saveId, carId));
    if (raw) return JSON.parse(raw).spent ?? 0;
  } catch { /* ignore */ }
  return 0;
}

export function adjustedCarStats(car: Pick<GarageCar, "reliability" | "power" | "offRoad">, upgrades: Upgrades) {
  const reliability = Number.isFinite(car.reliability) ? car.reliability : 6;
  const power = Number.isFinite(car.power) ? car.power : 5;
  const offRoad = Number.isFinite(car.offRoad) ? car.offRoad : 5;
  return {
    reliability: Math.min(10, reliability + (upgrades.bodywork ?? 0) + Math.floor((upgrades.fuel ?? 0) / 2)),
    power: Math.min(10, power + (upgrades.engine ?? 0) * 2),
    offRoad: Math.min(10, offRoad + (upgrades.suspension ?? 0) + (upgrades.tyres ?? 0)),
  };
}

export function sellValue(car: Pick<GarageCar, "price">, upgradeSpend: number): number {
  return Math.max(500, Math.floor(car.price * 0.65 + upgradeSpend * 0.35));
}
