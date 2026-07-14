import { pgTable, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { anonymousUsers } from "./anonymous-users";
import { tryoutSets } from "./tryout-sets";

/**
 * A completed exam attempt (replaces the old localStorage exam history).
 * `sections`/`questions` mirror the frontend's SectionStats/QuestionResult
 * shapes verbatim (stored as jsonb) so results/review pages can render
 * without a schema migration on every UI change.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    anonymousUserId: text("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    tryoutSetId: integer("tryout_set_id").references(() => tryoutSets.id),
    title: text("title").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    correct: integer("correct").notNull(),
    incorrect: integer("incorrect").notNull(),
    unanswered: integer("unanswered").notNull(),
    score: integer("score").notNull(),
    accuracy: integer("accuracy").notNull(),
    timeUsedSec: integer("time_used_sec").notNull(),
    durationSec: integer("duration_sec").notNull(),
    sections: jsonb("sections").notNull(),
    questions: jsonb("questions").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("attempts_anon_user_idx").on(t.anonymousUserId),
    index("attempts_tryout_set_idx").on(t.tryoutSetId),
  ],
);

export type Attempt = typeof attempts.$inferSelect;
