---
name: UNY CBT Gemini API Quota
description: Gemini free-tier quota hit during question generation; what was done and what remains.
---

The user's GEMINI_API_KEY is a free-tier key limited to **20 generate_content requests per day** for gemini-2.5-flash. This quota was exhausted during the initial question bank generation attempt (13 batches out of 48 consumed it).

**Current state:**
- questions.ts has 83 curated questions (from the original zip source)
- `scripts/src/gen-section.ts` — section-by-section generator, run with `SECTION=tpa|lit_id|lit_en|mtk`
- `scripts/src/generate-questions.ts` — full-run generator (all 48 batches)
- Both scripts have duplicate-detection (skip if ID already exists) and exponential-backoff retry

**To generate 400 questions when quota resets (daily reset):**
```
# Run one section at a time — each takes ~2 min
SECTION=tpa /home/runner/workspace/scripts/node_modules/.bin/tsx scripts/src/gen-section.ts
SECTION=lit_id ...
SECTION=lit_en ...
SECTION=mtk ...
```

**Why:** Free tier = 20 req/day. Each batch = 1 req. 48 batches total. Need 3 days minimum on free tier, or upgrade to paid Gemini API.
