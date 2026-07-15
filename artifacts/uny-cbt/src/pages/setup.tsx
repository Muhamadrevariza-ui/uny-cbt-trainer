import { useState, useMemo } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { ArrowLeft, Play, CircleAlert as AlertCircle, BookOpen, Clock, Target, Layers, Coffee } from 'lucide-react';
import {
  useListWrongAnswers,
  useListTryoutSets,
  useGetTryoutSetItems,
  getListWrongAnswersQueryKey,
  getListTryoutSetsQueryKey,
  getGetTryoutSetItemsQueryKey,
  type WrongAnswer,
  type TryoutSet,
  type TryoutSetItem,
} from '@workspace/api-client-react';
import { saveActiveExam } from '@/lib/storage';
import {
  createActiveExam,
  pickFromSection,
  difficultyDistribution,
  FULL_TO_SESSIONS,
  MINI_TO_SESSIONS,
  singleSession,
  totalDurationWithBreaks,
  totalQuestionCount,
  type DifficultyFilter,
} from '@/lib/engine';
import { SECTION_IDS, SECTION_LABELS } from '@/lib/analysis';
import { QUESTIONS, SUBSKILLS } from '@/data/questions';
import type { ExamConfig, SectionId } from '@/lib/types';
import { fmtMinutes } from '@/lib/format';

const DIFFICULTY_OPTIONS: { value: DifficultyFilter; label: string }[] = [
  { value: "campuran", label: "Campuran" },
  { value: "mudah", label: "Mudah" },
  { value: "sedang", label: "Sedang" },
  { value: "sulit", label: "Sulit" },
];

