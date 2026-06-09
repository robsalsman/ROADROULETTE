import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gameSavesTable, roadEventsTable, charactersTable, missionsTable } from "@workspace/db";
import { localGameStore } from "../lib/local-game-store";
import {
  CreateSaveBody,
  GetSaveParams,
  UpdateSaveParams,
  UpdateSaveBody,
  DeleteSaveParams,
  ListSaveEventsParams,
  RecordSaveEventParams,
  RecordSaveEventBody,
  ListSavesResponse,
  GetSaveResponse,
  UpdateSaveResponse,
  ListSaveEventsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatSave(s: typeof gameSavesTable.$inferSelect) {
  return {
    id: s.id,
    characterId: s.characterId,
    missionId: s.missionId,
    status: s.status,
    mode: s.mode,
    playerName: s.playerName,
    seriesStageIndex: s.seriesStageIndex,
    funds: s.funds,
    carId: s.carId,
    food: s.food,
    parts: s.parts,
    camaraderie: s.camaraderie,
    distanceTravelled: s.distanceTravelled,
    score: s.score,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function isSerializedSave(save: unknown): save is ReturnType<typeof localGameStore.save> & { createdAt: string } {
  return !!save && typeof (save as { createdAt?: unknown }).createdAt === "string";
}

// ── List saves ────────────────────────────────────────────────────────────────
router.get("/saves", async (_req, res): Promise<void> => {
  try {
    const saves = await db.select().from(gameSavesTable).orderBy(gameSavesTable.updatedAt);
    res.json(ListSavesResponse.parse(saves.map(formatSave)));
  } catch {
    res.json(ListSavesResponse.parse(localGameStore.saves()));
  }
});

// ── Create save ───────────────────────────────────────────────────────────────
router.post("/saves", async (req, res): Promise<void> => {
  const parsed = CreateSaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    // Look up starting budget from character (arcade). Series players have no preset character.
    let budget = 1500;
    if (parsed.data.characterId != null) {
      const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, parsed.data.characterId));
      const stats = (char?.statsJson ?? { budget: 1500 }) as { budget: number };
      budget = stats.budget ?? 1500;
    }

    const [save] = await db
      .insert(gameSavesTable)
      .values({
        characterId: parsed.data.characterId ?? null,
        missionId: parsed.data.missionId,
        status: "car_selection",
        mode: parsed.data.mode ?? "arcade",
        playerName: parsed.data.playerName ?? null,
        seriesStageIndex: parsed.data.seriesStageIndex ?? 0,
        funds: budget,
        food: 3,
        parts: 2,
      })
      .returning();

    res.status(201).json(GetSaveResponse.parse(formatSave(save)));
  } catch {
    const save = localGameStore.createSave(parsed.data);
    res.status(201).json(GetSaveResponse.parse(save));
  }
});

// ── Get save ──────────────────────────────────────────────────────────────────
router.get("/saves/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const params = GetSaveParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let save: ReturnType<typeof localGameStore.save> | typeof gameSavesTable.$inferSelect | undefined;
  try {
    [save] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.id, id));
  } catch {
    save = localGameStore.save(id);
  }
  if (!save) {
    res.status(404).json({ error: "Save not found" });
    return;
  }

  res.json(GetSaveResponse.parse(isSerializedSave(save) ? save : formatSave(save)));
});

// ── Update save ───────────────────────────────────────────────────────────────
router.patch("/saves/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const params = UpdateSaveParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let save: ReturnType<typeof localGameStore.updateSave> | typeof gameSavesTable.$inferSelect | undefined;
  try {
    [save] = await db
      .update(gameSavesTable)
      .set(parsed.data)
      .where(eq(gameSavesTable.id, id))
      .returning();
  } catch {
    save = localGameStore.updateSave(id, parsed.data);
  }

  if (!save) {
    res.status(404).json({ error: "Save not found" });
    return;
  }

  res.json(UpdateSaveResponse.parse(isSerializedSave(save) ? save : formatSave(save)));
});

// ── Delete save ───────────────────────────────────────────────────────────────
router.delete("/saves/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const params = DeleteSaveParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    await db.delete(gameSavesTable).where(eq(gameSavesTable.id, id));
  } catch {
    localGameStore.deleteSave(id);
  }
  res.sendStatus(204);
});

// ── List save events ──────────────────────────────────────────────────────────
router.get("/saves/:saveId/events", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.saveId) ? req.params.saveId[0] : req.params.saveId;
  const saveId = parseInt(raw, 10);
  const params = ListSaveEventsParams.safeParse({ saveId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const events = await db
      .select()
      .from(roadEventsTable)
      .where(eq(roadEventsTable.saveId, saveId))
      .orderBy(roadEventsTable.createdAt);

    res.json(
      ListSaveEventsResponse.parse(
        events.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        }))
      )
    );
  } catch {
    res.json(ListSaveEventsResponse.parse(localGameStore.events(saveId)));
  }
});

// ── Record save event ─────────────────────────────────────────────────────────
router.post("/saves/:saveId/events", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.saveId) ? req.params.saveId[0] : req.params.saveId;
  const saveId = parseInt(raw, 10);
  const params = RecordSaveEventParams.safeParse({ saveId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = RecordSaveEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [event] = await db
      .insert(roadEventsTable)
      .values({ saveId, ...parsed.data })
      .returning();

    res.status(201).json({
      ...event,
      createdAt: event.createdAt.toISOString(),
    });
  } catch {
    res.status(201).json(localGameStore.recordEvent(saveId, parsed.data));
  }
});

export default router;
