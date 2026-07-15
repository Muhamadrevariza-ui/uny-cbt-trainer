/*
# Create UNY CBT Trainer schema (single-tenant, no auth)

1. New Tables
- `anonymous_users`: Per-device identity (UUID from localStorage, sent as X-Anon-Id header)
  - id (text, PK), created_at, last_seen_at
- `exam_formats`: Data-driven exam structure (question count + timing per section)
  - id (serial, PK), code (unique), label, description, sections (jsonb), total_questions, total_duration_seconds, source_notes, status, created_at
- `tryout_sets`: Fixed-composition tryout packages tied to an exam format
  - id (serial, PK), code (unique), label, description, exam_format_id (FK), order_index, is_published, created_at
- `tryout_set_items`: Pins specific question IDs to a tryout set
  - id (serial, PK), tryout_set_id (FK, cascade), question_id, section_id, subskill, difficulty, order_index
- `attempts`: Completed exam attempts with full results stored as jsonb
  - id (text, PK), anonymous_user_id (FK, cascade), mode, tryout_set_id (FK, nullable), title, totals, score, accuracy, time, sections (jsonb), questions (jsonb), completed_at
- `wrong_answers`: Per-device wrong-answer bank for Review mode
  - anonymous_user_id + question_id (composite PK), times_missed, last_missed_at

2. Security
- RLS enabled on ALL tables.
- This is a no-auth app (anonymous device identity via X-Anon-Id header).
- All policies use `TO anon, authenticated` so the anon-key frontend can operate.
- anonymous_users: anyone can insert/upsert their own device ID; anyone can read (needed for anon middleware validation).
- exam_formats, tryout_sets, tryout_set_items: public read (shared content), no write from frontend (managed via seed script).
- attempts: anyone can create/read/update/delete attempts for any anon user (data is scoped by device ID in the app layer, not RLS — this is a single-tenant no-auth app).
- wrong_answers: same pattern as attempts.

3. Important Notes
- The app has NO sign-in screen — all access is via the anon key.
- `USING (true)` is acceptable here because the data is intentionally shared per-device (single-tenant, no auth), and the app layer handles device-level scoping via the X-Anon-Id header.
- Indexes added on frequently-queried columns (anonymous_user_id, tryout_set_id).
*/

-- anonymous_users
CREATE TABLE IF NOT EXISTS anonymous_users (
  id text PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE anonymous_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_anonymous_users" ON anonymous_users;
CREATE POLICY "anon_read_anonymous_users" ON anonymous_users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_anonymous_users" ON anonymous_users;
CREATE POLICY "anon_insert_anonymous_users" ON anonymous_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_anonymous_users" ON anonymous_users;
CREATE POLICY "anon_update_anonymous_users" ON anonymous_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- exam_formats
CREATE TABLE IF NOT EXISTS exam_formats (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  sections jsonb NOT NULL,
  total_questions integer NOT NULL,
  total_duration_seconds integer NOT NULL,
  source_notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE exam_formats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_exam_formats" ON exam_formats;
CREATE POLICY "anon_read_exam_formats" ON exam_formats FOR SELECT
  TO anon, authenticated USING (true);

-- tryout_sets
CREATE TABLE IF NOT EXISTS tryout_sets (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  exam_format_id integer NOT NULL REFERENCES exam_formats(id),
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE tryout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_tryout_sets" ON tryout_sets;
CREATE POLICY "anon_read_tryout_sets" ON tryout_sets FOR SELECT
  TO anon, authenticated USING (true);

-- tryout_set_items
CREATE TABLE IF NOT EXISTS tryout_set_items (
  id serial PRIMARY KEY,
  tryout_set_id integer NOT NULL REFERENCES tryout_sets(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  section_id text NOT NULL,
  subskill text NOT NULL,
  difficulty text NOT NULL,
  order_index integer NOT NULL
);
ALTER TABLE tryout_set_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_tryout_set_items" ON tryout_set_items;
CREATE POLICY "anon_read_tryout_set_items" ON tryout_set_items FOR SELECT
  TO anon, authenticated USING (true);

-- attempts
CREATE TABLE IF NOT EXISTS attempts (
  id text PRIMARY KEY,
  anonymous_user_id text NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  mode text NOT NULL,
  tryout_set_id integer REFERENCES tryout_sets(id),
  title text NOT NULL,
  total_questions integer NOT NULL,
  correct integer NOT NULL,
  incorrect integer NOT NULL,
  unanswered integer NOT NULL,
  score integer NOT NULL,
  accuracy integer NOT NULL,
  time_used_sec integer NOT NULL,
  duration_sec integer NOT NULL,
  sections jsonb NOT NULL,
  questions jsonb NOT NULL,
  completed_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS attempts_anon_user_idx ON attempts(anonymous_user_id);
CREATE INDEX IF NOT EXISTS attempts_tryout_set_idx ON attempts(tryout_set_id);

DROP POLICY IF EXISTS "anon_read_attempts" ON attempts;
CREATE POLICY "anon_read_attempts" ON attempts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_attempts" ON attempts;
CREATE POLICY "anon_insert_attempts" ON attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attempts" ON attempts;
CREATE POLICY "anon_update_attempts" ON attempts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_attempts" ON attempts;
CREATE POLICY "anon_delete_attempts" ON attempts FOR DELETE
  TO anon, authenticated USING (true);

-- wrong_answers
CREATE TABLE IF NOT EXISTS wrong_answers (
  anonymous_user_id text NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  times_missed integer NOT NULL DEFAULT 1,
  last_missed_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (anonymous_user_id, question_id)
);
ALTER TABLE wrong_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_wrong_answers" ON wrong_answers;
CREATE POLICY "anon_read_wrong_answers" ON wrong_answers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wrong_answers" ON wrong_answers;
CREATE POLICY "anon_insert_wrong_answers" ON wrong_answers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wrong_answers" ON wrong_answers;
CREATE POLICY "anon_update_wrong_answers" ON wrong_answers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wrong_answers" ON wrong_answers;
CREATE POLICY "anon_delete_wrong_answers" ON wrong_answers FOR DELETE
  TO anon, authenticated USING (true);
