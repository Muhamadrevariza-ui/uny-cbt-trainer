/**
 * One-off (idempotent) seed script: creates the UTBK-style exam format and
 * three non-overlapping tryout sets (TO #1/#2/#3), each with 30 questions
 * per section (120 total), matching the real UTBK SNBT structure.
 *
 * Safe to re-run: it upserts the exam format + tryout sets by unique `code`,
 * and replaces each set's items (delete + insert) rather than duplicating.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-tryout-sets
 */
import { db, examFormats, tryoutSets, tryoutSetItems, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { QUESTIONS } from "../../artifacts/uny-cbt/src/data/questions.ts";

type Difficulty = "mudah" | "sedang" | "sulit";
type SectionId = "tpa" | "lit_id" | "lit_en" | "mtk";

const SECTIONS: SectionId[] = ["tpa", "lit_id", "lit_en", "mtk"];
const QUESTIONS_PER_SECTION = 25;
const NUM_SETS = 3;

// Per-session timing based on real UTBK SNBT format
const SESSION_DURATIONS: Record<SectionId, number> = {
  tpa: 30 * 60,
  lit_id: 30 * 60,
  lit_en: 30 * 60,
  mtk: 45 * 60,
};

const BREAK_AFTER: Record<SectionId, number> = {
  tpa: 5 * 60,
  lit_id: 5 * 60,
  lit_en: 5 * 60,
  mtk: 0,
};

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function interleaveByDifficulty(pool: (typeof QUESTIONS)[number][], rand: () => number) {
  const byDiff: Record<Difficulty, (typeof QUESTIONS)[number][]> = {
    mudah: shuffle(pool.filter((q) => q.difficulty === "mudah"), rand),
    sedang: shuffle(pool.filter((q) => q.difficulty === "sedang"), rand),
    sulit: shuffle(pool.filter((q) => q.difficulty === "sulit"), rand),
  };
  const order: Difficulty[] = ["mudah", "sedang", "sulit"];
  const picked: (typeof QUESTIONS)[number][] = [];
  let i = 0;
  while (byDiff.mudah.length || byDiff.sedang.length || byDiff.sulit.length) {
    const d = order[i % 3];
    const q = byDiff[d].shift();
    if (q) picked.push(q);
    i++;
  }
  return picked;
}

async function main() {
  const rand = mulberry32(42);

  console.log("Seeding UTBK-style exam format...");
  const formatCode = "utbk-snbt-2026";
  const sections = SECTIONS.map((sectionId, order) => ({
    sectionId,
    questionCount: QUESTIONS_PER_SECTION,
    durationSeconds: SESSION_DURATIONS[sectionId],
    order,
  }));

  const totalQuestions = QUESTIONS_PER_SECTION * SECTIONS.length;
  const totalDuration = SECTIONS.reduce((acc, s) => acc + SESSION_DURATIONS[s] + BREAK_AFTER[s], 0);

  const [format] = await db
    .insert(examFormats)
    .values({
      code: formatCode,
      label: "UTBK SNBT Style (100 Soal)",
      description:
        "Struktur ujian menyerupai UTBK SNBT: 4 sesi (TPA, Literasi Indo, Literasi Inggris, Penalaran MTK), masing-masing 25 soal dengan waktu per sesi dan jeda istirahat antar sesi.",
      sections,
      totalQuestions,
      totalDurationSeconds: totalDuration,
      sourceNotes: "Berdasarkan riset format UTBK SNBT 2024-2026 (150 soal/195 menit). Disesuaikan menjadi 100 soal dengan rasio waktu yang setara.",
      status: "active",
    })
    .onConflictDoUpdate({
      target: examFormats.code,
      set: {
        label: "UTBK SNBT Style (100 Soal)",
        sections,
        totalQuestions,
        totalDurationSeconds: totalDuration,
      },
    })
    .returning();

  if (!format) throw new Error("Failed to upsert exam format");
  console.log(`Exam format ready: ${format.code} (id=${format.id})`);

  const setQuestionIds: string[][][] = Array.from({ length: NUM_SETS }, () => []);
  for (const section of SECTIONS) {
    const pool = QUESTIONS.filter((q) => q.section === section);
    const interleaved = interleaveByDifficulty(pool, rand);
    const needed = QUESTIONS_PER_SECTION * NUM_SETS;
    if (interleaved.length < needed) {
      throw new Error(
        `Section ${section} only has ${interleaved.length} questions, need ${needed} for ${NUM_SETS} non-overlapping sets.`,
      );
    }
    for (let s = 0; s < NUM_SETS; s++) {
      const slice = interleaved.slice(s * QUESTIONS_PER_SECTION, (s + 1) * QUESTIONS_PER_SECTION);
      setQuestionIds[s].push(...slice.map((q) => q.id));
    }
  }

  for (let s = 0; s < NUM_SETS; s++) {
    const code = `to-${s + 1}`;
    const label = `Tryout Set #${s + 1}`;

    const [set] = await db
      .insert(tryoutSets)
      .values({
        code,
        label,
        description: `Paket soal tetap #${s + 1}, 120 soal (30 per sesi) dengan struktur UTBK SNBT.`,
        examFormatId: format.id,
        orderIndex: s,
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: tryoutSets.code,
        set: { label, examFormatId: format.id, orderIndex: s, isPublished: true },
      })
      .returning();

    if (!set) throw new Error(`Failed to upsert tryout set ${code}`);

    await db.delete(tryoutSetItems).where(eq(tryoutSetItems.tryoutSetId, set.id));

    const ids = setQuestionIds[s];
    const items = ids.map((id, orderIndex) => {
      const q = QUESTIONS.find((qq) => qq.id === id)!;
      return {
        tryoutSetId: set.id,
        questionId: q.id,
        sectionId: q.section,
        subskill: q.subskill,
        difficulty: q.difficulty,
        orderIndex,
      };
    });

    await db.insert(tryoutSetItems).values(items);
    console.log(`Tryout set ${code} (id=${set.id}): ${items.length} questions pinned.`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
