import { Router, type IRouter } from "express";
import { db, examFormats } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/exam-formats
router.get("/exam-formats", async (req, res, next) => {
  try {
    const rows = await db.select().from(examFormats).where(eq(examFormats.status, "active"));
    res.json(
      rows.map((f) => ({
        id: f.id,
        code: f.code,
        label: f.label,
        description: f.description,
        sections: f.sections,
        totalQuestions: f.totalQuestions,
        totalDurationSeconds: f.totalDurationSeconds,
        sourceNotes: f.sourceNotes,
        status: f.status,
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
