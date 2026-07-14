import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A single section's shape within an exam format (question count + timing).
 * Kept data-driven so a verified real-exam structure can be added later by
 * inserting a new row here — no code changes needed to the exam engine.
 */
export interface ExamFormatSection {
  sectionId: string;
  questionCount: number;
  durationSeconds: number;
  order: number;
}

export const examFormats = pgTable("exam_formats", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  sections: jsonb("sections").$type<ExamFormatSection[]>().notNull(),
  totalQuestions: integer("total_questions").notNull(),
  totalDurationSeconds: integer("total_duration_seconds").notNull(),
  // Free-text provenance note, e.g. "placeholder, not yet a verified official format".
  sourceNotes: text("source_notes"),
  status: text("status").$type<"draft" | "active">().notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertExamFormatSchema = createInsertSchema(examFormats).omit({
  id: true,
  createdAt: true,
});

export type ExamFormat = typeof examFormats.$inferSelect;
export type InsertExamFormat = z.infer<typeof insertExamFormatSchema>;
