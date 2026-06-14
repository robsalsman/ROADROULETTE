import { canonicalVehicleKey } from "@/data/vehicles";
import { repairCost, saleValue } from "@workspace/economy";
import type { GarageTuning, OwnedVehicle } from "@/services/garageApi";
import type { Upgrades } from "@/data/garage";
import { finalDriveForGearing } from "@/data/gearing";

export type Drivetrain = "FWD" | "RWD" | "AWD" | "4x4" | "Boat" | "Other";

export type VehiclePerformance = {
  canonicalVehicleKey: string;
  horsepower: number;
  weight: number;
  drivetrain: Drivetrain;
  traction: number;
  powerRating: number;
  handlingRating: number;
  reliabilityRating: number;
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

export function suspensionTuningProfile(suspension = 50): {
  gripBonus: number;
  accelerationFactor: number;
  topSpeedFactor: number;
  launchFit: number;
} {
  const launchFit = 1 - Math.min(1, Math.abs(suspension - 42) / 58);
  const stabilityFit = 1 - Math.min(1, Math.abs(suspension - 58) / 58);
  return {
    gripBonus: Math.max(-0.16, Math.min(0.18, 0.18 - (1 - launchFit) * 0.34)),
    accelerationFactor: 0.94 + launchFit * 0.11,
    topSpeedFactor: 0.97 + stabilityFit * 0.06,
    launchFit,
  };
}

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

function upgradeEffect(tier = 0): number {
  return tier / 2;
}

export function deriveVehiclePerformance(
  vehicle: Pick<OwnedVehicle, "canonicalVehicleKey" | "name" | "power" | "offRoad" | "reliability" | "purchasePrice" | "condition">,
  upgrades: Upgrades = {},
): VehiclePerformance {
  const key = vehicle.canonicalVehicleKey || canonicalVehicleKey(vehicle.name);
  const override = nameDrivenOverrides(vehicle.name);
  const baseHp = override.horsepower ?? Math.round(85 + vehicle.power * 52);
  const engine = upgradeEffect(upgrades.engine);
  const turbo = upgradeEffect(upgrades.turbo);
  const supercharger = upgradeEffect(upgrades.supercharger);
  const fuel = upgradeEffect(upgrades.fuel);
  const nitrous = upgradeEffect(upgrades.nitrous);
  const bodywork = upgradeEffect(upgrades.bodywork);
  const tyres = upgradeEffect(upgrades.tyres);
  const suspension = upgradeEffect(upgrades.suspension);
  const hp = Math.round(baseHp + engine * 68 + turbo * 72 + supercharger * 64 + fuel * 22 + nitrous * 26);
  const weight = override.weight ?? Math.max(1650, Math.round(2850 + vehicle.offRoad * 130 - vehicle.power * 35 - bodywork * 90));
  const drivetrain = override.drivetrain ?? (/porsche|audi|subaru|mitsubishi|range rover|land rover|jeep|ford focus/i.test(vehicle.name) ? "AWD" : vehicle.power > 7 ? "RWD" : "FWD");
  const tractionBase = vehicle.reliability * 0.38 + vehicle.offRoad * 0.28 + tyres * 1.35 + suspension * 0.85;
  const drivetrainBonus = drivetrain === "AWD" || drivetrain === "4x4" ? 1.1 : drivetrain === "FWD" ? 0.35 : drivetrain === "Boat" ? -1.4 : 0;
  const traction = Math.max(1, Math.min(10, tractionBase + drivetrainBonus - Math.max(0, 100 - vehicle.condition) / 35));
  const powerToWeight = hp / weight;
  const powerRating = Math.round(Math.max(1, Math.min(100, 18 + Math.sqrt(hp / 80) * 21 + powerToWeight * 55)));
  const handlingRating = Math.round(Math.max(1, Math.min(100, traction * 8.5 + (drivetrain === "AWD" || drivetrain === "4x4" ? 5 : drivetrain === "FWD" ? 2 : 0) - Math.max(0, weight - 3200) / 190)));
  const reliabilityRating = Math.round(Math.max(1, Math.min(100, vehicle.condition * 0.66 + vehicle.reliability * 3.4 - turbo * 1.8 - supercharger * 1.4 + fuel * 1.2)));
  const tier = override.tier ?? (powerToWeight > 0.18 ? "Supercar" : powerToWeight > 0.13 ? "Pro" : powerToWeight > 0.09 ? "Club" : "Local");
  const valueCredits = Math.max(100, Math.round(vehicle.purchasePrice * 1.15 + hp * 0.9 + traction * 22));
  return { canonicalVehicleKey: key, horsepower: hp, weight, drivetrain, traction: Math.round(traction * 10) / 10, powerRating, handlingRating, reliabilityRating, tier, valueCredits };
}

export function tuningProjection(
  performance: VehiclePerformance,
  tuning: GarageTuning,
  condition: number,
): TuningProjection {
  const tirePressureGrip = Math.max(-0.12, Math.min(0.16, (34 - (tuning.tirePressure ?? 32)) / 50));
  const suspensionProfile = suspensionTuningProfile(tuning.suspension ?? 50);
  const suspensionGrip = suspensionProfile.gripBonus;
  const downforce = tuning.downforce ?? 35;
  const gearing = tuning.gearing ?? 50;
  const finalDrive = finalDriveForGearing(gearing);
  const loadedNitrousShots = Math.max(0, tuning.nitrousShots ?? 0);
  const gripPct = Math.round((tirePressureGrip + suspensionGrip) * 100);
  const aeroPct = Math.round(downforce);
  const gearingBias = finalDrive.label;
  const hp = performance.horsepower;
  const conditionFactor = Math.max(0.65, condition / 100);
  const gearingAccel = finalDrive.launchFactor;
  const aeroDrag = 1 - Math.max(0, downforce - 35) / 450;
  const lowDownforceSpeed = 1 + Math.max(0, 35 - downforce) / 240;
  const tractionFactor = Math.max(0.7, Math.min(1.35, performance.traction / 8.4 + gripPct / 420));
  const launchRpmFit = 1 - Math.min(0.22, Math.abs((tuning.launchRpm ?? 4200) - 4300) / 11500);
  const shiftRpmFit = 1 - Math.min(0.18, Math.abs((tuning.shiftRpm ?? 6400) - 6500) / 13500);
  const nitrousReserveFactor = 1 + Math.min(0.1, loadedNitrousShots * 0.007);
  const suspensionWheelFactor = 0.98 + (suspensionProfile.accelerationFactor - 1) * 0.22;
  const finalDriveWheelFactor = 0.98 + (finalDrive.wheelTorqueFactor - 1) * 0.24;
  const wheelHorsepower = Math.round(hp * conditionFactor * shiftRpmFit * suspensionWheelFactor * finalDriveWheelFactor * nitrousReserveFactor);
  const torquePeakRpm = Math.max(3200, Math.min(7800, (tuning.shiftRpm ?? 6400) * 0.78));
  const torqueLbFt = Math.round((hp * 5252) / torquePeakRpm);
  const powerToWeight = hp / Math.max(1, performance.weight);
  const baseTopSpeed = 72 + Math.sqrt(powerToWeight) * 220;
  const topSpeedMph = Math.round(baseTopSpeed * 1.18 * finalDrive.topSpeedFactor * aeroDrag * lowDownforceSpeed * Math.max(0.82, conditionFactor) * nitrousReserveFactor * suspensionProfile.topSpeedFactor);
  const accelScore = Math.max(0.55, powerToWeight * 9.5 * tractionFactor * gearingAccel * conditionFactor * launchRpmFit * suspensionProfile.accelerationFactor);
  const zeroToSixty = Math.max(2.2, Math.min(14.5, 6.9 / accelScore));
  const quarterMile = Math.max(6.5, Math.min(20, 13.6 - powerToWeight * 19 - tractionFactor * 0.7 - (gearingAccel - 1) * 1.6 - (suspensionProfile.accelerationFactor - 1) * 2.4 + (1 - conditionFactor) * 1.4));
  const launchGrip = Math.round(Math.max(0, Math.min(100, tractionFactor * launchRpmFit * 72 + suspensionProfile.launchFit * 8 + Math.max(0, downforce - 20) * 0.18)));
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
