/**
 * Generate ~320 high-quality exam questions using Gemini API.
 * Appends them to artifacts/uny-cbt/src/data/questions.ts
 * Run: pnpm --filter @workspace/scripts run generate-questions
 */
import { GoogleGenAI } from "@google/genai";
import { writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY not set");

const ai = new GoogleGenAI({ apiKey });
const MODEL = "gemini-2.5-flash";

const SECTIONS = {
  tpa: {
    label: "Tes Potensi Akademik (TPA)",
    subskills: ["Analogi Verbal", "Silogisme", "Deret Angka", "Logika Analitik"],
    context: `TPA untuk ujian masuk universitas Indonesia (setara UTBK Penalaran Umum).
- Analogi Verbal: hubungan dua pasang kata (A:B = C:?), pilih yang tepat
- Silogisme: premis mayor + minor → konklusi logis (termasuk modus ponens, tollens, campuran, kalimat "sebagian")
- Deret Angka: temukan pola bilangan dan isi suku berikutnya (aritmetika, geometri, fibonacci, campuran)
- Logika Analitik: urutan posisi, kondisi bersyarat, relasi (lebih tinggi dari, di sebelah, dll)
Semua soal pilihan ganda 5 opsi. Jangan ada gambar atau simbol khusus.`,
  },
  lit_id: {
    label: "Literasi Bahasa Indonesia",
    subskills: ["Ide Pokok", "Makna Kata & Istilah", "Simpulan Bacaan", "Fakta & Opini"],
    context: `Literasi Bahasa Indonesia setara UTBK Literasi Bahasa Indonesia.
- Ide Pokok: paragraf deduktif/induktif/campuran, temukan gagasan utama
- Makna Kata & Istilah: arti kata dalam konteks kalimat/paragraf (termasuk kata serapan, istilah ilmiah)
- Simpulan Bacaan: inferensi logis dari wacana (tersirat, bukan eksplisit)
- Fakta & Opini: identifikasi kalimat fakta vs opini dalam wacana
Semua soal harus menggunakan wacana/teks (50-150 kata). Topik: lingkungan, pendidikan, kesehatan, teknologi, sosial-budaya, ekonomi.`,
  },
  lit_en: {
    label: "English Literacy (Literasi Bahasa Inggris)",
    subskills: ["Main Idea", "Inference", "Vocabulary in Context", "Detail Information"],
    context: `English Literacy for Indonesian university entrance exam (UTBK-level).
- Main Idea: identify the main idea/topic of a passage
- Inference: draw logical conclusions not explicitly stated in the text
- Vocabulary in Context: determine word meaning from context
- Detail Information: find explicitly stated information
ALL questions must be in English with an English passage (50-150 words). Topics: science, technology, environment, culture, education, health.
Options must be in English. Answer choices should be plausible but only one clearly correct.`,
  },
  mtk: {
    label: "Penalaran Matematika",
    subskills: ["Aljabar", "Aritmetika Sosial", "Geometri & Pengukuran", "Data & Statistika"],
    context: `Penalaran Matematika setara UTBK Matematika.
- Aljabar: persamaan/pertidaksamaan linear & kuadrat, SPLDV, fungsi, barisan aritmetika/geometri
- Aritmetika Sosial: persentase, keuntungan/kerugian, diskon, bunga tunggal/majemuk, kecepatan-jarak-waktu, skala
- Geometri & Pengukuran: luas, keliling, volume bangun datar & ruang, teorema Pythagoras, sudut, koordinat
- Data & Statistika: rata-rata, median, modus, jangkauan, histogram, diagram lingkaran/batang
Soal harus kontekstual (kehidupan nyata). Jawaban numerik yang jelas. Semua soal dalam Bahasa Indonesia.
PENTING: pastikan ada tepat satu jawaban yang benar secara matematis.`,
  },
};

const DIFFICULTIES: { key: string; label: string; timeRange: [number, number] }[] = [
  { key: "mudah", label: "mudah", timeRange: [30, 50] },
  { key: "sedang", label: "sedang", timeRange: [50, 80] },
  { key: "sulit", label: "sulit", timeRange: [80, 130] },
];

interface GeneratedQuestion {
  question: string;
  passage?: string | null;
  options: string[];
  correctAnswer: number;
  explanation: string;
  estimatedTime: number;
}

async function generateBatch(
  section: string,
  subskill: string,
  difficulty: string,
  count: number,
  batchIndex: number,
): Promise<GeneratedQuestion[]> {
  const sectionInfo = SECTIONS[section as keyof typeof SECTIONS];
  const diffInfo = DIFFICULTIES.find((d) => d.key === difficulty)!;

  const prompt = `You are an expert exam question writer for Indonesian university entrance exams (UNY/UTBK).
Create ${count} HIGH-QUALITY, UNIQUE practice questions.

Section: ${sectionInfo.label}
Subskill: ${subskill}
Difficulty: ${difficulty} (${difficulty === "mudah" ? "basic concept, 1-2 steps" : difficulty === "sedang" ? "requires analysis, 2-3 steps" : "multi-step, conceptual traps, deep reasoning"})
Batch: ${batchIndex} (make these completely different from other batches)

Section Guidelines:
${sectionInfo.context}

Quality Requirements:
1. ONLY ONE answer must be clearly correct — verify this
2. Distractors must be plausible but definitively wrong
3. Difficulty MUST match the requested level
4. No trivial or too-obvious questions
5. Explanations must be clear, step-by-step, educational
6. For passages: write original, factually accurate content
7. estimatedTime: realistic seconds for the difficulty level (${diffInfo.timeRange[0]}-${diffInfo.timeRange[1]} seconds range)

Return ONLY valid JSON (no markdown, no extra text):
{
  "questions": [
    {
      "question": "question text",
      "passage": "passage text if needed, else null",
      "options": ["A text", "B text", "C text", "D text", "E text"],
      "correctAnswer": 0,
      "explanation": "detailed step-by-step explanation why this is correct and why others are wrong",
      "estimatedTime": 45
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const text = response.text ?? '{"questions":[]}';
  const parsed = JSON.parse(text);
  return parsed.questions ?? [];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const outputPath = join(__dirname, "../../artifacts/uny-cbt/src/data/questions.ts");

  // Read existing questions file
  const existingContent = readFileSync(outputPath, "utf-8");
  const existingLines = existingContent.split("\n");

  // Find the closing bracket of QUESTIONS array
  // We'll insert before the last closing `];`
  const closingIdx = existingContent.lastIndexOf("];");

  if (closingIdx === -1) {
    throw new Error("Cannot find closing ]; in questions.ts");
  }

  const beforeClose = existingContent.slice(0, closingIdx);
  const afterClose = existingContent.slice(closingIdx);

  // Track existing IDs to avoid duplicates
  const existingIds = new Set<string>();
  const idMatches = existingContent.matchAll(/id: "([^"]+)"/g);
  for (const m of idMatches) existingIds.add(m[1]);

  console.log(`Existing questions: ${existingIds.size}`);

  const newQuestions: string[] = [];
  let totalGenerated = 0;

  // Generate: 4 sections × 4 subskills × 3 difficulties × 7 questions = 336 new questions
  const QUESTIONS_PER_BATCH = 7;

  for (const [sectionKey, sectionInfo] of Object.entries(SECTIONS)) {
    for (const subskill of sectionInfo.subskills) {
      for (const diff of DIFFICULTIES) {
        console.log(`\nGenerating ${sectionKey}/${subskill}/${diff.key}...`);

        let batchQuestions: GeneratedQuestion[] = [];
        let retries = 0;

        while (batchQuestions.length < QUESTIONS_PER_BATCH && retries < 3) {
          try {
            const questions = await generateBatch(
              sectionKey,
              subskill,
              diff.key,
              QUESTIONS_PER_BATCH,
              retries,
            );
            batchQuestions = questions.slice(0, QUESTIONS_PER_BATCH);
            break;
          } catch (err) {
            retries++;
            console.error(`Retry ${retries} for ${sectionKey}/${subskill}/${diff.key}:`, err);
            await sleep(3000 * retries);
          }
        }

        // Convert to TypeScript object strings
        batchQuestions.forEach((q, i) => {
          const id = `${sectionKey}-gen-${subskill.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${diff.key}-${String(totalGenerated + i + 1).padStart(3, "0")}`;

          if (existingIds.has(id)) return;

          const passageStr =
            q.passage && q.passage !== "null"
              ? `    passage: ${JSON.stringify(q.passage)},\n`
              : "";

          const optionsStr = q.options.map((o) => JSON.stringify(o)).join(", ");

          newQuestions.push(`  {
    id: ${JSON.stringify(id)},
    section: ${JSON.stringify(sectionKey)},
    subskill: ${JSON.stringify(subskill)},
    difficulty: ${JSON.stringify(diff.key)},
    sourceType: "uny_like",
    question: ${JSON.stringify(q.question)},
${passageStr}    options: [${optionsStr}],
    correctAnswer: ${q.correctAnswer},
    explanation: ${JSON.stringify(q.explanation)},
    estimatedTime: ${q.estimatedTime},
  }`);
        });

        totalGenerated += batchQuestions.length;
        console.log(`  Generated ${batchQuestions.length} questions (total: ${totalGenerated})`);

        // Rate limiting: small pause between requests
        await sleep(1500);
      }
    }
  }

  // Write the updated file
  const separator = beforeClose.trimEnd().endsWith(",") ? "\n" : ",\n";
  const newContent =
    beforeClose +
    separator +
    newQuestions.join(",\n") +
    ",\n" +
    afterClose;

  writeFileSync(outputPath, newContent, "utf-8");

  console.log(`\n✅ Done! Generated ${totalGenerated} new questions`);
  console.log(
    `📁 Total questions: ${existingIds.size + totalGenerated} (approx)`,
  );
  console.log(`📝 Written to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
