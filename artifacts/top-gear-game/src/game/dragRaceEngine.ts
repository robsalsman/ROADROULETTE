import type { GarageTuning, OwnedVehicle } from "@/services/garageApi";
import type { Upgrades } from "@/data/garage";
import { deriveVehiclePerformance, type VehiclePerformance } from "@/data/vehiclePerformance";

type DragVehicle = Pick<OwnedVehicle, "canonicalVehicleKey" | "name" | "reliability" | "power" | "offRoad" | "condition" | "purchasePrice" | "upgrades" | "tuning">;

export type DragRaceInput = {
  vehicle: DragVehicle;
  opponent: DragOpponent;
  launchScore: number;
  shiftScore: number;
  reactionMs: number;
};

export type DragOpponent = {
  key: string;
  name: string;
  power: number;
  traction: number;
  consistency: number;
  rewardCredits: number;
};

export type DragRaceResult = {
  elapsedMs: number;
  opponentElapsedMs: number;
  trapSpeed: number;
  won: boolean;
  rewardCredits: number;
  breakdown: {
    horsepower: number;
    weight: number;
    drivetrain: VehiclePerformance["drivetrain"];
    tier: VehiclePerformance["tier"];
    traction: number;
    launchQuality: number;
    shiftQuality: number;
    reactionMs: number;
    conditionPenalty: number;
    tuningBonus: number;
  };
};

export const DRAG_OPPONENTS: DragOpponent[] = [
  { key: "service-road-sleeper", name: "Service Road Sleeper", power: 5, traction: 5, consistency: 6, rewardCredits: 140 },
  { key: "runway-local", name: "Runway Local Hero", power: 7, traction: 6, consistency: 7, rewardCredits: 230 },
  { key: "midnight-special", name: "Midnight Special", power: 9, traction: 8, consistency: 8, rewardCredits: 380 },
];

export function opponentsForVehicle(vehicle?: DragVehicle): DragOpponent[] {
  if (!vehicle) return DRAG_OPPONENTS;
  const perf = deriveVehiclePerformance(vehicle, vehicle.upgrades ?? {});
  const multiplier = perf.tier === "Supercar" ? 1.75 : perf.tier === "Pro" ? 1.35 : perf.tier === "Chaos" ? 1.45 : perf.tier === "Club" ? 1.15 : 1;
  return DRAG_OPPONENTS.map((opponent, index) => ({
    ...opponent,
    rewardCredits: Math.round(opponent.rewardCredits * multiplier),
    power: Math.min(10, opponent.power + (perf.tier === "Supercar" ? 1 : index === 2 ? 1 : 0)),
    traction: Math.min(10, opponent.traction + (perf.drivetrain === "Boat" ? -1 : 0) + (perf.tier === "Supercar" ? 1 : 0)),
  }));
}

function tuningBonus(tuning: GarageTuning): number {
  const launchFit = 1 - Math.min(1, Math.abs(tuning.launchRpm - 4300) / 2500);
  const shiftFit = 1 - Math.min(1, Math.abs(tuning.shiftRpm - 6500) / 3000);
  const gearingFit = 1 - Math.min(1, Math.abs(tuning.gearing - 58) / 58);
  const tireFit = 1 - Math.min(1, Math.abs(tuning.tireSetup - 64) / 64);
  return (launchFit + shiftFit + gearingFit + tireFit) / 4;
}

export function simulateDragRace(input: DragRaceInput): DragRaceResult {
  const upgrades = input.vehicle.upgrades ?? {};
  const tuning = input.vehicle.tuning;
  const perf = deriveVehiclePerformance(input.vehicle, upgrades);
  const hp = perf.horsepower;
  const weight = perf.weight;
  const traction = perf.traction;
  const launchQuality = Math.max(0, Math.min(1, input.launchScore));
  const shiftQuality = Math.max(0, Math.min(1, input.shiftScore));
  const conditionPenalty = Math.max(0, (100 - input.vehicle.condition) / 100);
  const tune = tuningBonus(tuning);

  const powerToWeight = hp / weight;
  const drivetrainLaunch = perf.drivetrain === "AWD" || perf.drivetrain === "4x4" ? 0.22 : perf.drivetrain === "FWD" ? 0.08 : perf.drivetrain === "Boat" ? -0.35 : 0;
  const playerBase = 14.3 - powerToWeight * 19 - traction * 0.14 - drivetrainLaunch;
  const skillBonus = launchQuality * 0.82 + shiftQuality * 0.64 + tune * 0.42;
  const reactionPenalty = Math.max(0, input.reactionMs - 180) / 1000;
  const chaosPenalty = perf.tier === "Chaos" ? 0.45 : 0;
  const elapsed = Math.max(6.6, playerBase - skillBonus + conditionPenalty * 1.3 + reactionPenalty + chaosPenalty);

  const opponentPowerToWeight = (120 + input.opponent.power * 50) / (3300 - input.opponent.power * 45);
  const opponentBase = 13.9 - opponentPowerToWeight * 16 - input.opponent.traction * 0.1;
  const opponentElapsed = Math.max(7.2, opponentBase - input.opponent.consistency * 0.06);

  const elapsedMs = Math.round(elapsed * 1000);
  const opponentElapsedMs = Math.round(opponentElapsed * 1000);
  const trapSpeed = Math.round(76 + powerToWeight * 455 + shiftQuality * 10 - conditionPenalty * 11);
  const won = elapsedMs < opponentElapsedMs;

  return {
    elapsedMs,
    opponentElapsedMs,
    trapSpeed,
    won,
    rewardCredits: won ? input.opponent.rewardCredits : 0,
    breakdown: {
      horsepower: hp,
      weight,
      drivetrain: perf.drivetrain,
      tier: perf.tier,
      traction: Math.round(traction * 10) / 10,
      launchQuality: Math.round(launchQuality * 100),
      shiftQuality: Math.round(shiftQuality * 100),
      reactionMs: input.reactionMs,
      conditionPenalty: Math.round(conditionPenalty * 100),
      tuningBonus: Math.round(tune * 100),
    },
  };
}

export function timingScore(value: number, target = 0.72): number {
  return Math.max(0, 1 - Math.abs(value - target) / 0.42);
}
