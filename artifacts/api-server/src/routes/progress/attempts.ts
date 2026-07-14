import { Router, type IRouter } from "express";
import { db, attempts, tryoutSets, wrongAnswers, type Attempt } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { CreateAttemptBody } from "@workspace/api-zod";
import { requireAnonUser } from "../../middlewares/anon.js";

const router: IRouter = Router();

function serialize(a: Attempt, tryoutSetCode: string | null) {
  return {
    id: a.id,
    mode: a.mode,
    tryoutSetCode,
    title: a.title,
    totalQuestions: a.totalQuestions,
    correct: a.correct,
    incorrect: a.incorrect,
    unanswered: a.unanswered,
    score: a.score,
    accuracy: a.accuracy,
    timeUsedSec: a.timeUsedSec,
    durationSec: a.durationSec,
    sections: a.sections,
    questions: a.questions,
    completedAt: a.completedAt.toISOString(),
  };
}

// GET /api/attempts
router.get("/attempts", requireAnonUser, async (req, res, next) => {
  try {
    const anonUserId = req.anonUserId!;
    const rows = await db
      .select()
      .from(attempts)
      .where(eq(attempts.anonymousUserId, anonUserId))
      .orderBy(attempts.completedAt);

    const setIds = [...new Set(rows.map((r) => r.tryoutSetId).filter((x): x is number => x != null))];
    const setsById = new Map<number, string>();
    if (setIds.length) {
      const sets = await db.select().from(tryoutSets).where(inArray(tryoutSets.id, setIds));
      for (const s of sets) setsById.set(s.id, s.code);
    }

    res.json(rows.map((r) => serialize(r, r.tryoutSetId != null ? (setsById.get(r.tryoutSetId) ?? null) : null)));
  } catch (err) {
    next(err);
  }
});

// GET /api/attempts/:id
router.get("/attempts/:id", requireAnonUser, async (req, res, next) => {
  try {
    const anonUserId = req.anonUserId!;
    const [row] = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.id, String(req.params.id)), eq(attempts.anonymousUserId, anonUserId)))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }
    let code: string | null = null;
    if (row.tryoutSetId != null) {
      const [s] = await db.select().from(tryoutSets).where(eq(tryoutSets.id, row.tryoutSetId)).limit(1);
      code = s ? s.code : null;
    }
    res.json(serialize(row, code));
  } catch (err) {
    next(err);
  }
});

// POST /api/attempts
router.post("/attempts", requireAnonUser, async (req, res, next) => {
  const parsed = CreateAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const anonUserId = req.anonUserId!;
    const input = parsed.data;

    let tryoutSetId: number | null = null;
    if (input.tryoutSetCode) {
      const [s] = await db.select().from(tryoutSets).where(eq(tryoutSets.code, input.tryoutSetCode)).limit(1);
      tryoutSetId = s ? s.id : null;
    }

    const values = {
      mode: input.mode,
      tryoutSetId,
      title: input.title,
      totalQuestions: input.totalQuestions,
      correct: input.correct,
      incorrect: input.incorrect,
      unanswered: input.unanswered,
      score: input.score,
      accuracy: input.accuracy,
      timeUsedSec: input.timeUsedSec,
      durationSec: input.durationSec,
      sections: input.sections,
      questions: input.questions,
    };

    const [saved] = await db
      .insert(attempts)
      .values({ id: input.id, anonymousUserId: anonUserId, ...values })
      .onConflictDoUpdate({ target: attempts.id, set: values })
      .returning();

    // Maintain the wrong-answer bank from this attempt's results.
    const wrongIds = input.questions.filter((q) => !q.isCorrect).map((q) => q.question.id);
    const correctIds = input.questions.filter((q) => q.isCorrect).map((q) => q.question.id);

    if (correctIds.length) {
      await db
        .delete(wrongAnswers)
        .where(and(eq(wrongAnswers.anonymousUserId, anonUserId), inArray(wrongAnswers.questionId, correctIds)));
    }
    for (const qid of wrongIds) {
      await db
        .insert(wrongAnswers)
        .values({ anonymousUserId: anonUserId, questionId: qid, timesMissed: 1 })
        .onConflictDoUpdate({
          target: [wrongAnswers.anonymousUserId, wrongAnswers.questionId],
          set: { timesMissed: sql`${wrongAnswers.timesMissed} + 1`, lastMissedAt: new Date() },
        });
    }

    if (!saved) {
      res.status(500).json({ error: "Gagal menyimpan hasil ujian." });
      return;
    }
    res.json(serialize(saved, input.tryoutSetCode ?? null));
  } catch (err) {
    next(err);
  }
});

export default router;
