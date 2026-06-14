export type EconomyVehicleInput = {
  name: string;
  reliability: number;
  power: number;
  offRoad: number;
  difficulty?: "easy" | "medium" | "hard" | "insane";
  episodeNumber?: number;
  optionIndex?: number;
};

export type EconomyTier = "starter" | "mid" | "high" | "elite";

export const ECONOMY = {
  defaultProfileCredits: 240_000,
  characterBudgets: {
    jeremy: 280_000,
    richard: 255_000,
    james: 235_000,
    fallback: 240_000,
  },
  missionBudgetBase: 235_000,
  missionBudgetPerEpisode: 1_500,
  missionBudgetCap: 80_000,
  vehicleRanges: {
    starter: { min: 3_500, max: 10_000 },
    mid: { min: 12_000, max: 35_000 },
    high: { min: 50_000, max: 120_000 },
    elite: { min: 180_000, max: 450_000 },
  },
  dragRewardMultiplier: 10,
  repairMultiplier: 10,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nameScore(name: string): number {
  const total = [...name.toLowerCase()].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (total % 100) / 100;
}

export function economyTierForVehicle(vehicle: EconomyVehicleInput): EconomyTier {
  const name = vehicle.name.toLowerCase();
  if (/p1|laferrari|918|chiron|veyron|rimac|vulcan|aventador|huracan|mclaren|ford gt|superleggera|bohema|ep9|senna|xj220|eb 110/.test(name)) {
    return "elite";
  }
  if (/mustang|camaro|charger|challenger|corvette|viper|hellcat|demon|gt500|ssr|amg gt|project 8|m850i|continental gt|911|testarossa|countach/.test(name)) {
    return "high";
  }
  if (/impreza|lancer|quattro|rs4|focus rs|raptor|range rover|land rover|jeep|4x4|buggy|nomad|stinger|gti|type r|alpine|caterham|ripsaw|trackhawk|urus/.test(name)) {
    return "mid";
  }
  if (/rv|pace arrow|tropi-cal|harvester|van|voyager|berlingo|scenic|boat|pbr|cruiser|scarab|amphibious|spey|bond bug/.test(name)) {
    return vehicle.power >= 7 ? "mid" : "starter";
  }
  if (vehicle.power >= 9) return "high";
  if (vehicle.power >= 6 || vehicle.offRoad >= 7) return "mid";
  return "starter";
}

export function vehiclePrice(vehicle: EconomyVehicleInput): number {
  const tier = economyTierForVehicle(vehicle);
  const range = ECONOMY.vehicleRanges[tier];
  if (tier === "elite") {
    const name = vehicle.name.toLowerCase();
    const premiumLift = /bugatti|chiron|veyron|rimac|senna|bohema|ep9|vulcan|xj220|eb 110/.test(name) ? 0.42 : 0;
    const earlyIconDiscount = /p1|laferrari|918/.test(name) ? -0.08 : 0;
    const position = clamp(
      0.12 + nameScore(vehicle.name) * 0.22 + (vehicle.optionIndex ?? 0) * 0.035 + premiumLift + earlyIconDiscount,
      0,
      1,
    );
    const raw = range.min + (range.max - range.min) * position;
    return Math.round(raw / 250) * 250;
  }
  const performanceScore = clamp(
    vehicle.power * 0.54 + vehicle.reliability * 0.22 + vehicle.offRoad * 0.14 + nameScore(vehicle.name) * 1.1,
    0,
    10,
  ) / 10;
  const difficultyLift = vehicle.difficulty === "insane" ? 0.1 : vehicle.difficulty === "hard" ? 0.06 : vehicle.difficulty === "easy" ? -0.04 : 0;
  const optionLift = (vehicle.optionIndex ?? 0) * 0.035;
  const episodeLift = Math.min(0.08, Math.max(0, (vehicle.episodeNumber ?? 1) - 1) * 0.0015);
  const position = clamp(performanceScore + difficultyLift + optionLift + episodeLift, 0, 1);
  const raw = range.min + (range.max - range.min) * position;
  return Math.round(raw / 250) * 250;
}

export function missionBudget(episodeNumber: number): number {
  return ECONOMY.missionBudgetBase + Math.min(ECONOMY.missionBudgetCap, episodeNumber * ECONOMY.missionBudgetPerEpisode);
}

export function characterBudget(slug?: string): number {
  if (slug === "jeremy") return ECONOMY.characterBudgets.jeremy;
  if (slug === "richard") return ECONOMY.characterBudgets.richard;
  if (slug === "james") return ECONOMY.characterBudgets.james;
  return ECONOMY.characterBudgets.fallback;
}

export function upgradeCost(baseCost: number): number {
  return baseCost * 10;
}

export function dragReward(baseReward: number, tierMultiplier = 1): number {
  return Math.round((baseReward * ECONOMY.dragRewardMultiplier * tierMultiplier) / 50) * 50;
}

export function repairCost(condition: number, power: number): number {
  const missingCondition = Math.max(0, 100 - condition);
  if (missingCondition === 0) return 0;
  return Math.max(250, Math.ceil(missingCondition * (6 + power * 0.7) * ECONOMY.repairMultiplier));
}

export function saleValue(purchasePrice: number, upgradeSpend: number, condition: number): number {
  return Math.max(500, Math.floor(purchasePrice * 0.65 + upgradeSpend * 0.35 + condition * 15));
}
