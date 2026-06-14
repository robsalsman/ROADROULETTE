import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, missionsTable, carsTable, challengesTable } from "@workspace/db";
import { missionBudget, vehiclePrice, type EconomyVehicleInput } from "@workspace/economy";
import { localGameStore } from "../lib/local-game-store";
import {
  GetMissionParams,
  ListMissionsResponse,
  GetMissionResponse,
} from "@workspace/api-zod";
import { GRAND_TOUR_EPISODE_COUNT } from "../data/grand-tour-episode-stages";

const router: IRouter = Router();

function formatMission(mission: typeof missionsTable.$inferSelect) {
  return {
    ...mission,
    budget: missionBudget(mission.id),
  };
}

function normalizedCarPrice(
  car: typeof carsTable.$inferSelect,
  mission: Pick<typeof missionsTable.$inferSelect, "id" | "difficulty">,
  optionIndex: number,
): number {
  return vehiclePrice({
    name: car.name,
    reliability: car.reliability,
    power: car.power,
    offRoad: car.offRoad,
    difficulty: mission.difficulty as EconomyVehicleInput["difficulty"],
    episodeNumber: mission.id,
    optionIndex,
  });
}

router.get("/missions", async (_req, res): Promise<void> => {
  try {
    const missions = await db.select().from(missionsTable).orderBy(missionsTable.id);
    res.json(ListMissionsResponse.parse(missions.length >= GRAND_TOUR_EPISODE_COUNT ? missions.map(formatMission) : localGameStore.missions()));
  } catch {
    res.json(ListMissionsResponse.parse(localGameStore.missions()));
  }
});

router.get("/missions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const params = GetMissionParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const allMissions = await db.select().from(missionsTable).orderBy(missionsTable.id);
    if (allMissions.length < GRAND_TOUR_EPISODE_COUNT) {
      const fallbackMission = localGameStore.missionDetail(id);
      if (!fallbackMission) {
        res.status(404).json({ error: "Mission not found" });
        return;
      }
      res.json(GetMissionResponse.parse(fallbackMission));
      return;
    }

    const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, id));
    if (!mission) {
      const fallbackMission = localGameStore.missionDetail(id);
      if (!fallbackMission) {
        res.status(404).json({ error: "Mission not found" });
        return;
      }
      res.json(GetMissionResponse.parse(fallbackMission));
      return;
    }

    const availableCars = await db.select().from(carsTable).where(eq(carsTable.missionId, id));
    const challenges = await db.select().from(challengesTable).where(eq(challengesTable.missionId, id));

    const formattedCars = availableCars.map((c, index) => ({
      id: c.id,
      name: c.name,
      year: c.year,
      price: normalizedCarPrice(c, mission, index),
      reliability: c.reliability,
      power: c.power,
      offRoad: c.offRoad,
      description: c.description,
    }));

    res.json(
      GetMissionResponse.parse({
        ...formatMission(mission),
        availableCars: formattedCars,
        challenges: challenges.map((ch) => ({
          id: ch.id,
          title: ch.title,
          type: ch.type,
          description: ch.description,
        })),
      })
    );
    return;
  } catch {
    const mission = localGameStore.missionDetail(id);
    if (!mission) {
      res.status(404).json({ error: "Mission not found" });
      return;
    }

    res.json(GetMissionResponse.parse(mission));
    return;
  }
});

export default router;
