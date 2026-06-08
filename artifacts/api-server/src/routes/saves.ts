import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gameSavesTable, roadEventsTable, charactersTable, missionsTable } from "@workspace/db";
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

// ── List saves ────────────────────────────────────────────────────────────────
router.get("/saves", async (_req, res): Promise<void> => {
  const saves = await db.select().from(gameSavesTable).orderBy(gameSavesTable.updatedAt);
  res.json(ListSavesResponse.parse(saves.map(formatSave)));
});

// ── Create save ───────────────────────────────────────────────────────────────
router.post("/saves", async (req, res): Promise<void> => {
  const parsed = CreateSaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

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

  const [save] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.id, id));
  if (!save) {
    res.status(404).json({ error: "Save not found" });
    return;
  }

  res.json(GetSaveResponse.parse(formatSave(save)));
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

  const [save] = await db
    .update(gameSavesTable)
    .set(parsed.data)
    .where(eq(gameSavesTable.id, id))
    .returning();

  if (!save) {
    res.status(404).json({ error: "Save not found" });
    return;
  }

  res.json(UpdateSaveResponse.parse(formatSave(save)));
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

  await db.delete(gameSavesTable).where(eq(gameSavesTable.id, id));
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

  const [event] = await db
    .insert(roadEventsTable)
    .values({ saveId, ...parsed.data })
    .returning();

  res.status(201).json({
    ...event,
    createdAt: event.createdAt.toISOString(),
  });
});

export default router;
