import type { GarageTuning, OwnedVehicle } from "@/services/garageApi";
import type { Upgrades } from "@/data/garage";

export type DragRaceInput = {
  vehicle: Pick<OwnedVehicle, "name" | "reliability" | "power" | "offRoad" | "condition" | "upgrades" | "tuning">;
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
    traction: number;
    launchQuality: number;
    shiftQuality: number;
    reactionMs: number;
    conditionPenalty: number;
    tuningBonus: number;
  };
};

export const DRAG_OPPONENTS: DragOpponent[] = [
  { key: "service-road-sleeper", name: "Service Road Sleeper", power: 5, traction: 5, consistency: 6, rewardCredits: 120 },
  { key: "runway-local", name: "Runway Local Hero", power: 7, traction: 6, consistency: 7, rewardCredits: 190 },
  { key: "midnight-special", name: "Midnight Special", power: 9, traction: 8, consistency: 8, rewardCredits: 300 },
];

export function horsepowerFromStats(power: number, upgrades: Upgrades): number {
  return Math.round(95 + power * 48 + (upgrades.engine ?? 0) * 58 + (upgrades.fuel ?? 0) * 16);
}

export function weightFromStats(offRoad: number, upgrades: Upgrades): number {
  const base = 3300 + offRoad * 105;
  return Math.max(1800, Math.round(base - (upgrades.bodywork ?? 0) * 70 - (upgrades.sponsor ?? 0) * 25));
}

export function tractionFromStats(reliability: number, offRoad: number, upgrades: Upgrades): number {
  return Math.min(10, reliability * 0.35 + offRoad * 0.25 + (upgrades.tyres ?? 0) * 1.2 + (upgrades.suspension ?? 0) * 0.8);
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
  const hp = horsepowerFromStats(input.vehicle.power, upgrades);
  const weight = weightFromStats(input.vehicle.offRoad, upgrades);
  const traction = tractionFromStats(input.vehicle.reliability, input.vehicle.offRoad, upgrades);
  const launchQuality = Math.max(0, Math.min(1, input.launchScore));
  const shiftQuality = Math.max(0, Math.min(1, input.shiftScore));
  const conditionPenalty = Math.max(0, (100 - input.vehicle.condition) / 100);
  const tune = tuningBonus(tuning);

  const powerToWeight = hp / weight;
  const playerBase = 13.8 - powerToWeight * 17 - traction * 0.12;
  const skillBonus = launchQuality * 0.72 + shiftQuality * 0.58 + tune * 0.38;
  const reactionPenalty = Math.max(0, input.reactionMs - 180) / 1000;
  const elapsed = Math.max(7.1, playerBase - skillBonus + conditionPenalty * 1.2 + reactionPenalty);

  const opponentPowerToWeight = (120 + input.opponent.power * 50) / (3300 - input.opponent.power * 45);
  const opponentBase = 13.9 - opponentPowerToWeight * 16 - input.opponent.traction * 0.1;
  const opponentElapsed = Math.max(7.2, opponentBase - input.opponent.consistency * 0.06);

  const elapsedMs = Math.round(elapsed * 1000);
  const opponentElapsedMs = Math.round(opponentElapsed * 1000);
  const trapSpeed = Math.round(78 + powerToWeight * 420 + shiftQuality * 9 - conditionPenalty * 10);
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
