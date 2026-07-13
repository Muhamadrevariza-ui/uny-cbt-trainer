import { Router } from "express";
import { openai, AI_MODEL } from "../../lib/openrouter.js";
import {
  AnalyzeExamBody,
  ExplainQuestionBody,
  GenerateQuestionsBody,
} from "@workspace/api-zod";

const router = Router();

// POST /api/ai/analyze
router.post("/analyze", async (req, res) => {
  const parsed = AnalyzeExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { totalQuestions, correct, incorrect, unanswered, score, accuracy, sections, historyCount } =
    parsed.data;

  const sectionsText = sections
    .map(
      (s) =>
        `- ${s.section}: ${s.correct}/${s.total} benar (${Math.round(s.accuracy)}%) | subskill: ${s.subskills.map((sk) => `${sk.name} ${sk.correct}/${sk.attempts}`).join(", ")}`,
    )
    .join("\n");

  const prompt = `Kamu adalah konselor belajar ahli untuk persiapan masuk UNY (Universitas Negeri Yogyakarta).
Seorang siswa baru saja menyelesaikan simulasi CBT dengan hasil berikut:

Total soal: ${totalQuestions} | Benar: ${correct} | Salah: ${incorrect} | Kosong: ${unanswered}
Skor: ${score}/100 | Akurasi: ${accuracy}% | Sesi latihan sebelumnya: ${historyCount}

Per bagian:
${sectionsText}

Seksi ujian UNY:
- TPA: Analogi Verbal, Silogisme, Deret Angka, Logika Analitik
- Literasi Bahasa Indonesia: Ide Pokok, Makna Kata & Istilah, Simpulan Bacaan, Fakta & Opini
- Literasi Bahasa Inggris: Main Idea, Inference, Vocabulary in Context, Detail Information
- Penalaran Matematika: Aljabar, Aritmetika Sosial, Geometri & Pengukuran, Data & Statistika

Berikan analisis mendalam dan saran belajar SPESIFIK per subskill yang lemah. Jangan terlalu umum.
Gunakan data akurasi per subskill untuk menentukan prioritas belajar.

Return HANYA JSON ini (no markdown):
{
  "summary": "ringkasan performa 2-3 kalimat yang jujur dan spesifik",
  "strengths": ["kekuatan spesifik berdasarkan data 1", "kekuatan 2"],
  "weaknesses": ["kelemahan spesifik 1 dengan subskill & angka", "kelemahan 2"],
  "recommendations": [
    "saran konkret 1 (spesifik, actionable, sebutkan subskill)",
    "saran konkret 2",
    "saran konkret 3",
    "saran konkret 4"
  ],
  "readinessLevel": "Siap / Hampir Siap / Perlu Latihan Lebih / Belum Siap",
  "motivationalMessage": "pesan motivasi personal 1-2 kalimat berdasarkan progres siswa"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    req.log?.error({ err }, "AI analyze error");
    res.status(500).json({ error: "Gagal memproses analisis AI. Coba lagi nanti." });
  }
});

// POST /api/ai/explain
router.post("/explain", async (req, res) => {
  const parsed = ExplainQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { section, subskill, question, passage, options, correctAnswer, userAnswer, basicExplanation } =
    parsed.data;

  const sectionNames: Record<string, string> = {
    tpa: "Tes Potensi Akademik (TPA)",
    lit_id: "Literasi Bahasa Indonesia",
    lit_en: "English Literacy (Literasi Bahasa Inggris)",
    mtk: "Penalaran Matematika",
  };

  const letters = ["A", "B", "C", "D", "E"];
  const optionsText = options.map((o, i) => `${letters[i]}. ${o}`).join("\n");
  const userAnswerText =
    userAnswer !== null && userAnswer !== undefined
      ? `Jawaban siswa: ${letters[userAnswer]}. ${options[userAnswer]} → ${userAnswer === correctAnswer ? "✓ BENAR" : "✗ SALAH"}`
      : "Siswa tidak menjawab soal ini.";

  const prompt = `Kamu adalah tutor ahli untuk persiapan ujian masuk UNY dan UTBK.
Tugasmu: jelaskan soal ini secara mendalam agar siswa benar-benar PAHAM konsepnya — bukan hanya tahu jawabannya.

=== DATA SOAL ===
Bagian: ${sectionNames[section] ?? section}
Subskill: ${subskill}
${passage ? `Teks/Wacana:\n"${passage}"\n` : ""}
Soal: ${question}

Pilihan:
${optionsText}

Jawaban benar: ${letters[correctAnswer]}. ${options[correctAnswer]}
${userAnswerText}

Penjelasan dasar (dari bank soal): ${basicExplanation}
=================

Berikan penjelasan yang:
1. Menjelaskan MENGAPA jawaban benar itu benar (step by step jika perlu)
2. Menjelaskan mengapa pilihan-pilihan SALAH itu salah (terutama pengecoh yang tampak mirip)
3. Jika siswa salah, analisis kemungkinan kesalahan berpikir siswa
4. Berikan TIP praktis untuk menghadapi soal tipe ini dengan lebih cepat dan akurat

Return HANYA JSON ini (no markdown):
{
  "detailedExplanation": "penjelasan lengkap step-by-step, mencakup analisis pilihan yang salah",
  "concept": "konsep/skill inti yang diuji soal ini (1-2 kalimat)",
  "tipForNext": "tip konkret dan praktis untuk soal tipe serupa"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    req.log?.error({ err }, "AI explain error");
    res.status(500).json({ error: "Gagal memproses penjelasan AI. Coba lagi nanti." });
  }
});

