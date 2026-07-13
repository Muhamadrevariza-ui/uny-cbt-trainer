/**
 * Generate questions for ONE section using OpenRouter API.
 * Set SECTION env var: tpa | lit_id | lit_en | mtk
 *
 * Usage:
 *   SECTION=tpa tsx scripts/src/gen-section.ts
 */
import OpenAI from "openai";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

const targetSection = process.env.SECTION;
if (!targetSection) throw new Error("SECTION env var required: tpa | lit_id | lit_en | mtk");

const openai = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://replit.com",
    "X-Title": "UNY CBT Trainer",
  },
});

// Use a capable model for high-quality question generation
const GEN_MODEL = process.env.GEN_MODEL ?? "google/gemini-2.5-flash";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "5", 10); // questions per call

// ── Section definitions ──────────────────────────────────────────────────────

interface SectionDef {
  label: string;
  subskills: string[];
  context: string;
  subskillGuides: Record<string, string>;
}

const SECTION_DEFS: Record<string, SectionDef> = {
  tpa: {
    label: "Tes Potensi Akademik (TPA)",
    subskills: ["Analogi Verbal", "Silogisme", "Deret Angka", "Logika Analitik"],
    context: `TPA untuk ujian masuk universitas Indonesia (UNY/UTBK-style).
Format: pilihan ganda 5 opsi (A–E), satu jawaban benar.
Tidak ada wacana/passage — soal berdiri sendiri.`,
    subskillGuides: {
      "Analogi Verbal": `Pola hubungan dua pasang kata: A : B = C : ?
Variasi pola: sinonim, antonim, bagian-keseluruhan, alat-fungsi, bahan-produk, spesies-genus, sebab-akibat, derajat intensitas.
JANGAN hanya antonim/sinonim — buat variasi menarik.
Pengecoh: kata yang berkaitan tapi pola hubungannya berbeda.`,

      "Silogisme": `Premis mayor + minor → konklusi logis.
Variasi: modus ponens (P→Q, P ∴ Q), modus tollens (P→Q, ¬Q ∴ ¬P), silogisme kategorial ("semua", "sebagian", "tidak ada").
Jebakan umum: konklusi yang terdengar masuk akal tapi tidak valid secara logis.
Tambahkan pilihan "Semua simpulan benar/salah" untuk kesulitan lebih tinggi.`,

      "Deret Angka": `Pola bilangan: aritmetika (+n), geometri (×n), fibonacci, selisih bertingkat, bilangan prima, pola kombinasi.
Format soal: "3, 7, 13, 21, ?, 43" → cari suku yang hilang.
Bisa juga pola dua deret bergantian: "2, 3, 4, 6, 8, 12, ..."
Hindari pola yang terlalu sederhana (+2, +3).`,

      "Logika Analitik": `Soal penalaran kondisi: urutan, posisi, seleksi, atau jadwal.
Format: diberikan beberapa kondisi/aturan → buat pertanyaan "Manakah yang PASTI/MUNGKIN/TIDAK MUNGKIN benar?"
Contoh: "A duduk di sebelah B. C tidak di pojok. D di antara A dan E. Siapa yang duduk paling kiri?"
Buat kondisi yang cukup untuk menentukan jawaban unik.`,
    },
  },

  lit_id: {
    label: "Literasi Bahasa Indonesia",
    subskills: ["Ide Pokok", "Makna Kata & Istilah", "Simpulan Bacaan", "Fakta & Opini"],
    context: `Literasi Bahasa Indonesia setara UTBK — berbasis teks/wacana.
WAJIB: setiap soal punya wacana orisinal 80-150 kata.
Topik wacana: sains, lingkungan, pendidikan, kesehatan, teknologi, ekonomi, sosial budaya.
Format: pilihan ganda 5 opsi (A–E).`,
    subskillGuides: {
      "Ide Pokok": `Cari gagasan utama/ide pokok paragraf atau seluruh wacana.
Variasi: deduktif (ide pokok di awal), induktif (di akhir), campuran, atau implisit.
Pengecoh: kalimat penjelas yang terdengar seperti ide pokok, ide pokok paragraf lain.
Soal bisa: "Ide pokok paragraf pertama...", "Topik utama wacana...", "Gagasan yang paling tepat..."`,

      "Makna Kata & Istilah": `Tanyakan makna kata/frasa/istilah DALAM KONTEKS wacana (bukan makna kamus umum).
Kata target harus ada di wacana. Penjelasan harus merujuk konteks kalimat.
Pengecoh: makna lain yang umum dari kata tersebut, sinonim yang kurang tepat di konteks ini.`,

      "Simpulan Bacaan": `Simpulan yang TIDAK eksplisit tertulis tapi dapat disimpulkan secara logis dari wacana.
Bukan hanya parafrase — harus ada inferensi/penalaran.
Pengecoh: pernyataan yang benar secara umum tapi tidak didukung wacana, pernyataan yang terlalu luas/sempit.`,

      "Fakta & Opini": `Bedakan kalimat yang berisi FAKTA (dapat diverifikasi, ada data/angka/nama) vs OPINI (penilaian, prediksi, saran, perasaan).
Tanyakan: "Pernyataan manakah yang merupakan fakta?", "Kalimat yang termasuk opini penulis?"
Pengecoh: opini yang terdengar faktual, fakta yang diungkapkan dengan bahasa emotif.`,
    },
  },

  lit_en: {
    label: "English Literacy",
    subskills: ["Main Idea", "Inference", "Vocabulary in Context", "Detail Information"],
    context: `English Literacy for Indonesian university entrance exam (UTBK/UNY-style).
ALL text — question, passage, options — MUST be in English.
Passage: 80-150 words, natural academic/journalistic English. Topics: science, technology, environment, society, culture.
Format: 5-option multiple choice (A–E).`,
    subskillGuides: {
      "Main Idea": `Identify the central idea/main topic of the passage.
Variations: "The passage mainly discusses...", "The best title for this passage...", "The author's primary purpose..."
Distractors: supporting details, related but narrower/broader topics, true statements that are not the main focus.`,

      "Inference": `Draw a logical conclusion NOT explicitly stated in the passage.
The answer must be strongly supported by the passage but requires reader reasoning.
Distractors: conclusions that go beyond the text, statements that contradict the text, literal paraphrases.
Question stems: "It can be inferred that...", "The author implies...", "Based on the passage, it is most likely that..."`,

      "Vocabulary in Context": `Determine the meaning of a word or phrase AS USED in the passage (context may differ from general definition).
The target word must appear in the passage. Distractors: other valid meanings of the word, words with similar spelling/sound.
Question stems: "The word '...' in paragraph X most nearly means...", "As used in line X, '...' means..."`,

      "Detail Information": `Find explicitly stated information in the passage.
Varies from direct retrieval to locating specific facts/figures/names.
Distractors: information not in the text, similar-sounding but incorrect facts, information from a different part of the text.
Question stems: "According to the passage...", "The author states that...", "Which of the following is mentioned..."`,
    },
  },

  mtk: {
    label: "Penalaran Matematika",
    subskills: ["Aljabar", "Aritmetika Sosial", "Geometri & Pengukuran", "Data & Statistika"],
    context: `Penalaran Matematika setara UTBK Indonesia.
Soal HARUS kontekstual — berbasis situasi nyata (kehidupan sehari-hari, bisnis, sains).
KRITIS: verifikasi kebenaran matematika sebelum finalisasi soal. Hitung ulang jawaban.
Bahasa Indonesia. Format: pilihan ganda 5 opsi (A–E).`,
    subskillGuides: {
      "Aljabar": `Topik: persamaan linear satu/dua variabel (SPLDV), persamaan kuadrat, fungsi (linear/kuadrat), barisan dan deret (aritmetika/geometri), pertidaksamaan.
Soal kontekstual: "Dua angka jika dijumlahkan...", "Sebuah pabrik memproduksi...", "Harga tiket..."
Hindari soal abstrak murni. Verifikasi: substitusi jawaban ke persamaan asal.`,

      "Aritmetika Sosial": `Topik: persentase, keuntungan/rugi, diskon, pajak, bunga tunggal/majemuk, kecepatan-jarak-waktu, perbandingan senilai/berbalik nilai.
Soal berbasis situasi: belanja, jual beli, perjalanan, tabungan.
HATI-HATI: angka harus konsisten dan jawaban harus bilangan "bersih" (tidak terlalu rumit).`,

      "Geometri & Pengukuran": `Topik: luas & keliling (persegi, lingkaran, trapesium, dll), volume & luas permukaan bangun ruang, teorema Pythagoras, koordinat kartesius, transformasi geometri.
Soal kontekstual: luas lantai, volume tangki air, jarak dua titik.
WAJIB: pastikan angka menghasilkan jawaban eksak (tidak desimal panjang).`,

      "Data & Statistika": `Topik: rata-rata (mean), median, modus, jangkauan, kuartil, interpretasi diagram batang/garis/lingkaran, peluang dasar.
Sertakan data tabel/daftar angka dalam soal. Buat dari konteks nyata: nilai ujian, data curah hujan, survei.
Pengecoh: gunakan mean saat jawaban median, atau sebaliknya.`,
    },
  },
};

