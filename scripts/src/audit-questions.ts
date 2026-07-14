/**
 * Audit question bank for correctness & quality using an LLM judge.
 * Batches questions, asks the model to verify correctAnswer/explanation
 * consistency and rate quality. Writes a JSON report.
 *
 * Usage: tsx scripts/src/audit-questions.ts [--section=tpa] [--start=0] [--end=358]
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) throw new Error("Set GEMINI_API_KEY.");
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const model = GEMINI_MODEL;

async function callGemini(prompt: string, maxOutputTokens: number): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data: any = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Empty Gemini response: ${JSON.stringify(data).slice(0, 300)}`);
  return text;
}

const questionsPath = join(__dirname, "../../artifacts/uny-cbt/src/data/questions.ts");
const src = readFileSync(questionsPath, "utf-8");

// Parse the QUESTIONS array via dynamic import (tsx supports ts import at runtime)
const mod = await import(questionsPath);
const QUESTIONS = mod.QUESTIONS as any[];

const sectionFilter = process.argv.find((a) => a.startsWith("--section="))?.split("=")[1];
const start = parseInt(process.argv.find((a) => a.startsWith("--start="))?.split("=")[1] ?? "0", 10);
const end = parseInt(process.argv.find((a) => a.startsWith("--end="))?.split("=")[1] ?? String(QUESTIONS.length), 10);

let pool = QUESTIONS.map((q, i) => ({ ...q, _idx: i }));
if (sectionFilter) pool = pool.filter((q) => q.section === sectionFilter);
pool = pool.slice(start, end);

console.log(`Auditing ${pool.length} questions (section=${sectionFilter ?? "all"}, range=${start}-${end}) with ${model}`);

const BATCH = 20;
const report: any[] = [];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function auditBatch(batch: any[], attempt = 0): Promise<any[]> {
  const payload = batch.map((q) => ({
    id: q.id,
    question: q.question,
    passage: q.passage ?? null,
    options: q.options,
    markedCorrectAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));

  const prompt = `You are a strict exam quality auditor for Indonesian university entrance exam practice questions (UNY/UTBK style).

For EACH question below, verify:
1. Is "markedCorrectAnswer" (0-indexed) actually the objectively correct option, consistent with the explanation and the question's own logic/math?
2. Rate quality 1-5 (5=excellent, well-calibrated, unambiguous; 1=broken/nonsensical/trivial/wrong).
3. Flag issues: "wrong_answer" (marked answer is not correct), "ambiguous" (multiple options could be correct or question is unclear), "too_easy" (trivial, doesn't test the stated skill), "broken" (empty/garbled/incoherent), "ok" (no issues).

Questions (JSON array):
${JSON.stringify(payload, null, 1)}

Return ONLY valid JSON (no markdown). Keep "note" under 12 words:
{"results":[{"id":"...","actualCorrectAnswer":0,"quality":5,"issue":"ok","note":"short reason"}]}
"actualCorrectAnswer" = the index you believe is truly correct (0-indexed), even if same as marked.`;

  try {
    const text = await callGemini(prompt, 8192);
    const parsed = JSON.parse(text) as { results?: any[] };
    return parsed.results ?? [];
  } catch (err: any) {
    if (attempt < 4) {
      const wait = 5000 * Math.pow(2, attempt);
      console.log(`  retry in ${wait}ms: ${err?.message ?? err}`);
      await sleep(wait);
      return auditBatch(batch, attempt + 1);
    }
    console.error("  FAILED batch:", err?.message ?? err);
    return batch.map((q) => ({ id: q.id, correctAnswerIsRight: null, quality: null, issue: "audit_failed", note: String(err?.message ?? err) }));
  }
}

const batches = chunk(pool, BATCH);
for (let i = 0; i < batches.length; i++) {
  console.log(`Batch ${i + 1}/${batches.length}...`);
  const results = await auditBatch(batches[i]);
  report.push(...results);
  await sleep(15000);
}

const outPath = join(__dirname, `../../.local/audit-report${sectionFilter ? "-" + sectionFilter : ""}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
console.log(`\nWrote ${report.length} audit entries to ${outPath}`);

const flagged = report.filter((r) => r.issue && r.issue !== "ok");
console.log(`Flagged: ${flagged.length}/${report.length}`);
for (const f of flagged) console.log(` - ${f.id}: ${f.issue} (quality ${f.quality}) — ${f.note}`);
