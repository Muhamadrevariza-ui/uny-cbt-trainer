/**
 * Generate questions for ONE section (set via SECTION env var).
 * Run in parallel: SECTION=tpa tsx gen-section.ts, SECTION=lit_id ..., etc.
 */
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY not set");

const targetSection = process.env.SECTION;
if (!targetSection) throw new Error("SECTION env var required (tpa | lit_id | lit_en | mtk)");

const ai = new GoogleGenAI({ apiKey });
const MODEL = "gemini-2.5-flash";

const SECTION_DEFS: Record<string, { label: string; subskills: string[]; context: string }> = {
  tpa: {
    label: "Tes Potensi Akademik (TPA)",
    subskills: ["Analogi Verbal", "Silogisme", "Deret Angka", "Logika Analitik"],
    context: `TPA untuk ujian masuk universitas Indonesia.
- Analogi Verbal: hubungan dua pasang kata (A:B = C:?), 5 opsi
- Silogisme: premis mayor + minor, konklusi logis (modus ponens/tollens/"sebagian")
- Deret Angka: pola bilangan (aritmetika, geometri, fibonacci, campuran)
- Logika Analitik: urutan posisi, kondisi bersyarat, relasi antar objek
Pilihan ganda 5 opsi. Gunakan angka dan huruf biasa saja.`,
  },
  lit_id: {
    label: "Literasi Bahasa Indonesia",
    subskills: ["Ide Pokok", "Makna Kata & Istilah", "Simpulan Bacaan", "Fakta & Opini"],
    context: `Literasi Bahasa Indonesia setara UTBK.
- Ide Pokok: cari gagasan utama (deduktif/induktif/campuran)
- Makna Kata & Istilah: arti kata dalam konteks kalimat/paragraf
- Simpulan Bacaan: inferensi logis dari wacana (tersirat)
- Fakta & Opini: bedakan kalimat fakta vs opini
Setiap soal WAJIB ada wacana 60-150 kata. Topik: lingkungan, pendidikan, kesehatan, teknologi, ekonomi.`,
  },
  lit_en: {
    label: "English Literacy",
    subskills: ["Main Idea", "Inference", "Vocabulary in Context", "Detail Information"],
    context: `English Literacy for Indonesian university entrance exam.
- Main Idea: identify the main idea/topic of a passage
- Inference: draw logical conclusions not explicitly stated
- Vocabulary in Context: determine word meaning from context
- Detail Information: find explicitly stated information
ALL questions AND answer options MUST be in English. Always include an English passage (60-150 words).`,
  },
  mtk: {
    label: "Penalaran Matematika",
    subskills: ["Aljabar", "Aritmetika Sosial", "Geometri & Pengukuran", "Data & Statistika"],
    context: `Penalaran Matematika setara UTBK Indonesia.
- Aljabar: persamaan linear/kuadrat, SPLDV, fungsi, barisan aritmetika/geometri
- Aritmetika Sosial: persentase, keuntungan/rugi, diskon, bunga, kecepatan-jarak-waktu
- Geometri & Pengukuran: luas, keliling, volume, teorema Pythagoras, koordinat
- Data & Statistika: rata-rata, median, modus, jangkauan, interpretasi diagram
Soal kontekstual. Pastikan tepat satu jawaban benar secara matematis. Bahasa Indonesia.`,
  },
};

const DIFFICULTIES = [
  { key: "mudah", desc: "konsep dasar, 1-2 langkah", tlo: 30, thi: 50 },
  { key: "sedang", desc: "analisis, 2-3 langkah", tlo: 50, thi: 80 },
  { key: "sulit", desc: "multi-step, jebakan konseptual", tlo: 80, thi: 130 },
] as const;

const section = SECTION_DEFS[targetSection];
if (!section) throw new Error(`Unknown section: ${targetSection}`);

const outputPath = join(__dirname, "../../artifacts/uny-cbt/src/data/questions.ts");
const existingContent = readFileSync(outputPath, "utf-8");

