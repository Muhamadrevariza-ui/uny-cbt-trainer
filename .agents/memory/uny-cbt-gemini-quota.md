---
name: UNY CBT AI & Question Generation
description: Status of AI backend (Cerebras), question bank, and generation scripts.
---

## Current State (as of 2026-07-13)

**Backend:** Uses Cerebras API (preferred) → OpenRouter fallback, via `openai` SDK.
- `artifacts/api-server/src/lib/openrouter.ts` — auto-detects CEREBRAS_API_KEY or OPENROUTER_API_KEY
- Cerebras model: `gemma-4-31b` | OpenRouter model: `google/gemini-2.5-flash`
- max_tokens: 1024 for analyze/explain real-time features
- Package: `openai ^4.x` in both api-server and scripts (no @google/genai)

**Question Bank: 358 questions total**
- tpa: ~116 | lit_id: ~80 | lit_en: ~80 | mtk: ~82
- Each section: 4 subskills × 3 difficulties × 5 questions (generated) + original questions

**Generation script:** `scripts/src/gen-section.ts`
- Auto-detects CEREBRAS_API_KEY or OPENROUTER_API_KEY
- Saves progress per-batch (incremental writes, timeout-safe)
- Run: `CEREBRAS_API_KEY=$CEREBRAS_API_KEY SECTION=<tpa|lit_id|lit_en|mtk> /home/runner/workspace/scripts/node_modules/.bin/tsx scripts/src/gen-section.ts`
- Env: `GEN_MODEL` (override model), `BATCH_SIZE` (default: 5)

**Cerebras available models (as of 2026-07-13):** zai-glm-4.7, gpt-oss-120b, gemma-4-31b
- Only `gemma-4-31b` confirmed to support response_format json_object correctly

**To add more questions later (script is idempotent — skips already-generated):**
```bash
TSX=/home/runner/workspace/scripts/node_modules/.bin/tsx
for S in tpa lit_id lit_en mtk; do
  CEREBRAS_API_KEY=$CEREBRAS_API_KEY SECTION=$S $TSX scripts/src/gen-section.ts
done
```
