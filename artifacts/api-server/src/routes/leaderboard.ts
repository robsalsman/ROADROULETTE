import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, leaderboardTable, gameSavesTable, charactersTable, missionsTable } from "@workspace/db";
import { localGameStore } from "../lib/local-game-store";
import {
  CreateLeaderboardEntryBody,
  ListLeaderboardResponse,
  ListLeaderboardResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatEntry(e: typeof leaderboardTable.$inferSelect) {
  return {
    id: e.id,
    saveId: e.saveId,
    playerName: e.playerName,
    characterSlug: e.characterSlug,
    missionTitle: e.missionTitle,
    score: e.score,
    distance: e.distance,
    createdAt: e.createdAt.toISOString(),
  };
}

// ── List leaderboard (top scores) ─────────────────────────────────────────────
router.get("/leaderboard", async (req, res): Promise<void> => {
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsed = parseInt(typeof rawLimit === "string" ? rawLimit : "", 10);
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 25;

  try {
    const entries = await db
      .select()
      .from(leaderboardTable)
      .orderBy(desc(leaderboardTable.score), desc(leaderboardTable.createdAt))
      .limit(limit);

    res.json(ListLeaderboardResponse.parse(entries.map(formatEntry)));
  } catch {
    res.json(ListLeaderboardResponse.parse(localGameStore.leaderboard(limit)));
  }
});

// ── Submit a score ────────────────────────────────────────────────────────────
router.post("/leaderboard", async (req, res): Promise<void> => {
  const parsed = CreateLeaderboardEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // A saveId is required so the score can be verified against authoritative
  // server-side game state — this prevents clients forging arbitrary scores.
  if (parsed.data.saveId == null) {
    res.status(400).json({ error: "saveId is required to submit a score" });
    return;
  }

  try {
    const [save] = await db
      .select()
      .from(gameSavesTable)
      .where(eq(gameSavesTable.id, parsed.data.saveId));
    if (!save) {
      res.status(404).json({ error: "Save not found" });
      return;
    }

    const [character] = save.characterId != null
      ? await db
          .select()
          .from(charactersTable)
          .where(eq(charactersTable.id, save.characterId))
      : [];
    const [mission] = await db
      .select()
      .from(missionsTable)
      .where(eq(missionsTable.id, save.missionId));

    // Trust the canonical save for score/distance/character/mission; only the
    // player's display name comes from the client.
    const [entry] = await db
      .insert(leaderboardTable)
      .values({
        saveId: save.id,
        playerName: parsed.data.playerName.slice(0, 40),
        characterSlug: character?.slug ?? parsed.data.characterSlug,
        missionTitle: mission?.title ?? parsed.data.missionTitle,
        score: save.score,
        distance: save.distanceTravelled,
      })
      .returning();

    res.status(201).json(ListLeaderboardResponseItem.parse(formatEntry(entry)));
  } catch {
    const entry = localGameStore.addLeaderboardEntry(parsed.data as {
      saveId: number;
      playerName: string;
      characterSlug: string;
      missionTitle: string;
    });
    if (!entry) {
      res.status(404).json({ error: "Save not found" });
      return;
    }
    res.status(201).json(ListLeaderboardResponseItem.parse(entry));
  }
});

export default router;
