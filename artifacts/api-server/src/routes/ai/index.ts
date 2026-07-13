import { Router } from "express";
import { ai } from "../../lib/gemini.js";
import {
  AnalyzeExamBody,
  ExplainQuestionBody,
  GenerateQuestionsBody,
} from "@workspace/api-zod";

const router = Router();

const MODEL = "gemini-2.5-flash";

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
        `- ${s.section}: ${s.correct}/${s.total} benar (${Math.round(s.accuracy)}%), detail subskill: ${s.subskills.map((sk) => `${sk.name} ${sk.correct}/${sk.attempts}`).join(", ")}`,
    )
    .join("\n");

  const prompt = `Kamu adalah konselor belajar ahli untuk persiapan masuk UNY (Universitas Negeri Yogyakarta). 
Seorang siswa baru saja menyelesaikan simulasi CBT dengan hasil berikut:

Total soal: ${totalQuestions}
Benar: ${correct}, Salah: ${incorrect}, Kosong: ${unanswered}
Skor: ${score}/100
Akurasi: ${accuracy}%
Total sesi latihan sebelumnya: ${historyCount}

Per bagian:
${sectionsText}

Seksi ujian UNY terdiri dari:
- TPA (Tes Potensi Akademik): Analogi Verbal, Silogisme, Deret Angka, Logika Analitik
- Literasi Bahasa Indonesia: Ide Pokok, Makna Kata & Istilah, Simpulan Bacaan, Fakta & Opini
- Literasi Bahasa Inggris: Main Idea, Inference, Vocabulary in Context, Detail Information
- Penalaran Matematika: Aljabar, Aritmetika Sosial, Geometri & Pengukuran, Data & Statistika

Berikan analisis dan saran belajar yang spesifik, jelas, dan memotivasi dalam Bahasa Indonesia.

Kembalikan HANYA JSON dengan format berikut (tanpa markdown, tanpa penjelasan tambahan):
{
  "summary": "ringkasan performa 2-3 kalimat",
  "strengths": ["kekuatan 1", "kekuatan 2"],
  "weaknesses": ["kelemahan 1", "kelemahan 2"],
  "recommendations": ["saran konkret 1", "saran konkret 2", "saran konkret 3", "saran konkret 4"],
  "readinessLevel": "Siap / Hampir Siap / Perlu Latihan Lebih / Belum Siap",
  "motivationalMessage": "pesan motivasi singkat 1-2 kalimat"
}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? "{}";
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
    lit_en: "Literasi Bahasa Inggris (English Literacy)",
    mtk: "Penalaran Matematika",
  };

  const letters = ["A", "B", "C", "D", "E"];
  const optionsText = options.map((o, i) => `${letters[i]}. ${o}`).join("\n");
  const userAnswerText =
    userAnswer !== null && userAnswer !== undefined
      ? `Jawaban siswa: ${letters[userAnswer]} (${userAnswer === correctAnswer ? "BENAR" : "SALAH"})`
      : "Siswa tidak menjawab soal ini";

  const prompt = `Kamu adalah tutor ahli untuk persiapan ujian masuk UNY.
Jelaskan secara detail soal berikut dalam Bahasa Indonesia agar siswa benar-benar memahami konsepnya.

Bagian: ${sectionNames[section] ?? section}
Subskill: ${subskill}
${passage ? `Teks/Wacana:\n"${passage}"\n` : ""}
Soal: ${question}

Pilihan jawaban:
${optionsText}

Jawaban benar: ${letters[correctAnswer]}. ${options[correctAnswer]}
${userAnswerText}

Penjelasan dasar (dari bank soal):
${basicExplanation}

Berikan penjelasan yang lebih mendalam, langkah demi langkah, dan tip untuk soal serupa.

