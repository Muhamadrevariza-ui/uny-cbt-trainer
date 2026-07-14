import { Router, type IRouter } from "express";
import { db, wrongAnswers } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAnonUser } from "../../middlewares/anon.js";

const router: IRouter = Router();

// GET /api/wrong-answers
router.get("/wrong-answers", requireAnonUser, async (req, res, next) => {
  try {
    const anonUserId = req.anonUserId!;
    const rows = await db
      .select()
      .from(wrongAnswers)
      .where(eq(wrongAnswers.anonymousUserId, anonUserId))
      .orderBy(desc(wrongAnswers.lastMissedAt));
    res.json(
      rows.map((r) => ({
        questionId: r.questionId,
        timesMissed: r.timesMissed,
        lastMissedAt: r.lastMissedAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