// ── Difficulty definitions ───────────────────────────────────────────────────

const DIFFICULTIES = [
  { key: "mudah",  desc: "konsep dasar, aplikasi langsung, 1-2 langkah",            tlo: 30,  thi: 50  },
  { key: "sedang", desc: "butuh 2-3 langkah atau satu konsep lanjutan, analitis",   tlo: 50,  thi: 80  },
  { key: "sulit",  desc: "multi-langkah, jebakan konseptual halus, analisis dalam", tlo: 80,  thi: 120 },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface RawQuestion {
  question: string;
  passage?: string | null;
  options: string[];
  correctAnswer: number;
  explanation: string;
  estimatedTime: number;
}

async function generateBatch(
  sec: SectionDef,
  subskill: string,
  diff: typeof DIFFICULTIES[number],
  attempt = 0,
): Promise<RawQuestion[]> {
  const guide = sec.subskillGuides[subskill] ?? "";

  const prompt = `You are a professional exam question writer for Indonesian university entrance exams (UNY/UTBK standard).
Create exactly ${BATCH_SIZE} high-quality, UNIQUE practice questions.

SECTION: ${sec.label}
SUBSKILL: ${subskill}
DIFFICULTY: ${diff.key} — ${diff.desc} (estimatedTime: ${diff.tlo}–${diff.thi} seconds)

CONTEXT & FORMAT:
${sec.context}

SUBSKILL-SPECIFIC GUIDE:
${guide}

QUALITY REQUIREMENTS (non-negotiable):
1. Each question must match the exact subskill — not a generic question of the section
2. Exactly ONE correct answer per question — verify before writing
3. All 4 distractors must be plausible and test deep understanding (not obviously wrong)
4. Explanation must cover: WHY the correct answer is right AND why key distractors are wrong
5. For math: double-check your arithmetic before finalizing
6. Vary the format/context across questions — no two similar scenarios
7. Match the difficulty calibration strictly

Return ONLY valid JSON (no markdown, no preamble):
{"questions":[{"question":"...","passage":null,"options":["A","B","C","D","E"],"correctAnswer":0,"explanation":"...","estimatedTime":${diff.tlo}}]}`;

  try {
    const resp = await openai.chat.completions.create({
      model: GEN_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });

    const text = resp.choices[0]?.message?.content ?? '{"questions":[]}';
    const parsed = JSON.parse(text) as { questions?: RawQuestion[] };
    return parsed.questions ?? [];
  } catch (err: any) {
    if (attempt < 4) {
      const wait = 5000 * Math.pow(2, attempt); // exponential backoff
      console.log(`  ↻ Retry ${attempt + 1} for ${subskill}/${diff.key} in ${wait / 1000}s... (${err?.message ?? err})`);
      await sleep(wait);
      return generateBatch(sec, subskill, diff, attempt + 1);
    }
    console.error(`  ✗ Failed ${subskill}/${diff.key}:`, err?.message ?? err);
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const section = SECTION_DEFS[targetSection];
if (!section) throw new Error(`Unknown section "${targetSection}". Valid: tpa | lit_id | lit_en | mtk`);

const outputPath = join(__dirname, "../../artifacts/uny-cbt/src/data/questions.ts");
const existingContent = readFileSync(outputPath, "utf-8");

// Collect existing IDs to avoid duplicates
const existingIds = new Set<string>();
for (const m of existingContent.matchAll(/id: "([^"]+)"/g)) existingIds.add(m[1]);
console.log(`\n[${targetSection.toUpperCase()}] Starting generation — ${existingIds.size} questions already in file`);
console.log(`[${targetSection.toUpperCase()}] Model: ${GEN_MODEL} | Batch size: ${BATCH_SIZE}\n`);

const newEntries: string[] = [];
let counter = 1;

// Pick an offset that doesn't conflict with existing IDs in this section
const sectionExistingNums = [...existingIds]
  .filter((id) => id.startsWith(`${targetSection}-gen-`))
  .map((id) => parseInt(id.split("-").pop() ?? "0", 10))
  .filter((n) => !isNaN(n));
counter = sectionExistingNums.length > 0 ? Math.max(...sectionExistingNums) + 1 : 1;

for (const subskill of section.subskills) {
  for (const diff of DIFFICULTIES) {
    const slug = subskill.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 15);
    const testId = `${targetSection}-gen-${slug}-${diff.key}-001`;

    if (existingIds.has(testId)) {
      console.log(`  ⏭  Skip ${subskill} / ${diff.key} (already generated)`);
      continue;
    }

    console.log(`  ⟳  Generating ${subskill} / ${diff.key}...`);
    const qs = await generateBatch(section, subskill, diff);
    console.log(`     → ${qs.length} questions received`);

    // Write this batch immediately so progress is saved even if script times out
    if (qs.length > 0) {
      const batchEntries: string[] = [];
      for (const q of qs) {
        const id = `${targetSection}-gen-${slug}-${diff.key}-${String(counter++).padStart(3, "0")}`;
        const passageLine =
          q.passage && q.passage !== "null" && q.passage.trim()
            ? `    passage: ${JSON.stringify(q.passage.trim())},\n`
            : "";
        const opts = (q.options ?? ["", "", "", "", ""])
          .slice(0, 5)
          .map((o) => JSON.stringify(String(o ?? "").trim()))
          .join(", ");
        const correctIdx = Math.max(0, Math.min(4, Number(q.correctAnswer) || 0));
        const time = Math.max(20, Math.min(150, Number(q.estimatedTime) || diff.tlo));

        batchEntries.push(
          `  {\n` +
          `    id: ${JSON.stringify(id)},\n` +
          `    section: ${JSON.stringify(targetSection)},\n` +
          `    subskill: ${JSON.stringify(subskill)},\n` +
          `    difficulty: ${JSON.stringify(diff.key)},\n` +
          `    sourceType: "uny_like",\n` +
          `    question: ${JSON.stringify(String(q.question ?? "").trim())},\n` +
          passageLine +
          `    options: [${opts}],\n` +
          `    correctAnswer: ${correctIdx},\n` +
          `    explanation: ${JSON.stringify(String(q.explanation ?? "").trim())},\n` +
          `    estimatedTime: ${time},\n` +
          `  }`,
        );
        newEntries.push(batchEntries[batchEntries.length - 1]);
      }

      // Write batch immediately to file
      const cur = readFileSync(outputPath, "utf-8");
      const ci = cur.lastIndexOf("];");
      const bef = cur.slice(0, ci);
      const aft = cur.slice(ci);
      const s = bef.trimEnd().endsWith(",") ? "\n" : ",\n";
      writeFileSync(outputPath, bef + s + batchEntries.join(",\n") + ",\n" + aft, "utf-8");
      console.log(`     ✓ Saved ${batchEntries.length} questions (batch ${subskill}/${diff.key})`);

      // Update existingIds so next batch knows these IDs exist
      for (const e of batchEntries) {
        const m = e.match(/id: "([^"]+)"/);
        if (m) existingIds.add(m[1]);
      }
    }

    // Polite pause between API calls
    await sleep(1500);
  }
}

const total = newEntries.length;
if (total === 0) {
  console.log(`\n[${targetSection.toUpperCase()}] Nothing new — all batches already exist.`);
} else {
  console.log(`\n[${targetSection.toUpperCase()}] ✅ Done — wrote ${total} questions total`);
}
const finalCount = (readFileSync(outputPath, "utf-8").match(/id: "/g) ?? []).length;
console.log(`[${targetSection.toUpperCase()}] Bank soal total: ${finalCount} questions`);
