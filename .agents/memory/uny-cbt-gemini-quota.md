---
name: UNY CBT AI & Question Generation
description: Status of AI backend (OpenRouter), question bank, and generation scripts.
---

## Current State (as of 2026-07-13)

**Backend:** Now uses OpenRouter via `openai` SDK (OpenAI-compatible).
- `artifacts/api-server/src/lib/openrouter.ts` — OpenAI client pointing to `https://openrouter.ai/api/v1`
- Model: `google/gemini-2.5-flash` via `AI_MODEL` constant
- max_tokens: 1024 for analyze/explain (keeps costs low)
- `@google/genai` replaced with `openai ^4.x` in both api-server and scripts

**Question Bank:** 123 questions total
- tpa: 61 | lit_id: 20 | lit_en: 20 | mtk: 22
- Target: ~60 per section (240 total) → needs ~117 more

**Generation script:** `scripts/src/gen-section.ts`
- Uses OpenRouter API key (`OPENROUTER_API_KEY`)
- Saves progress per-batch (incremental writes, safe if timeout)
- Run: `OPENROUTER_API_KEY=$OPENROUTER_API_KEY SECTION=<tpa|lit_id|lit_en|mtk> /home/runner/workspace/scripts/node_modules/.bin/tsx scripts/src/gen-section.ts`
- Env: `GEN_MODEL` (default: google/gemini-2.5-flash), `BATCH_SIZE` (default: 5)
- max_tokens: 4096 per generation call

**OpenRouter credit situation:**
- Free credits exhausted after generating 40 TPA questions (~$0.01 per batch)
- ~1271 tokens worth of credits remain — enough for analyze/explain, not enough for generation (needs 4096 reserved)
- To resume generation: user must top up at openrouter.ai/settings/credits (~$5 covers all remaining)

**Gemini free API:**
- GEMINI_API_KEY still set but quota is 0 (either exhausted or disabled for lite model)
- Daily reset at midnight UTC — check with: `node -e "fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+process.env.GEMINI_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'hi'}]}],generationConfig:{maxOutputTokens:5}})}).then(r=>r.json()).then(d=>console.log(d.candidates?'OK':d.error?.message))"`

**When user tops up OpenRouter:**
Run all remaining sections (tpa will skip already-generated batches):
```bash
TSX=/home/runner/workspace/scripts/node_modules/.bin/tsx
for SECTION in tpa lit_id lit_en mtk; do
  OPENROUTER_API_KEY=$OPENROUTER_API_KEY SECTION=$SECTION $TSX scripts/src/gen-section.ts
done
```
