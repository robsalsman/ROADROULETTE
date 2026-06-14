import type { GarageTuning, OwnedVehicle } from "@/services/garageApi";
import type { Upgrades } from "@/data/garage";
import { deriveVehiclePerformance, type VehiclePerformance } from "@/data/vehiclePerformance";
import { finalDriveForGearing } from "@/data/gearing";
import { dragReward } from "@workspace/economy";

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
  vehicleName: string;
  presenter: "Jeremy" | "Richard" | "James";
  episode: string;
  tier: "Starter" | "Mid" | "High" | "Elite";
  intro: string;
  winLine: string;
  loseLine: string;
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
    overRevMs?: number;
    mechanicalDamage?: number;
    nitrousUsed?: number;
    entryFee?: number;
    potCredits?: number;
    transmissionMode?: "automatic" | "manual";
    manualBonusCredits?: number;
    xpBonus?: number;
    redLightStrikes?: number;
    fault?: "false-start" | "engine-risk" | "missed-shifts";
  };
};

export const DRAG_OPPONENTS: DragOpponent[] = [
  {
    key: "captain-slow-miata",
    name: "Precision Roadster",
    vehicleName: "Mazda MX-5",
    presenter: "James",
    episode: "Starter Club",
    tier: "Starter",
    power: 3,
    traction: 6,
    consistency: 8,
    rewardCredits: 90,
    intro: "I have selected something light, balanced, and therefore correct. Try not to ruin the launch.",
    winLine: "There we are. Precision, patience, and a complete absence of shouting.",
    loseLine: "Oh cock. I appear to have been beaten by enthusiasm.",
  },
  {
    key: "hamster-hot-hatch",
    name: "Hot Hatch Scrapper",
    vehicleName: "Volkswagen Golf GTI",
    presenter: "Richard",
    episode: "Runabout Rumble",
    tier: "Starter",
    power: 5,
    traction: 6,
    consistency: 6,
    rewardCredits: 140,
    intro: "Small car, big attitude. Come on then, let's see if your garage queen can actually move.",
    winLine: "Ha! Tiny car, massive victory. That is science.",
    loseLine: "Right. Fine. I was giving it character, not speed.",
  },
  {
    key: "service-road-sleeper",
    name: "Service Road Sleeper",
    vehicleName: "Audi S8 Plus",
    presenter: "Jeremy",
    episode: "Operation Desert Stumble",
    tier: "Mid",
    power: 6,
    traction: 6,
    consistency: 6,
    rewardCredits: 245,
    intro: "This is a sensible executive saloon with a large engine. Sensible, obviously, means fast.",
    winLine: "Power has solved the problem, as it always does.",
    loseLine: "Clearly the road surface was wrong. Or the air. Probably the air.",
  },
  {
    key: "runway-local",
    name: "Runway Local Hero",
    vehicleName: "Ford Mustang GT",
    presenter: "Richard",
    episode: "Runway Local Hero",
    tier: "High",
    power: 8,
    traction: 7,
    consistency: 7,
    rewardCredits: 405,
    intro: "Proper noise, proper drama, and hopefully less spinning than last time.",
    winLine: "Yes! That is what a launch is supposed to feel like.",
    loseLine: "I had wheelspin. Heroic wheelspin, but wheelspin.",
  },
  {
    key: "midnight-special",
    name: "Midnight Special",
    vehicleName: "Dodge Challenger SRT Demon",
    presenter: "Jeremy",
    episode: "Midnight Special",
    tier: "Elite",
    power: 10,
    traction: 9,
    consistency: 8,
    rewardCredits: 665,
    intro: "This has enough torque to rotate the planet. You may now be afraid.",
    winLine: "And that is why the answer is displacement.",
    loseLine: "I shall be filing a formal complaint against physics.",
  },
  {
    key: "captain-slow-hypercar",
    name: "Hypercar Thesis",
    vehicleName: "Porsche 918 Spyder",
    presenter: "James",
    episode: "Holy Trinity",
    tier: "Elite",
    power: 10,
    traction: 10,
    consistency: 9,
    rewardCredits: 950,
    intro: "Hybrid torque vectoring, four driven wheels, and absolutely no need for childishness.",
    winLine: "A pleasing demonstration of engineering. I enjoyed that quietly.",
    loseLine: "I may have overestimated the calming influence of technology.",
  },
];

export function opponentsForVehicle(vehicle?: DragVehicle): DragOpponent[] {
  if (!vehicle) return DRAG_OPPONENTS;
  const perf = deriveVehiclePerformance(vehicle, vehicle.upgrades ?? {});
  const multiplier = perf.tier === "Supercar" ? 1.75 : perf.tier === "Pro" ? 1.35 : perf.tier === "Chaos" ? 1.45 : perf.tier === "Club" ? 1.15 : 1;
  return DRAG_OPPONENTS.map((opponent, index) => ({
    ...opponent,
    rewardCredits: dragReward(opponent.rewardCredits, multiplier),
    power: Math.min(10, opponent.power + (perf.tier === "Supercar" ? 1 : index === 2 ? 1 : 0)),
    traction: Math.min(10, opponent.traction + (perf.drivetrain === "Boat" ? -1 : 0) + (perf.tier === "Supercar" ? 1 : 0)),
  }));
}

function tuningBonus(tuning: GarageTuning): number {
  const launchFit = 1 - Math.min(1, Math.abs(tuning.launchRpm - 4300) / 2500);
  const shiftFit = 1 - Math.min(1, Math.abs(tuning.shiftRpm - 6500) / 3000);
  const finalDrive = finalDriveForGearing(tuning.gearing);
  const gearingFit = 1 - Math.min(1, Math.abs(finalDrive.ratio - 3.73) / 1.2);
  const tireFit = 1 - Math.min(1, Math.abs((tuning.tirePressure ?? 32) - 28) / 18);
  const suspensionFit = 1 - Math.min(1, Math.abs((tuning.suspension ?? 50) - 42) / 58);
  const downforceFit = 1 - Math.min(1, Math.abs((tuning.downforce ?? 35) - 25) / 75);
  return (launchFit + shiftFit + gearingFit + tireFit + suspensionFit + downforceFit) / 6;
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
  const trapSpeed = Math.round(Math.max(58, Math.min(225, 250 * Math.cbrt(hp / Math.max(1, weight)) + shiftQuality * 5 - conditionPenalty * 10)));
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
