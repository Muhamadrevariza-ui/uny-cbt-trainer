---
name: UNY CBT progress/tryout architecture
description: How anon identity, DB-backed progress, tryout sets, and exam-format config are wired together in the uny-cbt app.
---

## Anonymous identity
Client generates a UUID (localStorage, `getDeviceId()`), sent as `X-Anon-Id` header on every API request via a global getter (`setAnonIdGetter` in `@workspace/api-client-react`, mirroring the existing `setAuthTokenGetter` pattern). Server middleware validates UUID format strictly and upserts `anonymous_users`.

**Why:** No login system wanted; still needed durable per-device progress instead of localStorage-only history.

## Progress storage
Question *content* stays static in `data/questions.ts`. Only exam-structure config (`exam_formats`, jsonb sections) and results (`attempts`, `wrong_answers`) live in Postgres. Tryout-set progress (status/best score/attempt count) is computed on read by aggregating `attempts` — no separate materialized progress table.

**Why:** Keeps the question bank editable without migrations; avoids progress-table drift from attempt data.

## Exam-format config
Exam structure (sections, question counts, durations) is data-driven via `exam_formats`, explicitly seeded as a placeholder (`full-to-default`, `sourceNotes` says unverified) — never claim it matches the real UNY exam without user-provided source data.

## Generated API hooks gotcha
The orval-generated hooks' `options.query` param type is `UseQueryOptions<...>` (not `Partial`/`Omit`), so passing `{ enabled: ... }` alone fails a `queryKey` type-check. Fix: also pass `queryKey: get<Name>QueryKey(...)` explicitly (exported from `@workspace/api-client-react`).

## Composite project reference gotcha
`lib/api-client-react` is a TS composite project referenced from consumers' tsconfig — editing its `src/` alone does NOT update type-checking for consumers; the referenced project's stale `dist/*.d.ts` gets used instead. Must rebuild it: `cd lib/api-client-react && npx tsc -b tsconfig.json` after any exported-API change, before consumer typecheck will see it.
