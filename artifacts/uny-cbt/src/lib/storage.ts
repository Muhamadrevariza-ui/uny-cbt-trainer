import type { ActiveExam, ExamResult } from "./types";

const HISTORY_KEY = "uny-cbt:history";
const ACTIVE_KEY = "uny-cbt:active-exam";
const WRONG_KEY = "uny-cbt:wrong-ids";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getHistory(): ExamResult[] {
  if (typeof window === "undefined") return [];
  return safeParse<ExamResult[]>(localStorage.getItem(HISTORY_KEY), []);
}

export function saveResult(result: ExamResult) {
  const history = getHistory();
  history.push(result);
  // keep at most 50 results
  const trimmed = history.slice(-50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function getResult(id: string): ExamResult | undefined {
  return getHistory().find((r) => r.id === id);
}

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

export function getWrongIds(): string[] {
  if (typeof window === "undefined") return [];
  return safeParse<string[]>(localStorage.getItem(WRONG_KEY), []);
}

/** After an exam: add newly-wrong ids, remove ids answered correctly. */
export function updateWrongIds(wrong: string[], correct: string[]) {
  const set = new Set(getWrongIds());
  for (const id of correct) set.delete(id);
  for (const id of wrong) set.add(id);
  localStorage.setItem(WRONG_KEY, JSON.stringify([...set]));
}
