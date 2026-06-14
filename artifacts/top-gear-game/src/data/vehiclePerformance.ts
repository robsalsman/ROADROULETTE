import { canonicalVehicleKey } from "@/data/vehicles";
import { repairCost, saleValue } from "@workspace/economy";
import type { OwnedVehicle } from "@/services/garageApi";
import type { Upgrades } from "@/data/garage";

export type Drivetrain = "FWD" | "RWD" | "AWD" | "4x4" | "Boat" | "Other";

export type VehiclePerformance = {
  canonicalVehicleKey: string;
  horsepower: number;
  weight: number;
  drivetrain: Drivetrain;
  traction: number;
  tier: "Local" | "Club" | "Pro" | "Supercar" | "Chaos";
  valueCredits: number;
};

function nameDrivenOverrides(name: string): Partial<VehiclePerformance> {
  const n = name.toLowerCase();
  if (/p1|laferrari|918|chiron|veyron|rimac|vulcan|aventador|huracan|mclaren|ford gt|superleggera|bohema|ep9/.test(n)) {
    return { horsepower: 720, weight: 3350, drivetrain: /rimac|918|chiron|veyron|ep9|p1/i.test(name) ? "AWD" : "RWD", tier: "Supercar" };
  }
  if (/mustang|camaro|charger|challenger|corvette|viper|hellcat|demon|gt500|ssr/.test(n)) {
    return { horsepower: 470, weight: 3850, drivetrain: "RWD", tier: "Pro" };
  }
  if (/impreza|lancer|quattro|rs4|focus rs|raptor|range rover|land rover|jeep|4x4|buggy|nomad|john/.test(n)) {
    return { drivetrain: /buggy|nomad/.test(n) ? "RWD" : "4x4", tier: "Club" };
  }
  if (/boat|pbr|cruiser|scarab|amphibious|spey|bond bug/.test(n)) {
    return { horsepower: 310, weight: 5200, drivetrain: "Boat", tier: "Chaos" };
  }
  if (/rv|pace arrow|tropi-cal|harvester|van|voyager|berlingo|scenic/.test(n)) {
    return { horsepower: 180, weight: 6200, drivetrain: "Other", tier: "Chaos" };
  }
  return {};
}

export function deriveVehiclePerformance(
  vehicle: Pick<OwnedVehicle, "canonicalVehicleKey" | "name" | "power" | "offRoad" | "reliability" | "purchasePrice" | "condition">,
  upgrades: Upgrades = {},
): VehiclePerformance {
  const key = vehicle.canonicalVehicleKey || canonicalVehicleKey(vehicle.name);
  const override = nameDrivenOverrides(vehicle.name);
  const hp = override.horsepower ?? Math.round(85 + vehicle.power * 52 + (upgrades.engine ?? 0) * 68 + (upgrades.fuel ?? 0) * 22);
  const weight = override.weight ?? Math.max(1650, Math.round(2850 + vehicle.offRoad * 130 - vehicle.power * 35 - (upgrades.bodywork ?? 0) * 90));
  const drivetrain = override.drivetrain ?? (/porsche|audi|subaru|mitsubishi|range rover|land rover|jeep|ford focus/i.test(vehicle.name) ? "AWD" : vehicle.power > 7 ? "RWD" : "FWD");
  const tractionBase = vehicle.reliability * 0.38 + vehicle.offRoad * 0.28 + (upgrades.tyres ?? 0) * 1.35 + (upgrades.suspension ?? 0) * 0.85;
  const drivetrainBonus = drivetrain === "AWD" || drivetrain === "4x4" ? 1.1 : drivetrain === "FWD" ? 0.35 : drivetrain === "Boat" ? -1.4 : 0;
  const traction = Math.max(1, Math.min(10, tractionBase + drivetrainBonus - Math.max(0, 100 - vehicle.condition) / 35));
  const powerToWeight = hp / weight;
  const tier = override.tier ?? (powerToWeight > 0.18 ? "Supercar" : powerToWeight > 0.13 ? "Pro" : powerToWeight > 0.09 ? "Club" : "Local");
  const valueCredits = Math.max(100, Math.round(vehicle.purchasePrice * 1.15 + hp * 0.9 + traction * 22));
  return { canonicalVehicleKey: key, horsepower: hp, weight, drivetrain, traction: Math.round(traction * 10) / 10, tier, valueCredits };
}

export function repairCostForVehicle(vehicle: Pick<OwnedVehicle, "condition" | "power">): number {
  return repairCost(vehicle.condition, vehicle.power);
}

export function saleValueForVehicle(vehicle: Pick<OwnedVehicle, "purchasePrice" | "upgradeSpend" | "condition">): number {
  return saleValue(vehicle.purchasePrice, vehicle.upgradeSpend, vehicle.condition);
}
