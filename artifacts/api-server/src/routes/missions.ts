import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, missionsTable, carsTable, challengesTable } from "@workspace/db";
import {
  GetMissionParams,
  ListMissionsResponse,
  GetMissionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/missions", async (_req, res): Promise<void> => {
  const missions = await db.select().from(missionsTable).orderBy(missionsTable.id);
  res.json(ListMissionsResponse.parse(missions));
});

router.get("/missions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const params = GetMissionParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, id));
  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }

  const availableCars = await db.select().from(carsTable).where(eq(carsTable.missionId, id));
  const challenges = await db.select().from(challengesTable).where(eq(challengesTable.missionId, id));

  const formattedCars = availableCars.map((c) => ({
    id: c.id,
    name: c.name,
    year: c.year,
    price: c.price,
    reliability: c.reliability,
    power: c.power,
    offRoad: c.offRoad,
    description: c.description,
  }));

  res.json(
    GetMissionResponse.parse({
      ...mission,
      availableCars: formattedCars,
      challenges: challenges.map((ch) => ({
        id: ch.id,
        title: ch.title,
        type: ch.type,
        description: ch.description,
      })),
    })
  );
});

export default router;
