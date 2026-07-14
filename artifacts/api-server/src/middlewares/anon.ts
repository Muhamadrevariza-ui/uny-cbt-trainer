import type { RequestHandler } from "express";
import { db, anonymousUsers } from "@workspace/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare global {
  namespace Express {
    interface Request {
      anonUserId?: string;
    }
  }
}

/**
 * Reads the `X-Anon-Id` header (an anonymous device UUID generated and
 * persisted client-side), upserts a row for it in `anonymous_users`, and
 * attaches it to `req.anonUserId` for downstream handlers.
 */
export const requireAnonUser: RequestHandler = async (req, res, next) => {
  const id = req.header("x-anon-id");
  if (!id || !UUID_RE.test(id)) {
    res.status(400).json({ error: "Missing or invalid X-Anon-Id header" });
    return;
  }

  try {
    await db
      .insert(anonymousUsers)
      .values({ id })
      .onConflictDoUpdate({ target: anonymousUsers.id, set: { lastSeenAt: new Date() } });
    req.anonUserId = id;
    next();
  } catch (err) {
    next(err);
  }
};
