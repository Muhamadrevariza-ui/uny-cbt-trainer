import { Router, type IRouter } from "express";
import { db, tryoutSets, tryoutSetItems, examFormats, attempts } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAnonUser } from "../../middlewares/anon.js";

const router: IRouter = Router();

// GET /api/tryout-sets
router.get("/tryout-sets", requireAnonUser, async (req, res, next) => {
  try {
    const anonUserId = req.anonUserId!;
    const sets = await db
      .select({ set: tryoutSets, format: examFormats })
      .from(tryoutSets)
      .innerJoin(examFormats, eq(tryoutSets.examFormatId, examFormats.id))
      .where(eq(tryoutSets.isPublished, true))
      .orderBy(tryoutSets.orderIndex);

    const result = [];
    for (const { set, format } of sets) {
      const userAttempts = await db
        .select()
        .from(attempts)
        .where(and(eq(attempts.tryoutSetId, set.id), eq(attempts.anonymousUserId, anonUserId)))
        .orderBy(desc(attempts.completedAt));

      const bestScore = userAttempts.length ? Math.max(...userAttempts.map((a) => a.score)) : null;
      const last = userAttempts[0];

      result.push({
        id: set.id,
        code: set.code,
        label: set.label,
        description: set.description,
        examFormat: {
          id: format.id,
          code: format.code,
          label: format.label,
          description: format.description,
          sections: format.sections,
          totalQuestions: format.totalQuestions,
          totalDurationSeconds: format.totalDurationSeconds,
          sourceNotes: format.sourceNotes,
          status: format.status,
        },
        progress: {
          status: userAttempts.length > 0 ? "selesai" : "belum",
          bestScore,
          attemptsCount: userAttempts.length,
          lastAttemptId: last ? last.id : null,
          lastCompletedAt: last ? last.completedAt.toISOString() : null,
        },
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/tryout-sets/:code/items
router.get("/tryout-sets/:code/items", async (req, res, next) => {
  try {
    const { code } = req.params;
    const [set] = await db.select().from(tryoutSets).where(eq(tryoutSets.code, code)).limit(1);
    if (!set) {
      res.status(404).json({ error: "Tryout set not found" });
      return;
    }
    const items = await db
      .select()
      .from(tryoutSetItems)
      .where(eq(tryoutSetItems.tryoutSetId, set.id))
      .orderBy(tryoutSetItems.orderIndex);
    res.json(
      items.map((i) => ({
        questionId: i.questionId,
        sectionId: i.sectionId,
        subskill: i.subskill,
        difficulty: i.difficulty,
        orderIndex: i.orderIndex,
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
