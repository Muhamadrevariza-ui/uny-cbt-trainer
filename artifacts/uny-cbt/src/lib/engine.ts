import { QUESTIONS } from "../data/questions";
import type {
  ActiveExam,
  Difficulty,
  ExamConfig,
  ExamResult,
  Question,
  QuestionResult,
  SectionId,
  SectionStats,
} from "./types";

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export type DifficultyFilter = Difficulty | "campuran";

/**
 * Pick `count` questions from a section without duplicates.
 * With no `difficulty` filter (or "campuran"), questions are spread evenly
 * across difficulties, as before. With a specific difficulty, only
 * questions of that difficulty are picked.
 */
export function pickFromSection(
  section: SectionId,
  count: number,
  subskill?: string,
  difficulty?: DifficultyFilter,
): Question[] {
  let pool = QUESTIONS.filter((q) => q.section === section);
  if (subskill) pool = pool.filter((q) => q.subskill === subskill);

  if (difficulty && difficulty !== "campuran") {
    return shuffle(pool.filter((q) => q.difficulty === difficulty)).slice(0, count);
  }

  const byDiff: Record<Difficulty, Question[]> = {
    mudah: shuffle(pool.filter((q) => q.difficulty === "mudah")),
    sedang: shuffle(pool.filter((q) => q.difficulty === "sedang")),
    sulit: shuffle(pool.filter((q) => q.difficulty === "sulit")),
  };
  const picked: Question[] = [];
  const order: Difficulty[] = ["mudah", "sedang", "sulit"];
  let i = 0;
  while (picked.length < count && (byDiff.mudah.length || byDiff.sedang.length || byDiff.sulit.length)) {
    const d = order[i % 3];
    const q = byDiff[d].pop();
    if (q) picked.push(q);
    i++;
    if (i > count * 6) break;
  }
  return picked.slice(0, count);
}

export function difficultyDistribution(questions: Question[]): Record<Difficulty, number> {
  const dist: Record<Difficulty, number> = { mudah: 0, sedang: 0, sulit: 0 };
  for (const q of questions) dist[q.difficulty]++;
  return dist;
}

function shuffleOptions(q: Question): Question {
  const idx = shuffle([0, 1, 2, 3, 4].slice(0, q.options.length));
  const options = idx.map((i) => q.options[i]);
  const correctAnswer = idx.indexOf(q.correctAnswer);
  return { ...q, options, correctAnswer };
}

export function createActiveExam(config: ExamConfig): ActiveExam {
  const seen = new Set<string>();
  const base: Question[] = [];
  for (const id of config.questionIds) {
    if (seen.has(id)) continue;
    const q = getQuestionById(id);
    if (q) {
      base.push(q);
      seen.add(id);
    }
  }
  const ordered = shuffle(base).map((q) => (config.shuffleOptions ? shuffleOptions(q) : q));
  const now = Date.now();
  return {
    id: `exam-${now}`,
    mode: config.mode,
    title: config.title,
    questions: ordered,
    durationSec: config.durationSec,
    startedAt: now,
    endsAt: now + config.durationSec * 1000,
    answers: ordered.map(() => null),
    doubtful: ordered.map(() => false),
    timeSpent: ordered.map(() => 0),
    currentIndex: 0,
    tryoutSetCode: config.tryoutSetCode,
  };
}

export function scoreExam(exam: ActiveExam): ExamResult {
  const questions: QuestionResult[] = exam.questions.map((q, i) => ({
    question: q,
    userAnswer: exam.answers[i],
    isCorrect: exam.answers[i] === q.correctAnswer,
    doubtful: exam.doubtful[i],
    timeSpent: exam.timeSpent[i],
  }));

  const correct = questions.filter((r) => r.isCorrect).length;
  const unanswered = questions.filter((r) => r.userAnswer === null).length;
  const incorrect = questions.length - correct - unanswered;

  const sections: Partial<Record<SectionId, SectionStats>> = {};
  for (const r of questions) {
    const s = r.question.section;
    const stat =
      sections[s] ??
      (sections[s] = { total: 0, correct: 0, incorrect: 0, unanswered: 0, accuracy: 0, avgTime: 0 });
    stat.total++;
    if (r.userAnswer === null) stat.unanswered++;
    else if (r.isCorrect) stat.correct++;
    else stat.incorrect++;
    stat.avgTime += r.timeSpent;
  }
  for (const s of Object.values(sections)) {
    s.avgTime = s.total ? Math.round(s.avgTime / s.total) : 0;
    s.accuracy = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  }

  const timeUsedSec = Math.min(
    exam.durationSec,
    Math.round((Date.now() - exam.startedAt) / 1000),
  );

  const result: ExamResult = {
    id: exam.id,
    mode: exam.mode,
    title: exam.title,
    date: Date.now(),
    totalQuestions: questions.length,
    correct,
    incorrect,
    unanswered,
    score: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    accuracy: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    timeUsedSec,
    durationSec: exam.durationSec,
    sections,
    questions,
    tryoutSetCode: exam.tryoutSetCode,
  };

  // Wrong-answer bank is now maintained server-side (see POST /api/attempts).
  return result;
}
