export type SectionId = "tpa" | "lit_id" | "lit_en" | "mtk";

export type Difficulty = "mudah" | "sedang" | "sulit";

export type SourceType =
  | "original_public"
  | "reconstructed"
  | "uny_like"
  | "transfer"
  | "generated";

export interface Question {
  id: string;
  section: SectionId;
  subskill: string;
  difficulty: Difficulty;
  sourceType: SourceType;
  question: string;
  passage?: string;
  options: string[]; // exactly 5, indexes 0-4 => A-E
  correctAnswer: number; // index into options
  explanation: string;
  estimatedTime: number; // seconds
}

export type ExamMode = "mini" | "full" | "materi" | "review" | "tryout";

export interface ExamSession {
  sectionId: SectionId;
  label: string;
  questionCount: number;
  durationSec: number;
  breakAfterSec: number; // break duration after this session (0 = no break)
}

export interface ActiveExam {
  id: string;
  mode: ExamMode;
  title: string;
  questions: Question[];
  durationSec: number;
  startedAt: number; // epoch ms
  endsAt: number; // epoch ms
  answers: (number | null)[];
  doubtful: boolean[];
  timeSpent: number[]; // seconds per question
  currentIndex: number;
  tryoutSetCode?: string;
  sessions: ExamSession[];
  currentSession: number;
  sessionStartedAt: number; // epoch ms for current session
  sessionEndsAt: number; // epoch ms for current session
  onBreak: boolean;
  breakEndsAt: number; // epoch ms when current break ends
}

export interface QuestionResult {
  question: Question;
  userAnswer: number | null;
  isCorrect: boolean;
  doubtful: boolean;
  timeSpent: number;
}

export interface SectionStats {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number; // 0-100, over attempted+unanswered (correct/total)
  avgTime: number; // seconds
}

export interface ExamResult {
  id: string;
  mode: ExamMode;
  title: string;
  date: number; // epoch ms
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number; // 0-100
  accuracy: number; // 0-100
  timeUsedSec: number;
  durationSec: number;
  sections: Partial<Record<SectionId, SectionStats>>;
  questions: QuestionResult[];
  /** Set when this result is an attempt at a fixed tryout set (e.g. "to-1"). */
  tryoutSetCode?: string;
}

export interface ExamConfig {
  mode: ExamMode;
  title: string;
  questionIds: string[];
  durationSec: number;
  shuffleOptions: boolean;
  tryoutSetCode?: string;
  sessions: ExamSession[];
}