export default function Setup() {
  const [, setLocation] = useLocation();
  const { mode, code } = useParams<{ mode: string; code?: string }>();

  const [selectedSection, setSelectedSection] = useState<SectionId>("tpa");
  const [selectedSubskill, setSelectedSubskill] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>("campuran");

  const { data: wrongAnswers } = useListWrongAnswers<WrongAnswer[]>({
    query: { queryKey: getListWrongAnswersQueryKey(), enabled: mode === "review" },
  });
  const { data: tryoutSets } = useListTryoutSets<TryoutSet[]>({
    query: { queryKey: getListTryoutSetsQueryKey(), enabled: mode === "tryout" },
  });
  const { data: tryoutItems, isLoading: tryoutItemsLoading } = useGetTryoutSetItems<TryoutSetItem[]>(code || "", {
    query: { queryKey: getGetTryoutSetItemsQueryKey(code || ""), enabled: mode === "tryout" && !!code },
  });

  const wrongIds = (wrongAnswers ?? []).map((w) => w.questionId);
  const tryoutSet = tryoutSets?.find((s) => s.code === code);

  const preview = useMemo(() => {
    let qIds: string[] = [];
    let title = "";
    let sessions = MINI_TO_SESSIONS;
    let durationSec = 0;
    let shuffleOptions = false;

    if (mode === "mini") {
      title = "Mini Try Out";
      sessions = MINI_TO_SESSIONS;
      durationSec = totalDurationWithBreaks(sessions);
      for (const s of sessions) {
        qIds.push(...pickFromSection(s.sectionId, s.questionCount).map(q => q.id));
      }
    } else if (mode === "full") {
      title = "Full Try Out (UTBK Style)";
      sessions = FULL_TO_SESSIONS;
      durationSec = totalDurationWithBreaks(sessions);
      for (const s of sessions) {
        qIds.push(...pickFromSection(s.sectionId, s.questionCount).map(q => q.id));
      }
    } else if (mode === "materi") {
      title = `Latihan: ${SECTION_LABELS[selectedSection]}`;
      const qs = pickFromSection(
        selectedSection,
        10,
        selectedSubskill === "all" ? undefined : selectedSubskill,
        selectedDifficulty,
      );
      qIds = qs.map(q => q.id);
      durationSec = Math.ceil(qs.reduce((acc, q) => acc + q.estimatedTime, 0) * 1.2 / 60) * 60 || 10 * 60;
      sessions = singleSession(selectedSection, qs.length, durationSec);
    } else if (mode === "review") {
      title = "Review Kesalahan";
      qIds = wrongIds.slice(0, 15);
      const qs = qIds.map(id => QUESTIONS.find(q => q.id === id)).filter(Boolean) as any[];
      durationSec = Math.ceil(qs.reduce((acc, q) => acc + q.estimatedTime, 0) * 1.2 / 60) * 60 || 15 * 60;
      const sectionId = (qs[0]?.section ?? "tpa") as SectionId;
      sessions = singleSession(sectionId, qs.length, durationSec);
    } else if (mode === "tryout") {
      title = tryoutSet?.label ?? "Paket Tryout";
      const fmt = tryoutSet?.examFormat;
      if (fmt?.sections) {
        sessions = (fmt.sections as any[]).map((s, i) => ({
          sectionId: s.sectionId,
          label: SECTION_LABELS[s.sectionId as SectionId] ?? s.sectionId,
          questionCount: s.questionCount,
          durationSec: s.durationSeconds,
          breakAfterSec: i < (fmt.sections as any[]).length - 1 ? 5 * 60 : 0,
        }));
      } else {
        sessions = FULL_TO_SESSIONS;
      }
      durationSec = totalDurationWithBreaks(sessions);
      // Dynamically pick questions per session from the question bank
      // (tryout_set_items may or may not be populated — if not, we pick fresh)
      const pinnedIds = (tryoutItems ?? []).map((it) => it.questionId);
      if (pinnedIds.length > 0) {
        qIds = pinnedIds;
      } else {
        for (const s of sessions) {
          qIds.push(...pickFromSection(s.sectionId as SectionId, s.questionCount).map(q => q.id));
        }
      }
    }

    const qs = qIds.map(id => QUESTIONS.find(q => q.id === id)).filter(Boolean) as any[];
    const diffs = difficultyDistribution(qs);

    return { qIds, title, durationSec, diffs, qs, sessions, shuffleOptions };
  }, [mode, selectedSection, selectedSubskill, selectedDifficulty, wrongIds, tryoutSet, tryoutItems]);

  const handleStart = () => {
    if (preview.qIds.length === 0) return;
    const config: ExamConfig = {
      mode: mode as any,
      title: preview.title,
      questionIds: preview.qIds,
      durationSec: preview.durationSec,
      shuffleOptions: false,
      tryoutSetCode: mode === "tryout" ? code : undefined,
      sessions: preview.sessions,
    };
    const exam = createActiveExam(config);
    saveActiveExam(exam);
    setLocation("/exam");
  };

  const isTryoutLoading = mode === "tryout" && (tryoutItemsLoading || !tryoutSets);
  const totalBreaks = preview.sessions.filter(s => s.breakAfterSec > 0).length;

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 active-elevate">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg text-slate-800 truncate">Setup {preview.title}</h1>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-6">
        {mode === "review" && wrongIds.length === 0 && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 p-5 rounded-2xl flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-orange-500" />
            <div>
              <p className="font-bold text-[15px]">Belum ada catatan soal salah.</p>
              <p className="text-sm opacity-90 mt-1.5 leading-relaxed font-medium">Kerjakan simulasi (Mini/Full/Materi) terlebih dahulu untuk mengumpulkan soal-soal yang perlu direview.</p>
            </div>
          </div>
        )}

        {mode === "tryout" && isTryoutLoading && (
          <div className="bg-white border border-slate-100 text-slate-500 p-5 rounded-2xl shadow-sm text-sm font-bold">
            Memuat paket tryout...
          </div>
        )}

        {mode === "tryout" && !isTryoutLoading && !tryoutSet && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 p-5 rounded-2xl flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-orange-500" />
            <div>
              <p className="font-bold text-[15px]">Paket tryout tidak ditemukan.</p>
            </div>
          </div>
        )}

        {mode === "tryout" && tryoutSet && (
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 p-5 rounded-2xl shadow-sm">
            <p className="font-bold text-[15px]">{tryoutSet.label}</p>
            {tryoutSet.description && <p className="text-sm opacity-80 mt-1.5 leading-relaxed font-medium">{tryoutSet.description}</p>}
            {tryoutSet.progress.status === "selesai" && (
              <p className="text-sm mt-2 font-bold">Skor terbaik sebelumnya: {tryoutSet.progress.bestScore}</p>
            )}
          </div>
        )}

        {mode === "materi" && (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-3 block uppercase tracking-wider px-1">Pilih Subtes</label>
              <div className="flex flex-col gap-2">
                {SECTION_IDS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSelectedSection(s); setSelectedSubskill("all"); }}
                    className={`p-4 rounded-2xl border-2 text-left text-sm font-bold transition-all ${selectedSection === s ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/30'}`}
                  >
                    {SECTION_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {SUBSKILLS[selectedSection] && SUBSKILLS[selectedSection].length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-3 block uppercase tracking-wider px-1">Pilih Topik (Opsional)</label>
                <div className="relative">
                  <select
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:border-primary focus:ring-0 transition-colors"
                    value={selectedSubskill}
                    onChange={e => setSelectedSubskill(e.target.value)}
                  >
                    <option value="all">Semua Topik (Campur)</option>
                    {SUBSKILLS[selectedSection].map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 mb-3 block uppercase tracking-wider px-1">Tingkat Kesulitan</label>
              <div className="grid grid-cols-4 gap-2">
                {DIFFICULTY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDifficulty(opt.value)}
                    className={`py-3 rounded-xl border-2 text-xs font-bold uppercase tracking-wider transition-all ${selectedDifficulty === opt.value ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Session breakdown for multi-session modes */}
        {(mode === "mini" || mode === "full" || mode === "tryout") && preview.sessions.length > 1 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-[15px]">
              <Layers className="w-5 h-5 text-primary" /> Struktur Sesi
            </h3>
            <div className="space-y-2">
              {preview.sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 text-[13px]">{s.label}</div>
                      <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{s.questionCount} soal • {Math.round(s.durationSec / 60)} menit</div>
                    </div>
                  </div>
                  {s.breakAfterSec > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                      <Coffee className="w-3.5 h-3.5" />
                      {Math.round(s.breakAfterSec / 60)}m istirahat
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mt-auto">
          <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Informasi Sesi</h3>

          <div className="flex items-center gap-4 py-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Jumlah Soal</span>
              <div className="font-black text-slate-800 text-lg mt-0.5">{preview.qIds.length} butir</div>
            </div>
          </div>

          <div className="flex items-center gap-4 py-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-500">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Estimasi Waktu</span>
              <div className="font-black text-slate-800 text-lg mt-0.5">{fmtMinutes(preview.durationSec)}</div>
            </div>
          </div>

          {totalBreaks > 0 && (
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                <Coffee className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Jeda Istirahat</span>
                <div className="font-black text-slate-800 text-lg mt-0.5">{totalBreaks} kali</div>
              </div>
            </div>
          )}

          <div className="mt-5 pt-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-3">Distribusi Kesulitan</span>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {preview.diffs.mudah > 0 && (
                <div style={{ flex: preview.diffs.mudah }} className="bg-green-400" />
              )}
              {preview.diffs.sedang > 0 && (
                <div style={{ flex: preview.diffs.sedang }} className="bg-amber-400" />
              )}
              {preview.diffs.sulit > 0 && (
                <div style={{ flex: preview.diffs.sulit }} className="bg-red-400" />
              )}
            </div>
            <div className="flex justify-between mt-3 text-[11px] font-bold uppercase tracking-wider">
              <span className="text-green-600">{preview.diffs.mudah} Mudah</span>
              <span className="text-amber-600">{preview.diffs.sedang} Sedang</span>
              <span className="text-red-600">{preview.diffs.sulit} Sulit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border-t sticky bottom-0 z-10 safe-area-bottom pb-6 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        <button
          onClick={handleStart}
          disabled={preview.qIds.length === 0}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active-elevate shadow-md transition-all hover:bg-primary/90"
        >
          <Play className="w-5 h-5 fill-current" />
          <span className="text-lg">Mulai Ujian</span>
        </button>
      </div>
    </div>
  );
}
