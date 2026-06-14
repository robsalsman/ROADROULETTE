import { canonicalVehicleKey } from "@/data/vehicles";
import { repairCost, saleValue } from "@workspace/economy";
import type { GarageTuning, OwnedVehicle } from "@/services/garageApi";
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

export type TuningProjection = {
  gripPct: number;
  aeroPct: number;
  gearingBias: string;
  horsepower: number;
  wheelHorsepower: number;
  torqueLbFt: number;
  topSpeedMph: number;
  zeroToSixty: number;
  quarterMile: number;
  launchGrip: number;
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
  const baseHp = override.horsepower ?? Math.round(85 + vehicle.power * 52);
  const hp = Math.round(baseHp + (upgrades.engine ?? 0) * 68 + (upgrades.turbo ?? 0) * 72 + (upgrades.supercharger ?? 0) * 64 + (upgrades.fuel ?? 0) * 22 + (upgrades.nitrous ?? 0) * 26);
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

export function tuningProjection(
  performance: VehiclePerformance,
  tuning: GarageTuning,
  condition: number,
): TuningProjection {
  const tirePressureGrip = Math.max(-0.12, Math.min(0.16, (34 - (tuning.tirePressure ?? 32)) / 50));
  const suspensionGrip = Math.max(-0.1, Math.min(0.12, (55 - Math.abs((tuning.suspension ?? 50) - 42)) / 500));
  const downforce = tuning.downforce ?? 35;
  const gearing = tuning.gearing ?? 50;
  const gripPct = Math.round((tirePressureGrip + suspensionGrip) * 100);
  const aeroPct = Math.round(downforce);
  const gearingBias = gearing < 45 ? "Acceleration" : gearing > 65 ? "Top Speed" : "Balanced";
  const hp = performance.horsepower;
  const conditionFactor = Math.max(0.65, condition / 100);
  const gearingAccel = 0.9 + (100 - gearing) / 500;
  const aeroDrag = 1 - Math.max(0, downforce - 35) / 450;
  const lowDownforceSpeed = 1 + Math.max(0, 35 - downforce) / 240;
  const tractionFactor = Math.max(0.7, Math.min(1.35, performance.traction / 8.4 + gripPct / 420));
  const launchRpmFit = 1 - Math.min(0.22, Math.abs((tuning.launchRpm ?? 4200) - 4300) / 11500);
  const shiftRpmFit = 1 - Math.min(0.18, Math.abs((tuning.shiftRpm ?? 6400) - 6500) / 13500);
  const wheelHorsepower = Math.round(hp * conditionFactor * shiftRpmFit * (0.96 + (gearingAccel - 1) * 0.2));
  const torquePeakRpm = Math.max(3200, Math.min(7800, (tuning.shiftRpm ?? 6400) * 0.78));
  const torqueLbFt = Math.round((hp * 5252) / torquePeakRpm);
  const powerToWeight = hp / Math.max(1, performance.weight);
  const baseTopSpeed = 72 + Math.sqrt(powerToWeight) * 220;
  const topSpeedMph = Math.round(baseTopSpeed * (0.82 + gearing / 250) * aeroDrag * lowDownforceSpeed * Math.max(0.82, conditionFactor));
  const accelScore = Math.max(0.55, powerToWeight * 9.5 * tractionFactor * gearingAccel * conditionFactor * launchRpmFit);
  const zeroToSixty = Math.max(2.2, Math.min(14.5, 6.9 / accelScore));
  const quarterMile = Math.max(6.5, Math.min(20, 13.6 - powerToWeight * 19 - tractionFactor * 0.7 - (gearingAccel - 1) * 1.6 + (1 - conditionFactor) * 1.4));
  const launchGrip = Math.round(Math.max(0, Math.min(100, tractionFactor * launchRpmFit * 72 + Math.max(0, downforce - 20) * 0.18)));
  return {
    gripPct,
    aeroPct,
    gearingBias,
    horsepower: hp,
    wheelHorsepower,
    torqueLbFt,
    topSpeedMph,
    zeroToSixty: Math.round(zeroToSixty * 10) / 10,
    quarterMile: Math.round(quarterMile * 10) / 10,
    launchGrip,
  };
}

export function repairCostForVehicle(vehicle: Pick<OwnedVehicle, "condition" | "power">): number {
  return repairCost(vehicle.condition, vehicle.power);
}

export function saleValueForVehicle(vehicle: Pick<OwnedVehicle, "purchasePrice" | "upgradeSpend" | "condition">): number {
  return saleValue(vehicle.purchasePrice, vehicle.upgradeSpend, vehicle.condition);
}
