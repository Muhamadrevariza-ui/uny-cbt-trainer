import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Anonymous device identity. The app has no login — the client generates a
 * UUID on first load (localStorage) and sends it as the `X-Anon-Id` header.
 * This table just tracks that identity so progress/attempts can be scoped
 * to a device without an account system.
 */
export const anonymousUsers = pgTable("anonymous_users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AnonymousUser = typeof anonymousUsers.$inferSelect;
