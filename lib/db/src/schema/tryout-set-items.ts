import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { tryoutSets } from "./tryout-sets";

/**
 * Pins a specific static question id (from the frontend's question bank) to a
 * tryout set, so sets have fixed, non-overlapping composition.
 */
export const tryoutSetItems = pgTable("tryout_set_items", {
  id: serial("id").primaryKey(),
  tryoutSetId: integer("tryout_set_id")
    .notNull()
    .references(() => tryoutSets.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  sectionId: text("section_id").notNull(),
  subskill: text("subskill").notNull(),
  difficulty: text("difficulty").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export type TryoutSetItem = typeof tryoutSetItems.$inferSelect;
