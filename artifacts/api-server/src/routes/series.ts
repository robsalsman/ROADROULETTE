import { Router, type IRouter } from "express";
import { GRAND_TOUR_EPISODE_STAGES } from "../data/grand-tour-episode-stages";

const router: IRouter = Router();

router.get("/series/stages", (_req, res): void => {
  res.json({
    count: GRAND_TOUR_EPISODE_STAGES.length,
    stages: GRAND_TOUR_EPISODE_STAGES,
  });
});

export default router;
