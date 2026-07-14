import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { examFormats } from "./exam-formats";

/** A distinct, fixed-composition tryout set (e.g. "Tryout #1"), tied to an exam format. */
export const tryoutSets = pgTable("tryout_sets", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  examFormatId: integer("exam_format_id")
    .notNull()
    .references(() => examFormats.id),
  orderIndex: integer("order_index").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TryoutSet = typeof tryoutSets.$inferSelect;
