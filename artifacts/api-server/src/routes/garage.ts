import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  playerProfilesTable,
  ownedVehiclesTable,
  garageRaceHistoryTable,
} from "@workspace/db";
import {
  ECONOMY,
  repairCost as economyRepairCost,
  saleValue as economySaleValue,
  vehiclePrice,
} from "@workspace/economy";
import { localGarageStoreFor, defaultGarageTuning, type GarageTuning } from "../lib/local-garage-store";

const router: IRouter = Router();
const DEFAULT_PROFILE_ID = 1;
const DRIVER_HEADER = "x-road-driver";

const upgradesSchema = z.record(z.string(), z.number().int().min(0).max(6));
const tuningSchema = z.object({
  launchRpm: z.number().int().min(2500).max(7200).default(defaultGarageTuning.launchRpm),
  shiftRpm: z.number().int().min(3500).max(8500).default(defaultGarageTuning.shiftRpm),
  gearing: z.number().int().min(0).max(100).default(defaultGarageTuning.gearing),
  tireSetup: z.number().int().min(0).max(100).default(defaultGarageTuning.tireSetup),
  suspension: z.number().int().min(0).max(100).default(defaultGarageTuning.suspension),
  downforce: z.number().int().min(0).max(100).default(defaultGarageTuning.downforce),
  tirePressure: z.number().int().min(18).max(48).default(defaultGarageTuning.tirePressure),
  nitrousShots: z.number().int().min(0).max(12).default(defaultGarageTuning.nitrousShots),
});

const buyVehicleSchema = z.object({
  canonicalVehicleKey: z.string().min(1),
  sourceCarId: z.number().int().nullable().optional(),
  sourceMissionId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  year: z.number().int(),
  price: z.number().int().min(0),
  reliability: z.number().int().min(0).max(10),
  power: z.number().int().min(0).max(10),
  offRoad: z.number().int().min(0).max(10),
  description: z.string().min(1),
});

const vehiclePatchSchema = z.object({
  paintColor: z.string().nullable().optional(),
  condition: z.number().int().min(0).max(100).optional(),
});

const upgradesPatchSchema = z.object({
  upgrades: upgradesSchema,
  spent: z.number().int().min(0),
  creditsDelta: z.number().int().default(0),
});

const tuningPatchSchema = z.object({
  tuning: tuningSchema,
  creditsDelta: z.number().int().default(0),
});

const raceCompleteSchema = z.object({
  canonicalVehicleKey: z.string().min(1),
  opponentKey: z.string().min(1),
  opponentName: z.string().min(1),
  elapsedMs: z.number().int().positive(),
  opponentElapsedMs: z.number().int().positive(),
  trapSpeed: z.number().int().positive(),
  won: z.boolean(),
  rewardCredits: z.number().int().min(0),
  breakdown: z.unknown().optional(),
});

const creditsSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1).max(120).default("Garage reward"),
});

function saleValue(vehicle: typeof ownedVehiclesTable.$inferSelect): number {
  return economySaleValue(normalizedPurchasePrice(vehicle), normalizedUpgradeSpend(vehicle), vehicle.condition);
}

function repairCost(vehicle: typeof ownedVehiclesTable.$inferSelect): number {
  return economyRepairCost(vehicle.condition, vehicle.power);
}

function toBool(value: number | boolean): boolean {
  return value === true || value === 1;
}

function driverNameFromRequest(req: Request): string | null {
  let rawUrl: string | null = null;
  try {
    rawUrl = new URL(req.originalUrl ?? req.url, "http://road-roulette.local").searchParams.get("driver");
  } catch {
    rawUrl = null;
  }
  const rawQuery = rawUrl ?? (Array.isArray(req.query.driver) ? req.query.driver[0] : req.query.driver);
  const raw = typeof rawQuery === "string"
    ? rawQuery
    : Array.isArray(req.headers[DRIVER_HEADER])
    ? req.headers[DRIVER_HEADER][0]
    : req.headers[DRIVER_HEADER];
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return cleaned.length >= 2 ? cleaned : null;
}

function localStore(req?: Request) {
  return localGarageStoreFor(req ? driverNameFromRequest(req) : null);
}

