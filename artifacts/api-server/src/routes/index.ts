import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai/index.js";
import examFormatsRouter from "./progress/exam-formats.js";
import tryoutSetsRouter from "./progress/tryout-sets.js";
import attemptsRouter from "./progress/attempts.js";
import wrongAnswersRouter from "./progress/wrong-answers.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use(examFormatsRouter);
router.use(tryoutSetsRouter);
router.use(attemptsRouter);
router.use(wrongAnswersRouter);

export default router;