Kembalikan HANYA JSON berikut (tanpa markdown):
{
  "detailedExplanation": "penjelasan langkah demi langkah yang detail dan mudah dipahami",
  "concept": "konsep atau skill utama yang diuji oleh soal ini",
  "tipForNext": "tip praktis untuk menghadapi soal serupa di masa mendatang"
}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? "{}";
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
    tpa: `Tes Potensi Akademik (TPA) untuk ujian masuk universitas Indonesia. 
Subskill yang ada: Analogi Verbal (hubungan kata), Silogisme (logika deduksi), Deret Angka (pola bilangan), Logika Analitik (urutan/posisi/kondisi logis).
Soal pilihan ganda 5 opsi (A-E), tidak ada pengurangan nilai untuk jawaban salah.`,
    lit_id: `Literasi Bahasa Indonesia untuk ujian UTBK/masuk universitas.
Subskill: Ide Pokok (gagasan utama paragraf), Makna Kata & Istilah (arti kata dalam konteks), Simpulan Bacaan (inferensi logis), Fakta & Opini (membedakan fakta vs opini).
Semua soal berbasis teks/wacana. Wacana boleh 1-3 paragraf.`,
    lit_en: `English Literacy (Literasi Bahasa Inggris) untuk ujian UTBK/masuk universitas Indonesia.
Subskill: Main Idea (gagasan utama), Inference (simpulan tersirat), Vocabulary in Context (makna kosakata dari konteks), Detail Information (informasi eksplisit).
Soal dalam Bahasa Inggris, pilihan ganda 5 opsi (A-E). Selalu sertakan passage/teks pendek.`,
    mtk: `Penalaran Matematika (Mathematical Reasoning) untuk ujian masuk universitas Indonesia.
Subskill: Aljabar (persamaan, pertidaksamaan, fungsi), Aritmetika Sosial (persentase, keuntungan, bunga), Geometri & Pengukuran (luas, volume, sudut), Data & Statistika (rata-rata, median, diagram).
Soal kontekstual dan berbasis penalaran, bukan hanya hitungan murni.`,
  };

  const difficultyGuide: Record<string, string> = {
    mudah: "Tingkat mudah: konsep dasar, 1-2 langkah penyelesaian, waktu perkiraan 30-45 detik",
    sedang:
      "Tingkat sedang: butuh satu konsep lanjutan atau 2-3 langkah, butuh analisis ringan, waktu perkiraan 45-75 detik",
    sulit:
      "Tingkat sulit: multi-step, jebakan konseptual, butuh analisis mendalam, waktu perkiraan 75-120 detik",
  };

  const prompt = `Kamu adalah pembuat soal profesional untuk persiapan ujian masuk UNY dan UTBK.
Buat ${safeCount} soal BARU dan UNIK untuk:

Bagian: ${sectionContext[section] ?? section}
Subskill spesifik: ${subskill}
Tingkat kesulitan: ${difficultyGuide[difficulty] ?? difficulty}

PERSYARATAN KUALITAS:
1. Soal harus realistis seperti soal UTBK atau ujian masuk UNY asli
2. Pastikan hanya ADA SATU jawaban yang benar
3. Distraktor (pengecoh) harus masuk akal dan menguji pemahaman mendalam
4. Untuk Literasi: selalu sertakan passage/teks yang relevan dan orisinal
5. Penjelasan harus menyeluruh dan edukatif
6. Estimasi waktu dalam detik (realistis untuk tingkat kesulitan)
7. JANGAN buat soal yang terlalu mudah/trivial untuk tingkat yang diminta
8. Untuk MTK: gunakan konteks nyata (kehidupan sehari-hari, bisnis, dll)

Kembalikan HANYA JSON berikut (tanpa markdown, pastikan valid JSON):
{
  "questions": [
    {
      "question": "teks soal",
      "passage": "teks wacana jika ada (null jika tidak ada)",
      "options": ["opsi A", "opsi B", "opsi C", "opsi D", "opsi E"],
      "correctAnswer": 0,
      "explanation": "penjelasan lengkap mengapa jawaban itu benar dan mengapa pilihan lain salah",
      "estimatedTime": 60
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? '{"questions":[]}';
    const result = JSON.parse(text);
    res.json({
      ...result,
      section,
      subskill,
      difficulty,
    });
  } catch (err) {
    req.log?.error({ err }, "AI generate-questions error");
    res.status(500).json({ error: "Gagal generate soal. Coba lagi nanti." });
  }
});

export default router;