// POST /api/ai/generate-questions
router.post("/generate-questions", async (req, res) => {
  const parsed = GenerateQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { section, subskill, difficulty, count = 5 } = parsed.data;
  const safeCount = Math.min(count, 10);

  const sectionContext: Record<string, string> = {
    tpa: `TPA (Tes Potensi Akademik) — ujian masuk universitas Indonesia.
Subskill: Analogi Verbal (hubungan sepasang kata A:B=C:?), Silogisme (deduksi logis dari premis), Deret Angka (pola bilangan), Logika Analitik (urutan/kondisi bersyarat).
Format: pilihan ganda 5 opsi (A-E). PASTIKAN hanya ada satu jawaban benar. Pengecoh harus masuk akal.`,
    lit_id: `Literasi Bahasa Indonesia — setara UTBK.
Subskill: Ide Pokok (gagasan utama), Makna Kata & Istilah (arti dalam konteks), Simpulan Bacaan (inferensi), Fakta & Opini.
WAJIB ada passage/wacana 80-150 kata. Topik: sains, sosial, lingkungan, teknologi, budaya.`,
    lit_en: `English Literacy for Indonesian university entrance exam (UTBK-style).
Subskill: Main Idea, Inference, Vocabulary in Context, Detail Information.
ALL text (question, options, passage) MUST be in English. Passage: 80-150 words, natural academic English.`,
    mtk: `Penalaran Matematika — setara UTBK Indonesia.
Subskill: Aljabar, Aritmetika Sosial, Geometri & Pengukuran, Data & Statistika.
Soal HARUS kontekstual (cerita nyata). VERIFIKASI jawaban matematisnya sebelum menulis. Bahasa Indonesia.`,
  };

  const difficultyGuide: Record<string, string> = {
    mudah: "Mudah: konsep dasar langsung diterapkan, 1-2 langkah, estimasi 30-50 detik",
    sedang: "Sedang: butuh 2-3 langkah atau satu konsep lanjutan, estimasi 50-80 detik",
    sulit: "Sulit: multi-langkah, jebakan konseptual yang halus, estimasi 80-120 detik",
  };

  const prompt = `Kamu adalah pembuat soal profesional level nasional untuk ujian masuk UNY dan UTBK.
Buat ${safeCount} soal BARU yang BENAR-BENAR berkualitas untuk:

Bagian: ${sectionContext[section] ?? section}
Subskill: ${subskill}
Tingkat: ${difficultyGuide[difficulty] ?? difficulty}

STANDAR KUALITAS WAJIB:
- Soal realistis seperti soal UTBK asli, bukan soal kelas biasa
- Tepat SATU jawaban benar — verifikasi sebelum menulis
- Pengecoh (distraktor) harus tampak menarik dan menguji pemahaman mendalam
- Penjelasan HARUS mencakup: mengapa jawaban benar, mengapa tiap distraktor salah
- Untuk MTK: cek ulang hitungan sebelum finalisasi
- Untuk Literasi: passage harus orisinal dan relevan dengan subskill yang diuji

Return HANYA JSON valid ini (no markdown, no extra text):
{
  "questions": [
    {
      "question": "teks soal",
      "passage": null,
      "options": ["opsi A", "opsi B", "opsi C", "opsi D", "opsi E"],
      "correctAnswer": 0,
      "explanation": "penjelasan mengapa benar + mengapa distraktor salah",
      "estimatedTime": 60
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content ?? '{"questions":[]}';
    const result = JSON.parse(text);
    res.json({ ...result, section, subskill, difficulty });
  } catch (err) {
    req.log?.error({ err }, "AI generate-questions error");
    res.status(500).json({ error: "Gagal generate soal. Coba lagi nanti." });
  }
});

export default router;
