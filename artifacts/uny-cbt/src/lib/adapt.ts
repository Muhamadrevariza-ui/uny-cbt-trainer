import type { Attempt } from "@workspace/api-client-react";
import type { ExamResult, SectionId, SectionStats } from "./types";

/**
 * Adapts a server-side `Attempt` (DB-backed) into the frontend's
 * `ExamResult` shape so existing analysis/aggregation code (which was
 * written against localStorage history) keeps working unchanged.
 */
export function attemptToExamResult(a: Attempt): ExamResult {
  return {
    id: a.id,
    mode: a.mode as ExamResult["mode"],
    title: a.title,
    date: new Date(a.completedAt).getTime(),
    totalQuestions: a.totalQuestions,
    correct: a.correct,
    incorrect: a.incorrect,
    unanswered: a.unanswered,
    score: a.score,
    accuracy: a.accuracy,
    timeUsedSec: a.timeUsedSec,
    durationSec: a.durationSec,
    sections: a.sections as Partial<Record<SectionId, SectionStats>>,
    questions: a.questions as ExamResult["questions"],
  };
}
