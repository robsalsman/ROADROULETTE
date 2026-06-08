import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, charactersTable } from "@workspace/db";
import {
  GetCharacterParams,
  ListCharactersResponse,
  GetCharacterResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatCharacter(c: typeof charactersTable.$inferSelect) {
  const stats = c.statsJson as { confidence: number; mechanical: number; navigation: number; budget: number };
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    personality: c.personality,
    stats,
  };
}

router.get("/characters", async (_req, res): Promise<void> => {
  const chars = await db.select().from(charactersTable).orderBy(charactersTable.id);
  res.json(ListCharactersResponse.parse(chars.map(formatCharacter)));
});

router.get("/characters/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const params = GetCharacterParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, id));
  if (!char) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  res.json(GetCharacterResponse.parse(formatCharacter(char)));
});

export default router;