function formatProfile(profile: typeof playerProfilesTable.$inferSelect) {
  return {
    id: profile.id,
    name: profile.name,
    credits: profile.credits,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function normalizeUpgrades(value: unknown): Record<string, number> {
  return upgradesSchema.catch({}).parse(value);
}

function normalizeTuning(value: unknown): GarageTuning {
  return tuningSchema.catch(defaultGarageTuning).parse(value);
}

function normalizedPurchasePrice(vehicle: Pick<typeof ownedVehiclesTable.$inferSelect, "name" | "reliability" | "power" | "offRoad" | "purchasePrice">): number {
  const normalized = vehiclePrice({
    name: vehicle.name,
    reliability: vehicle.reliability,
    power: vehicle.power,
    offRoad: vehicle.offRoad,
  });
  return vehicle.purchasePrice < 2_000 ? normalized : vehicle.purchasePrice;
}

function normalizedUpgradeSpend(vehicle: Pick<typeof ownedVehiclesTable.$inferSelect, "purchasePrice" | "upgradeSpend">): number {
  return vehicle.purchasePrice < 2_000 && vehicle.upgradeSpend > 0 && vehicle.upgradeSpend < 3_000
    ? vehicle.upgradeSpend * ECONOMY.dragRewardMultiplier
    : vehicle.upgradeSpend;
}

function formatVehicle(vehicle: typeof ownedVehiclesTable.$inferSelect) {
  return {
    id: vehicle.id,
    profileId: vehicle.profileId,
    canonicalVehicleKey: vehicle.canonicalVehicleKey,
    sourceCarId: vehicle.sourceCarId,
    sourceMissionId: vehicle.sourceMissionId,
    name: vehicle.name,
    year: vehicle.year,
    purchasePrice: normalizedPurchasePrice(vehicle),
    reliability: vehicle.reliability,
    power: vehicle.power,
    offRoad: vehicle.offRoad,
    description: vehicle.description,
    condition: vehicle.condition,
    paintColor: vehicle.paintColor,
    isActive: toBool(vehicle.isActive),
    upgrades: normalizeUpgrades(vehicle.upgradesJson),
    upgradeSpend: normalizedUpgradeSpend(vehicle),
    tuning: normalizeTuning(vehicle.tuningJson),
    acquiredAt: vehicle.acquiredAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

function formatRace(race: typeof garageRaceHistoryTable.$inferSelect) {
  return {
    id: race.id,
    profileId: race.profileId,
    ownedVehicleId: race.ownedVehicleId,
    canonicalVehicleKey: race.canonicalVehicleKey,
    opponentKey: race.opponentKey,
    opponentName: race.opponentName,
    elapsedMs: race.elapsedMs,
    opponentElapsedMs: race.opponentElapsedMs,
    trapSpeed: race.trapSpeed,
    won: toBool(race.won),
    rewardCredits: race.rewardCredits,
    breakdown: race.breakdownJson,
    createdAt: race.createdAt.toISOString(),
  };
}

function formatDragLeaderboardEntry(
  race: typeof garageRaceHistoryTable.$inferSelect,
  profile?: typeof playerProfilesTable.$inferSelect | null,
) {
  return {
    id: race.id,
    profileId: race.profileId,
    driverName: profile?.name ?? "Road Roulette Driver",
    canonicalVehicleKey: race.canonicalVehicleKey,
    opponentKey: race.opponentKey,
    opponentName: race.opponentName,
    elapsedMs: race.elapsedMs,
    opponentElapsedMs: race.opponentElapsedMs,
    trapSpeed: race.trapSpeed,
    won: toBool(race.won),
    rewardCredits: race.rewardCredits,
    createdAt: race.createdAt.toISOString(),
  };
}

async function ensureProfile(req?: Request) {
  const driverName = req ? driverNameFromRequest(req) : null;
  if (driverName) {
    const [existing] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.name, driverName));
    if (existing) return existing;
    const [created] = await db
      .insert(playerProfilesTable)
      .values({ name: driverName, credits: ECONOMY.defaultProfileCredits })
      .returning();
    return created;
  }

  const [existing] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.id, DEFAULT_PROFILE_ID));
  if (existing) {
    if (existing.credits > 0 && existing.credits < 10_000) {
      const [updated] = await db
        .update(playerProfilesTable)
        .set({ credits: existing.credits * ECONOMY.dragRewardMultiplier })
        .where(eq(playerProfilesTable.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }
  const [created] = await db
    .insert(playerProfilesTable)
    .values({ id: DEFAULT_PROFILE_ID, name: "Road Roulette Driver", credits: ECONOMY.defaultProfileCredits })
    .returning();
  return created;
}

async function garageResponse(req?: Request) {
  const profile = await ensureProfile(req);
  const vehicles = await db
    .select()
    .from(ownedVehiclesTable)
    .where(eq(ownedVehiclesTable.profileId, profile.id))
    .orderBy(desc(ownedVehiclesTable.updatedAt));
  const raceHistory = await db
    .select()
    .from(garageRaceHistoryTable)
    .where(eq(garageRaceHistoryTable.profileId, profile.id))
    .orderBy(desc(garageRaceHistoryTable.createdAt));
  return {
    profile: formatProfile(profile),
    vehicles: vehicles.map(formatVehicle),
    raceHistory: raceHistory.map(formatRace),
  };
}

router.get("/garage/profile", async (req, res): Promise<void> => {
  try {
    res.json(formatProfile(await ensureProfile(req)));
  } catch {
    res.json(localStore(req).profile());
  }
});

router.get("/garage", async (req, res): Promise<void> => {
  try {
    res.json(await garageResponse(req));
  } catch {
    res.json(localStore(req).garage());
  }
});

router.post("/garage/migrate", async (req, res): Promise<void> => {
  const parsed = z.object({ vehicles: z.array(buyVehicleSchema).default([]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const profile = await ensureProfile(req);
    for (const vehicle of parsed.data.vehicles) {
      const existing = await db
        .select()
        .from(ownedVehiclesTable)
        .where(and(
          eq(ownedVehiclesTable.profileId, profile.id),
          eq(ownedVehiclesTable.canonicalVehicleKey, vehicle.canonicalVehicleKey),
        ));
      if (existing.length > 0) continue;
      await db.insert(ownedVehiclesTable).values({
        profileId: profile.id,
        canonicalVehicleKey: vehicle.canonicalVehicleKey,
        sourceCarId: vehicle.sourceCarId ?? null,
        sourceMissionId: vehicle.sourceMissionId ?? null,
        name: vehicle.name,
        year: vehicle.year,
        purchasePrice: vehicle.price,
        reliability: vehicle.reliability,
        power: vehicle.power,
        offRoad: vehicle.offRoad,
        description: vehicle.description,
        condition: 100,
        isActive: 0,
        upgradesJson: {},
        tuningJson: defaultGarageTuning,
      });
    }
    res.json(await garageResponse(req));
  } catch {
    const store = localStore(req);
    for (const vehicle of parsed.data.vehicles) store.upsertVehicle(vehicle);
    res.json(store.garage());
  }
});

router.post("/garage/vehicles/buy", async (req, res): Promise<void> => {
  const parsed = buyVehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const profile = await ensureProfile(req);
    const [existing] = await db
      .select()
      .from(ownedVehiclesTable)
      .where(and(
        eq(ownedVehiclesTable.profileId, profile.id),
        eq(ownedVehiclesTable.canonicalVehicleKey, parsed.data.canonicalVehicleKey),
      ));

    if (existing) {
      res.status(409).json({ error: "Already Owned", vehicle: formatVehicle(existing), profile: formatProfile(profile) });
      return;
    }
    if (profile.credits < parsed.data.price) {
      res.status(400).json({ error: "Not enough credits", profile: formatProfile(profile) });
      return;
    }

    await db
      .update(ownedVehiclesTable)
      .set({ isActive: 0 })
      .where(eq(ownedVehiclesTable.profileId, profile.id));
    const [updatedProfile] = await db
      .update(playerProfilesTable)
      .set({ credits: profile.credits - parsed.data.price })
      .where(eq(playerProfilesTable.id, profile.id))
      .returning();
    const [vehicle] = await db
      .insert(ownedVehiclesTable)
      .values({
        profileId: profile.id,
        canonicalVehicleKey: parsed.data.canonicalVehicleKey,
        sourceCarId: parsed.data.sourceCarId ?? null,
        sourceMissionId: parsed.data.sourceMissionId ?? null,
        name: parsed.data.name,
        year: parsed.data.year,
        purchasePrice: parsed.data.price,
        reliability: parsed.data.reliability,
        power: parsed.data.power,
        offRoad: parsed.data.offRoad,
        description: parsed.data.description,
        condition: 100,
        isActive: 1,
        upgradesJson: {},
        tuningJson: defaultGarageTuning,
      })
      .returning();
    res.status(201).json({ alreadyOwned: false, vehicle: formatVehicle(vehicle), profile: formatProfile(updatedProfile) });
  } catch {
    const result = localStore(req).buyVehicle(parsed.data);
    if ("error" in result) {
      res.status(400).json(result);
      return;
    }
    if (result.alreadyOwned) {
      res.status(409).json({ error: "Already Owned", ...result });
      return;
    }
    res.status(201).json(result);
  }
});

router.post("/garage/credits", async (req, res): Promise<void> => {
  const parsed = creditsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const profile = await ensureProfile(req);
    const [updatedProfile] = await db
      .update(playerProfilesTable)
      .set({ credits: Math.max(0, profile.credits + parsed.data.amount) })
      .where(eq(playerProfilesTable.id, profile.id))
      .returning();
    res.json({ profile: formatProfile(updatedProfile), reason: parsed.data.reason });
  } catch {
    const profile = localStore(req).changeCredits(parsed.data.amount);
    res.json({ profile, reason: parsed.data.reason });
  }
});

router.patch("/garage/vehicles/:canonicalVehicleKey/active", async (req, res): Promise<void> => {
  const canonicalVehicleKey = req.params.canonicalVehicleKey;
  try {
    const profile = await ensureProfile(req);
    const [vehicle] = await db
      .select()
      .from(ownedVehiclesTable)
      .where(and(eq(ownedVehiclesTable.profileId, profile.id), eq(ownedVehiclesTable.canonicalVehicleKey, canonicalVehicleKey)));
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    await db.update(ownedVehiclesTable).set({ isActive: 0 }).where(eq(ownedVehiclesTable.profileId, profile.id));
    const [updated] = await db.update(ownedVehiclesTable).set({ isActive: 1 }).where(eq(ownedVehiclesTable.id, vehicle.id)).returning();
    res.json({ vehicle: formatVehicle(updated), garage: await garageResponse(req) });
  } catch {
    const store = localStore(req);
    const vehicle = store.setActive(canonicalVehicleKey);
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json({ vehicle, garage: store.garage() });
  }
});

router.patch("/garage/vehicles/:canonicalVehicleKey", async (req, res): Promise<void> => {
  const canonicalVehicleKey = req.params.canonicalVehicleKey;
  const parsed = vehiclePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const profile = await ensureProfile(req);
    const [updated] = await db
      .update(ownedVehiclesTable)
      .set(parsed.data)
      .where(and(eq(ownedVehiclesTable.profileId, profile.id), eq(ownedVehiclesTable.canonicalVehicleKey, canonicalVehicleKey)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json({ vehicle: formatVehicle(updated), garage: await garageResponse(req) });
  } catch {
    const store = localStore(req);
    const updated = store.patchVehicle(canonicalVehicleKey, parsed.data);
    if (!updated) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json({ vehicle: updated, garage: store.garage() });
  }
});

router.delete("/garage/vehicles/:canonicalVehicleKey", async (req, res): Promise<void> => {
  const canonicalVehicleKey = req.params.canonicalVehicleKey;
  try {
    const profile = await ensureProfile(req);
    const [vehicle] = await db
      .select()
      .from(ownedVehiclesTable)
      .where(and(eq(ownedVehiclesTable.profileId, profile.id), eq(ownedVehiclesTable.canonicalVehicleKey, canonicalVehicleKey)));
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    const creditGain = saleValue(vehicle);
    await db.delete(ownedVehiclesTable).where(eq(ownedVehiclesTable.id, vehicle.id));
    const [updatedProfile] = await db
      .update(playerProfilesTable)
      .set({ credits: profile.credits + creditGain })
      .where(eq(playerProfilesTable.id, profile.id))
      .returning();
    const remaining = await db.select().from(ownedVehiclesTable).where(eq(ownedVehiclesTable.profileId, profile.id));
    if (vehicle.isActive && remaining[0]) {
      await db.update(ownedVehiclesTable).set({ isActive: 1 }).where(eq(ownedVehiclesTable.id, remaining[0].id));
    }
    res.json({ sold: formatVehicle(vehicle), saleCredits: creditGain, profile: formatProfile(updatedProfile), garage: await garageResponse(req) });
  } catch {
    const store = localStore(req);
    const garage = store.garage();
    const vehicle = garage.vehicles.find((item) => item.canonicalVehicleKey === canonicalVehicleKey);
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    const creditGain = economySaleValue(vehicle.purchasePrice, vehicle.upgradeSpend, vehicle.condition);
    const result = store.sellVehicle(canonicalVehicleKey, creditGain);
    res.json({ sold: vehicle, saleCredits: creditGain, profile: result?.profile, garage: store.garage() });
  }
});

router.post("/garage/vehicles/:canonicalVehicleKey/repair", async (req, res): Promise<void> => {
  const canonicalVehicleKey = req.params.canonicalVehicleKey;
  try {
    const profile = await ensureProfile(req);
    const [vehicle] = await db
      .select()
      .from(ownedVehiclesTable)
      .where(and(eq(ownedVehiclesTable.profileId, profile.id), eq(ownedVehiclesTable.canonicalVehicleKey, canonicalVehicleKey)));
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    const cost = repairCost(vehicle);
    if (cost <= 0) {
      res.json({ profile: formatProfile(profile), vehicle: formatVehicle(vehicle), repairCost: 0, garage: await garageResponse(req) });
      return;
    }
    if (profile.credits < cost) {
      res.status(400).json({ error: "Not enough credits", repairCost: cost, profile: formatProfile(profile) });
      return;
    }
    const [updatedProfile] = await db
      .update(playerProfilesTable)
      .set({ credits: profile.credits - cost })
      .where(eq(playerProfilesTable.id, profile.id))
      .returning();
    const [updated] = await db
      .update(ownedVehiclesTable)
      .set({ condition: 100 })
      .where(eq(ownedVehiclesTable.id, vehicle.id))
      .returning();
    res.json({ profile: formatProfile(updatedProfile), vehicle: formatVehicle(updated), repairCost: cost, garage: await garageResponse(req) });
  } catch {
    const store = localStore(req);
    const garage = store.garage();
    const vehicle = garage.vehicles.find((item) => item.canonicalVehicleKey === canonicalVehicleKey);
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    const cost = economyRepairCost(vehicle.condition, vehicle.power);
    const result = store.repairVehicle(canonicalVehicleKey, cost);
    if (!result) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    if ("error" in result) {
      res.status(400).json({ ...result, repairCost: cost });
      return;
    }
    res.json({ ...result, repairCost: cost, garage: store.garage() });
  }
});

router.patch("/garage/vehicles/:canonicalVehicleKey/upgrades", async (req, res): Promise<void> => {
  const canonicalVehicleKey = req.params.canonicalVehicleKey;
  const parsed = upgradesPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const profile = await ensureProfile(req);
    if (profile.credits + parsed.data.creditsDelta < 0) {
      res.status(400).json({ error: "Not enough credits" });
      return;
    }
    const [updatedProfile] = await db
      .update(playerProfilesTable)
      .set({ credits: profile.credits + parsed.data.creditsDelta })
      .where(eq(playerProfilesTable.id, profile.id))
      .returning();
    const [updated] = await db
      .update(ownedVehiclesTable)
      .set({ upgradesJson: parsed.data.upgrades, upgradeSpend: parsed.data.spent })
      .where(and(eq(ownedVehiclesTable.profileId, profile.id), eq(ownedVehiclesTable.canonicalVehicleKey, canonicalVehicleKey)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json({ profile: formatProfile(updatedProfile), vehicle: formatVehicle(updated), garage: await garageResponse(req) });
  } catch {
    const store = localStore(req);
    const profile = store.changeCredits(parsed.data.creditsDelta);
    const updated = store.patchVehicle(canonicalVehicleKey, { upgrades: parsed.data.upgrades, upgradeSpend: parsed.data.spent });
    if (!updated) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json({ profile, vehicle: updated, garage: store.garage() });
  }
});

router.patch("/garage/vehicles/:canonicalVehicleKey/tuning", async (req, res): Promise<void> => {
  const canonicalVehicleKey = req.params.canonicalVehicleKey;
  const parsed = tuningPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const profile = await ensureProfile(req);
    if (profile.credits + parsed.data.creditsDelta < 0) {
      res.status(400).json({ error: "Not enough credits" });
      return;
    }
    const [updatedProfile] = await db
      .update(playerProfilesTable)
      .set({ credits: profile.credits + parsed.data.creditsDelta })
      .where(eq(playerProfilesTable.id, profile.id))
      .returning();
    const [updated] = await db
      .update(ownedVehiclesTable)
      .set({ tuningJson: parsed.data.tuning })
      .where(and(eq(ownedVehiclesTable.profileId, profile.id), eq(ownedVehiclesTable.canonicalVehicleKey, canonicalVehicleKey)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json({ profile: formatProfile(updatedProfile), vehicle: formatVehicle(updated), garage: await garageResponse(req) });
  } catch {
    const store = localStore(req);
    const profile = store.changeCredits(parsed.data.creditsDelta);
    const updated = store.patchVehicle(canonicalVehicleKey, { tuning: parsed.data.tuning });
    if (!updated) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    res.json({ profile, vehicle: updated, garage: store.garage() });
  }
});

router.post("/garage/drag-race/complete", async (req, res): Promise<void> => {
  const parsed = raceCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const profile = await ensureProfile(req);
    const [vehicle] = await db
      .select()
      .from(ownedVehiclesTable)
      .where(and(eq(ownedVehiclesTable.profileId, profile.id), eq(ownedVehiclesTable.canonicalVehicleKey, parsed.data.canonicalVehicleKey)));
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    const rewardCredits = parsed.data.won ? parsed.data.rewardCredits : 0;
    const [updatedProfile] = await db
      .update(playerProfilesTable)
      .set({ credits: profile.credits + rewardCredits })
      .where(eq(playerProfilesTable.id, profile.id))
      .returning();
    const [race] = await db
      .insert(garageRaceHistoryTable)
      .values({
        profileId: profile.id,
        ownedVehicleId: vehicle.id,
        canonicalVehicleKey: parsed.data.canonicalVehicleKey,
        opponentKey: parsed.data.opponentKey,
        opponentName: parsed.data.opponentName,
        elapsedMs: parsed.data.elapsedMs,
        opponentElapsedMs: parsed.data.opponentElapsedMs,
        trapSpeed: parsed.data.trapSpeed,
        won: parsed.data.won ? 1 : 0,
        rewardCredits,
        breakdownJson: parsed.data.breakdown ?? {},
      })
      .returning();
    res.status(201).json({ profile: formatProfile(updatedProfile), race: formatRace(race), garage: await garageResponse(req) });
  } catch {
    const rewardCredits = parsed.data.won ? parsed.data.rewardCredits : 0;
    const store = localStore(req);
    const result = store.recordRace({
      ownedVehicleId: null,
      canonicalVehicleKey: parsed.data.canonicalVehicleKey,
      opponentKey: parsed.data.opponentKey,
      opponentName: parsed.data.opponentName,
      elapsedMs: parsed.data.elapsedMs,
      opponentElapsedMs: parsed.data.opponentElapsedMs,
      trapSpeed: parsed.data.trapSpeed,
      won: parsed.data.won,
      rewardCredits,
      breakdown: parsed.data.breakdown ?? {},
    });
    res.status(201).json({ ...result, garage: store.garage() });
  }
});

router.get("/garage/drag-race/leaderboard", async (req, res): Promise<void> => {
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit = parseInt(typeof rawLimit === "string" ? rawLimit : "", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 25;
  const mineOnly = req.query.scope === "mine";

  try {
    const profile = mineOnly ? await ensureProfile(req) : null;
    const rows = await db
      .select({ race: garageRaceHistoryTable, profile: playerProfilesTable })
      .from(garageRaceHistoryTable)
      .leftJoin(playerProfilesTable, eq(garageRaceHistoryTable.profileId, playerProfilesTable.id))
      .where(mineOnly && profile ? and(eq(garageRaceHistoryTable.profileId, profile.id), eq(garageRaceHistoryTable.won, 1)) : eq(garageRaceHistoryTable.won, 1))
      .orderBy(asc(garageRaceHistoryTable.elapsedMs), desc(garageRaceHistoryTable.createdAt))
      .limit(limit);

    res.json(rows.map((row) => formatDragLeaderboardEntry(row.race, row.profile)));
  } catch {
    const garage = localStore(req).garage();
    const rows = garage.raceHistory
      .filter((race) => race.won)
      .sort((a, b) => a.elapsedMs - b.elapsedMs || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((race) => ({
        ...race,
        driverName: garage.profile.name,
      }));
    res.json(rows);
  }
});

export default router;
