import type { ActiveExam } from "./types";

const ACTIVE_KEY = "uny-cbt:active-exam";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Only the active in-progress exam stays in localStorage — it is ephemeral
 * per-session state, not durable progress. History/results/wrong-answers
 * live in the database (see @workspace/api-client-react hooks) so they
 * survive across devices/browsers for the same anonymous device id.
 */
export function getActiveExam(): ActiveExam | null {
  if (typeof window === "undefined") return null;
  return safeParse<ActiveExam | null>(localStorage.getItem(ACTIVE_KEY), null);
}

export function saveActiveExam(exam: ActiveExam) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(exam));
}

export function clearActiveExam() {
  localStorage.removeItem(ACTIVE_KEY);
}