// Find already-generated IDs for this section to avoid duplicates
const existingIds = new Set<string>();
for (const m of existingContent.matchAll(/id: "([^"]+)"/g)) existingIds.add(m[1]);
console.log(`[${targetSection}] Existing IDs in file: ${existingIds.size}`);

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function generateBatch(subskill: string, diff: typeof DIFFICULTIES[number], attempt = 0): Promise<{ question: string; passage?: string | null; options: string[]; correctAnswer: number; explanation: string; estimatedTime: number }[]> {
  const prompt = `Expert exam question writer for Indonesian university entrance exams (UNY/UTBK).
Create 7 UNIQUE practice questions.

Section: ${section.label}
Subskill: ${subskill}
Difficulty: ${diff.key} (${diff.desc}, estimatedTime: ${diff.tlo}-${diff.thi} seconds)

Guidelines:
${section.context}

Return ONLY valid JSON (no markdown):
{"questions":[{"question":"...","passage":null,"options":["A","B","C","D","E"],"correctAnswer":0,"explanation":"...","estimatedTime":${diff.tlo}}]}`;

  try {
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    });
    const text = resp.text ?? '{"questions":[]}';
    const parsed = JSON.parse(text);
    return parsed.questions ?? [];
  } catch (err: any) {
    if (attempt < 3) {
      const wait = 8000 * (attempt + 1);
      console.log(`  [${targetSection}] Retry ${attempt + 1} for ${subskill}/${diff.key} in ${wait / 1000}s...`);
      await sleep(wait);
      return generateBatch(subskill, diff, attempt + 1);
    }
    console.error(`  [${targetSection}] Failed ${subskill}/${diff.key}:`, err?.message ?? err);
    return [];
  }
}

const newEntries: string[] = [];
let counter = existingIds.size + 1;

for (const subskill of section.subskills) {
  for (const diff of DIFFICULTIES) {
    const testId = `${targetSection}-gen-${subskill.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 15)}-${diff.key}-001`;
    if (existingIds.has(testId)) {
      console.log(`[${targetSection}] Skip ${subskill}/${diff.key} (already exists)`);
      continue;
    }

    console.log(`[${targetSection}] Generating ${subskill}/${diff.key}...`);
    const qs = await generateBatch(subskill, diff);
    console.log(`  → ${qs.length} questions`);

    for (const q of qs) {
      const slug = subskill.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 15);
      const id = `${targetSection}-gen-${slug}-${diff.key}-${String(counter++).padStart(3, "0")}`;
      const passageLine =
        q.passage && q.passage !== "null"
          ? `    passage: ${JSON.stringify(q.passage)},\n`
          : "";
      const opts = (q.options || ["", "", "", "", ""]).map((o) => JSON.stringify(String(o || ""))).join(", ");
      newEntries.push(`  {
    id: ${JSON.stringify(id)},
    section: ${JSON.stringify(targetSection)},
    subskill: ${JSON.stringify(subskill)},
    difficulty: ${JSON.stringify(diff.key)},
    sourceType: "uny_like",
    question: ${JSON.stringify(String(q.question || ""))},
${passageLine}    options: [${opts}],
    correctAnswer: ${Math.max(0, Math.min(4, Number(q.correctAnswer) || 0))},
    explanation: ${JSON.stringify(String(q.explanation || ""))},
    estimatedTime: ${Math.max(20, Math.min(180, Number(q.estimatedTime) || diff.tlo))},
  }`);
    }

    // Pause between calls
    await sleep(2000);
  }
}

if (newEntries.length === 0) {
  console.log(`[${targetSection}] No new questions — done.`);
  process.exit(0);
}

// Append to file atomically-ish (read fresh, write once)
const freshContent = readFileSync(outputPath, "utf-8");
const closeIdx = freshContent.lastIndexOf("];");
const before = freshContent.slice(0, closeIdx);
const after = freshContent.slice(closeIdx);
const sep = before.trimEnd().endsWith(",") ? "\n" : ",\n";
const block = `  // === GEN: ${targetSection.toUpperCase()} ===\n` + newEntries.join(",\n") + ",\n";
writeFileSync(outputPath, before + sep + block + after, "utf-8");

console.log(`[${targetSection}] ✅ Wrote ${newEntries.length} questions to questions.ts`);
