import { Router, type IRouter } from "express";
import healthRouter from "./health";
import charactersRouter from "./characters";
import missionsRouter from "./missions";
import savesRouter from "./saves";
import banterRouter from "./banter";
import leaderboardRouter from "./leaderboard";
import openaiRouter from "./openai";
import seriesRouter from "./series";
import garageRouter from "./garage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(charactersRouter);
router.use(missionsRouter);
router.use(savesRouter);
router.use(banterRouter);
router.use(leaderboardRouter);
router.use(openaiRouter);
router.use(seriesRouter);
router.use(garageRouter);

export default router;
