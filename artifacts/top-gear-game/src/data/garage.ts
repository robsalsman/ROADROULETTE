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

export function loadGarage(saveId: string | number): GarageState {
  try {
    const raw = localStorage.getItem(garageKey(saveId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.cars)) {
        return {
          activeCarId: typeof parsed.activeCarId === "number" ? parsed.activeCarId : null,
          cars: parsed.cars,
        };
      }
    }
  } catch { /* ignore */ }
  return { activeCarId: null, cars: [] };
}

export function saveGarage(saveId: string | number, garage: GarageState): void {
  localStorage.setItem(garageKey(saveId), JSON.stringify(garage));
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
  return {
    reliability: Math.min(10, car.reliability + (upgrades.bodywork ?? 0) + Math.floor((upgrades.fuel ?? 0) / 2)),
    power: Math.min(10, car.power + (upgrades.engine ?? 0) * 2),
    offRoad: Math.min(10, car.offRoad + (upgrades.suspension ?? 0) + (upgrades.tyres ?? 0)),
  };
}

export function sellValue(car: Pick<GarageCar, "price">, upgradeSpend: number): number {
  return Math.max(50, Math.floor(car.price * 0.65 + upgradeSpend * 0.35));
}
