import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { anonymousUsers } from "./anonymous-users";

/** Per-device wrong-answer bank (replaces the old localStorage wrong-ids list), used by Review mode. */
export const wrongAnswers = pgTable(
  "wrong_answers",
  {
    anonymousUserId: text("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    timesMissed: integer("times_missed").notNull().default(1),
    lastMissedAt: timestamp("last_missed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.anonymousUserId, t.questionId] })],
);

export type WrongAnswer = typeof wrongAnswers.$inferSelect;
