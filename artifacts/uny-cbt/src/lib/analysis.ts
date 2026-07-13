import type { ExamResult, SectionId } from "./types";

export const SECTION_LABELS: Record<SectionId, string> = {
  tpa: "Tes Potensi Akademik",
  lit_id: "Literasi Bahasa Indonesia",
  lit_en: "Literasi Bahasa Inggris",
  mtk: "Penalaran Matematika",
};

export const SECTION_SHORT: Record<SectionId, string> = {
  tpa: "TPA",
  lit_id: "Literasi Indo",
  lit_en: "Literasi Inggris",
  mtk: "Penalaran MTK",
};

export const SECTION_IDS: SectionId[] = ["tpa", "lit_id", "lit_en", "mtk"];

export interface SubskillStat {
  section: SectionId;
  subskill: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0-100
  avgTime: number; // seconds
  avgEstimated: number; // seconds
}

export interface OverallStats {
  totalExams: number;
  totalQuestions: number;
  totalCorrect: number;
  avgAccuracy: number;
  latestScore: number | null;
  sectionAccuracy: Partial<Record<SectionId, { accuracy: number; attempts: number }>>;
  strongestSection: SectionId | null;
  weakestSection: SectionId | null;
  subskills: SubskillStat[];
}

export function aggregate(history: ExamResult[]): OverallStats {
  const sectionAgg: Partial<Record<SectionId, { total: number; correct: number }>> = {};
  const subAgg = new Map<
    string,
    { section: SectionId; attempts: number; correct: number; time: number; est: number }
  >();
  let totalQuestions = 0;
  let totalCorrect = 0;

  for (const r of history) {
    for (const qr of r.questions) {
      totalQuestions++;
      if (qr.isCorrect) totalCorrect++;
      const s = qr.question.section;
      const sa = sectionAgg[s] ?? (sectionAgg[s] = { total: 0, correct: 0 });
      sa.total++;
      if (qr.isCorrect) sa.correct++;
      const key = `${s}::${qr.question.subskill}`;
      const sub =
        subAgg.get(key) ?? { section: s, attempts: 0, correct: 0, time: 0, est: 0 };
      sub.attempts++;
      if (qr.isCorrect) sub.correct++;
      sub.time += qr.timeSpent;
      sub.est += qr.question.estimatedTime;
      subAgg.set(key, sub);
    }
  }

  const sectionAccuracy: OverallStats["sectionAccuracy"] = {};
  for (const [s, v] of Object.entries(sectionAgg) as [SectionId, { total: number; correct: number }][]) {
    sectionAccuracy[s] = {
      accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      attempts: v.total,
    };
  }

  const ranked = (Object.entries(sectionAccuracy) as [SectionId, { accuracy: number; attempts: number }][])
    .filter(([, v]) => v.attempts >= 2)
    .sort((a, b) => b[1].accuracy - a[1].accuracy);

  const subskills: SubskillStat[] = [...subAgg.entries()].map(([key, v]) => ({
    section: v.section,
    subskill: key.split("::")[1],
    attempts: v.attempts,
    correct: v.correct,
    accuracy: v.attempts ? Math.round((v.correct / v.attempts) * 100) : 0,
    avgTime: v.attempts ? Math.round(v.time / v.attempts) : 0,
    avgEstimated: v.attempts ? Math.round(v.est / v.attempts) : 0,
  }));

  return {
    totalExams: history.length,
    totalQuestions,
    totalCorrect,
    avgAccuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    latestScore: history.length ? history[history.length - 1].score : null,
    sectionAccuracy,
    strongestSection: ranked.length ? ranked[0][0] : null,
    weakestSection: ranked.length ? ranked[ranked.length - 1][0] : null,
    subskills,
  };
}

export interface Recommendation {
  title: string;
  detail: string;
}

/** "Prioritas Belajar Berikutnya" — 3 data-driven recommendations. */
export function computePriorities(stats: OverallStats): Recommendation[] {
  const recs: Recommendation[] = [];
  const eligible = stats.subskills.filter((s) => s.attempts >= 2);

  const weakest = [...eligible].sort((a, b) => a.accuracy - b.accuracy);
  if (weakest[0] && weakest[0].accuracy < 100) {
    recs.push({
      title: `Perkuat ${weakest[0].subskill} (${SECTION_SHORT[weakest[0].section]})`,
      detail: `Akurasi baru ${weakest[0].accuracy}% dari ${weakest[0].attempts} soal. Latih ulang materi ini lewat "Latihan Per Materi".`,
    });
  }
  if (weakest[1] && weakest[1].accuracy < 80) {
    recs.push({
      title: `Tambah latihan ${weakest[1].subskill} (${SECTION_SHORT[weakest[1].section]})`,
      detail: `Akurasi ${weakest[1].accuracy}%. Konsistensi di materi ini akan menaikkan skor bagianmu.`,
    });
  }

  const slow = [...eligible]
    .filter((s) => s.avgTime > s.avgEstimated && s.avgEstimated > 0)
    .sort((a, b) => b.avgTime / b.avgEstimated - a.avgTime / a.avgEstimated);
  if (slow[0]) {
    recs.push({
      title: `Percepat pengerjaan ${slow[0].subskill}`,
      detail: `Rata-rata ${slow[0].avgTime} dtk/soal, di atas estimasi ${slow[0].avgEstimated} dtk. Latih strategi pengerjaan cepat dan eliminasi opsi.`,
    });
  }

  if (recs.length < 3 && stats.weakestSection) {
    recs.push({
      title: `Fokus pada ${SECTION_LABELS[stats.weakestSection]}`,
      detail: `Bagian dengan akurasi terendah (${stats.sectionAccuracy[stats.weakestSection]?.accuracy ?? 0}%). Jadwalkan sesi khusus untuk bagian ini.`,
    });
  }
  while (recs.length < 3) {
    recs.push(
      recs.length === 1
        ? {
            title: "Kerjakan simulasi rutin",
            detail: "Data masih terbatas. Selesaikan minimal 2-3 simulasi agar analisis subskill lebih akurat.",
          }
        : {
            title: "Coba Full TO untuk daya tahan",
            detail: "Simulasi panjang melatih manajemen waktu dan fokus — kunci saat CBT sesungguhnya.",
          },
    );
  }
  return recs.slice(0, 3);
}

export type ReadinessStatus = "Perlu Penguatan" | "Berkembang" | "Kompetitif" | "Sangat Kuat";

export interface Readiness {
  status: ReadinessStatus;
  score: number; // 0-100 internal indicator
  strengths: string[];
  weaknesses: string[];
  priorities: string[];
  enoughData: boolean;
}

/**
 * "Estimasi Kesiapan UNY" — indikator kesiapan latihan, BUKAN prediksi resmi.
 * Berdasarkan performa latihan di aplikasi ini saja.
 */
export function computeReadiness(history: ExamResult[]): Readiness {
  const stats = aggregate(history);
  const enoughData = stats.totalExams >= 1 && stats.totalQuestions >= 10;

  const acc = stats.avgAccuracy; // 0-100
  const mtk = stats.sectionAccuracy.mtk?.accuracy ?? acc * 0.8;
  const tpa = stats.sectionAccuracy.tpa?.accuracy ?? acc * 0.8;

  // consistency: 100 - spread between best and worst section
  const values = Object.values(stats.sectionAccuracy).map((v) => v.accuracy);
  const spread = values.length >= 2 ? Math.max(...values) - Math.min(...values) : 40;
  const consistency = Math.max(0, 100 - spread);

  // difficulty quality: share of correct answers that were sedang/sulit
  let hardCorrect = 0;
  let allCorrect = 0;
  for (const r of history)
    for (const qr of r.questions) {
      if (qr.isCorrect) {
        allCorrect++;
        if (qr.question.difficulty !== "mudah") hardCorrect++;
      }
    }
  const diffQuality = allCorrect ? (hardCorrect / allCorrect) * 100 : 0;

  // trend: last 3 vs earlier
  let trend = 50;
  if (history.length >= 4) {
    const recent = history.slice(-3);
    const earlier = history.slice(0, -3);
    const rAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
    const eAvg = earlier.reduce((a, b) => a + b.score, 0) / earlier.length;
    trend = Math.max(0, Math.min(100, 50 + (rAvg - eAvg) * 2));
  }

  const score = Math.round(
    acc * 0.3 + mtk * 0.25 + tpa * 0.15 + consistency * 0.1 + diffQuality * 0.1 + trend * 0.1,
  );

  let status: ReadinessStatus = "Perlu Penguatan";
  if (score >= 75) status = "Sangat Kuat";
  else if (score >= 60) status = "Kompetitif";
  else if (score >= 45) status = "Berkembang";

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const entries = Object.entries(stats.sectionAccuracy) as [SectionId, { accuracy: number; attempts: number }][];
  for (const [s, v] of entries) {
    if (v.accuracy >= 70) strengths.push(`${SECTION_LABELS[s]} (akurasi ${v.accuracy}%)`);
    else if (v.accuracy < 60) weaknesses.push(`${SECTION_LABELS[s]} (akurasi ${v.accuracy}%)`);
  }
  if (mtk >= 70) strengths.push("Penalaran Matematika kuat — penting untuk Statistika & Matematika UNY");
  if (diffQuality >= 60 && allCorrect >= 5) strengths.push("Mampu menjawab benar soal tingkat sedang-sulit");
  if (consistency < 60 && values.length >= 2) weaknesses.push("Performa antarbagian belum konsisten");

  const priorities = computePriorities(stats).map((r) => r.title);

  return { status, score, strengths, weaknesses, priorities, enoughData };
}
