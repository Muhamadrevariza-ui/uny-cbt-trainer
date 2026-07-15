import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useCreateAttempt } from '@workspace/api-client-react';
import { getActiveExam, clearActiveExam, saveActiveExam } from '@/lib/storage';
import { scoreExam, getSessionQuestionRange } from '@/lib/engine';
import { fmtClock } from '@/lib/format';
import { SECTION_LABELS } from '@/lib/analysis';
import { ChevronLeft, ChevronRight, CircleCheck as CheckCircle, GripHorizontal, X, Coffee, CircleAlert as AlertCircle } from 'lucide-react';
import type { ActiveExam } from '@/lib/types';

export default function Exam() {
  const [, setLocation] = useLocation();
  const [exam, setExam] = useState<ActiveExam | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createAttemptMutation = useCreateAttempt();

  const enteredAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const loaded = getActiveExam();
    if (!loaded) {
      setLocation("/");
    } else {
      setExam(loaded);
      enteredAtRef.current = Date.now();
    }
  }, [setLocation]);

  useEffect(() => {
    if (!exam) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [exam]);

  // Handle session timer expiry → start break or auto-advance to next session
  useEffect(() => {
    if (!exam || exam.onBreak) return;
    const sessionRemaining = Math.max(0, Math.floor((exam.sessionEndsAt - now) / 1000));
    if (sessionRemaining <= 0) {
      handleSessionEnd();
    }
  }, [now, exam]);

  // Handle break end → advance to next session
  useEffect(() => {
    if (!exam || !exam.onBreak) return;
    const breakRemaining = Math.max(0, Math.floor((exam.breakEndsAt - now) / 1000));
    if (breakRemaining <= 0) {
      startNextSession();
    }
  }, [now, exam]);

  if (!exam) return <div className="min-h-screen bg-slate-50 flex justify-center items-center font-bold text-slate-500">Memuat sesi ujian...</div>;

  // Break screen
  if (exam.onBreak) {
    const breakRemaining = Math.max(0, Math.floor((exam.breakEndsAt - now) / 1000));
    const nextSession = exam.sessions[exam.currentSession + 1];
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 max-w-sm w-full">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Coffee className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Istirahat</h2>
          <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
            Sesi {exam.currentSession + 1} selesai. Ambil napas sejenak sebelum melanjutkan ke sesi berikutnya.
          </p>
          <div className="bg-slate-50 rounded-2xl p-5 mb-6">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sesi Berikutnya</div>
            <div className="font-bold text-slate-800 text-sm">{nextSession?.label ?? "Selesai"}</div>
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              {nextSession?.questionCount ?? 0} soal • {Math.round((nextSession?.durationSec ?? 0) / 60)} menit
            </div>
          </div>
          <div className="font-mono font-black text-4xl text-slate-800 mb-6">{fmtClock(breakRemaining)}</div>
          <button
            onClick={startNextSession}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-md active-elevate transition-all hover:bg-primary/90"
          >
            Lanjut Sekarang
          </button>
          <button
            onClick={handleFinalSubmit}
            disabled={createAttemptMutation.isPending}
            className="w-full mt-3 text-slate-500 font-bold py-3 rounded-2xl hover:bg-slate-100 transition-colors text-sm"
          >
            Kumpulkan Hasil Saja
          </button>
        </div>
      </div>
    );
  }

  const qIndex = exam.currentIndex;
  const question = exam.questions[qIndex];
  const sessionRemaining = Math.max(0, Math.floor((exam.sessionEndsAt - now) / 1000));
  const isTimeLow = sessionRemaining < 60 && sessionRemaining > 0;
  const session = exam.sessions[exam.currentSession];
  const [sessStart, sessEnd] = getSessionQuestionRange(exam.sessions, exam.currentSession);
  const sessionAnsweredCount = exam.answers.slice(sessStart, sessEnd).filter(a => a !== null).length;
  const sessionTotal = sessEnd - sessStart;

  const flushTime = (st: ActiveExam, toIndex: number): ActiveExam => {
    const deltaSec = (Date.now() - enteredAtRef.current) / 1000;
    const newSpent = [...st.timeSpent];
    newSpent[st.currentIndex] += deltaSec;
    enteredAtRef.current = Date.now();
    return { ...st, timeSpent: newSpent, currentIndex: toIndex };
  };

  const navTo = (index: number) => {
    if (index < 0 || index >= exam.questions.length) return;
    setExam(prev => {
      if (!prev) return prev;
      const next = flushTime(prev, index);
      saveActiveExam(next);
      return next;
    });
    setIsDrawerOpen(false);
  };

  const handleAnswer = (optIndex: number) => {
    setExam(prev => {
      if (!prev) return prev;
      const ans = [...prev.answers];
      ans[prev.currentIndex] = ans[prev.currentIndex] === optIndex ? null : optIndex;
      const next = { ...prev, answers: ans };
      saveActiveExam(next);
      return next;
    });
  };

  const toggleDoubtful = () => {
    setExam(prev => {
      if (!prev) return prev;
      const d = [...prev.doubtful];
      d[prev.currentIndex] = !d[prev.currentIndex];
      const next = { ...prev, doubtful: d };
      saveActiveExam(next);
      return next;
    });
  };

  function handleSessionEnd() {
    setExam(prev => {
      if (!prev || prev.onBreak) return prev;
      const currentSess = prev.sessions[prev.currentSession];
      if (!currentSess || currentSess.breakAfterSec <= 0) {
        return handleFinalSubmitInternal(prev);
      }
      const breakEndsAt = Date.now() + currentSess.breakAfterSec * 1000;
      const next = { ...prev, onBreak: true, breakEndsAt };
      saveActiveExam(next);
      return next;
    });
  }

  function startNextSession() {
    setExam(prev => {
      if (!prev || !prev.onBreak) return prev;
      const nextSessionIdx = prev.currentSession + 1;
      if (nextSessionIdx >= prev.sessions.length) {
        return handleFinalSubmitInternal(prev);
      }
      const sess = prev.sessions[nextSessionIdx];
      const [start] = getSessionQuestionRange(prev.sessions, nextSessionIdx);
      const nowMs = Date.now();
      const next: ActiveExam = {
        ...prev,
        currentSession: nextSessionIdx,
        onBreak: false,
        currentIndex: start,
        sessionStartedAt: nowMs,
        sessionEndsAt: nowMs + sess.durationSec * 1000,
        breakEndsAt: 0,
      };
      enteredAtRef.current = nowMs;
      saveActiveExam(next);
      return next;
    });
  }

  function handleFinalSubmitInternal(st: ActiveExam): ActiveExam {
    const finalExam = flushTime(st, st.currentIndex);
    const result = scoreExam(finalExam);
    setSubmitError(null);
    createAttemptMutation.mutate(
      {
        data: {
          id: result.id,
          mode: result.mode,
          tryoutSetCode: result.tryoutSetCode ?? null,
          title: result.title,
          totalQuestions: result.totalQuestions,
          correct: result.correct,
          incorrect: result.incorrect,
          unanswered: result.unanswered,
          score: result.score,
          accuracy: result.accuracy,
          timeUsedSec: result.timeUsedSec,
          durationSec: result.durationSec,
          sections: result.sections as any,
          questions: result.questions as any,
        },
      },
      {
        onSuccess: () => {
          clearActiveExam();
          setLocation(`/results/${result.id}`);
        },
        onError: () => {
          setSubmitError("Gagal menyimpan hasil ujian. Periksa koneksi internet dan coba lagi.");
        },
      },
    );
    return st;
  }

  function handleFinalSubmit() {
    setExam(prev => {
      if (!prev) return prev;
      return handleFinalSubmitInternal(prev);
    });
  }

  const answeredCount = exam.answers.filter(a => a !== null).length;
  const doubtfulCount = exam.doubtful.filter(d => d).length;
  const unansweredCount = exam.questions.length - answeredCount;
  const isLastSession = exam.currentSession === exam.sessions.length - 1;
  const isLastQuestionInSession = qIndex === sessEnd - 1;

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col relative select-none">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2 -ml-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active-elevate"
        >
          <GripHorizontal className="w-5 h-5" />
        </button>

        <div className="text-center px-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Sesi {exam.currentSession + 1}/{exam.sessions.length} • {session?.label}
          </div>
          <div className="font-bold text-slate-800 text-[15px] mt-0.5">Soal {qIndex - sessStart + 1} / {sessionTotal}</div>
        </div>

        <div className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm border-2 ${isTimeLow ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
          {fmtClock(sessionRemaining)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {question.passage && (
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="bg-amber-50/60 border border-amber-100/60 rounded-2xl p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[30vh] overflow-y-auto font-serif">
              {question.passage}
            </div>
          </div>
        )}

        <div className="p-5 flex flex-col gap-6">
          <div className="text-[15px] text-slate-800 font-medium leading-relaxed" dangerouslySetInnerHTML={{__html: question.question}}></div>

          <div className="flex flex-col gap-3 mt-2">
            {question.options.map((opt, i) => {
              const isSelected = exam.answers[qIndex] === i;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-4 active-elevate ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-black text-sm border-2 transition-colors ${isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 text-slate-400'}`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div className={`mt-1 flex-1 text-sm leading-relaxed ${isSelected ? 'text-primary font-bold' : 'text-slate-700 font-medium'}`}>
                    {opt}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t p-4 flex gap-3 z-10 safe-area-bottom shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => navTo(qIndex - 1)}
          disabled={qIndex === sessStart}
          className="p-4 rounded-2xl border-2 border-slate-200 text-slate-700 disabled:opacity-30 disabled:bg-slate-50 active-elevate bg-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={toggleDoubtful}
          className={`flex-1 rounded-2xl font-bold text-[15px] transition-all active-elevate border-2 ${exam.doubtful[qIndex] ? 'bg-amber-400 border-amber-500 text-white shadow-sm' : 'bg-white border-amber-200 text-amber-600'}`}
        >
          {exam.doubtful[qIndex] ? "Diragukan" : "Ragukan"}
        </button>

        {isLastQuestionInSession ? (
          isLastSession ? (
            <button
              onClick={() => setIsSubmitOpen(true)}
              className="flex-[1.5] rounded-2xl font-bold text-[15px] bg-slate-900 text-white active-elevate shadow-sm"
            >
              Selesai
            </button>
          ) : (
            <button
              onClick={handleSessionEnd}
              className="flex-[1.5] rounded-2xl font-bold text-[15px] bg-slate-900 text-white active-elevate shadow-sm"
            >
              Sesi Selesai
            </button>
          )
        ) : (
          <button
            onClick={() => navTo(qIndex + 1)}
            className="flex-1 p-4 rounded-2xl border-2 border-primary bg-primary text-white flex justify-center active-elevate shadow-sm"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {isDrawerOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />
          <div className="bg-white rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg">Navigasi Soal</h3>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-slate-400 bg-slate-100 rounded-full hover:bg-slate-200 active-elevate">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {exam.sessions.map((s, si) => {
                const [ss, se] = getSessionQuestionRange(exam.sessions, si);
                const isCurrent = si === exam.currentSession;
                return (
                  <div key={si} className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap ${isCurrent ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {s.label} ({ss + 1}-{se})
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-5 gap-3 max-h-[40vh] overflow-y-auto pb-4 px-1 content-start">
              {exam.questions.map((q, i) => {
                const ans = exam.answers[i];
                const dbt = exam.doubtful[i];
                const isCurr = i === qIndex;
                const inCurrentSession = i >= sessStart && i < sessEnd;

                let btnClass = "bg-white text-slate-500 border-2 border-slate-200";
                if (!inCurrentSession) btnClass = "bg-slate-50 text-slate-300 border-2 border-slate-100";
                else if (ans !== null && !dbt) btnClass = "bg-primary text-white border-2 border-primary shadow-sm";
                else if (ans !== null && dbt) btnClass = "bg-amber-400 text-white border-2 border-amber-500 shadow-sm";
                else if (ans === null && dbt) btnClass = "bg-amber-50 text-amber-600 border-2 border-amber-300";

                if (isCurr) btnClass += " ring-4 ring-primary/20 ring-offset-2";

                return (
                  <button
                    key={i}
                    onClick={() => inCurrentSession && navTo(i)}
                    disabled={!inCurrentSession}
                    className={`aspect-square rounded-2xl font-black text-sm flex items-center justify-center transition-all active-elevate ${btnClass}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 justify-center">
              <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-primary shadow-sm" /> Dijawab</div>
              <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md bg-amber-400 shadow-sm" /> Ragu</div>
              <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md border-2 border-slate-200 bg-white" /> Kosong</div>
              <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-md border-2 border-slate-100 bg-slate-50" /> Sesi Lain</div>
            </div>

            <button
              onClick={() => { setIsDrawerOpen(false); setIsSubmitOpen(true); }}
              className="w-full mt-6 bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-md active-elevate text-[15px]"
            >
              Kumpulkan Ujian
            </button>
          </div>
        </div>
      )}

      {isSubmitOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>

            <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-5 mx-auto relative z-10">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-xl text-slate-800 text-center mb-1 relative z-10">Kumpulkan Jawaban?</h3>
            {!isLastSession && (
              <p className="text-center text-[12px] font-medium text-amber-600 mb-4 relative z-10 flex items-center justify-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Masih ada sesi yang belum dikerjakan
              </p>
            )}
            <p className="text-center text-[13px] font-medium text-slate-500 mb-6 relative z-10">Waktu tersisa sesi ini: <span className="font-mono font-bold">{fmtClock(sessionRemaining)}</span></p>

            <div className="bg-slate-50 rounded-2xl p-5 flex justify-between mb-8 border border-slate-100 relative z-10">
              <div className="text-center flex-1">
                <div className="text-3xl font-black text-primary">{answeredCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Dijawab</div>
              </div>
              <div className="w-px bg-slate-200 my-1" />
              <div className="text-center flex-1">
                <div className="text-3xl font-black text-amber-500">{doubtfulCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Ragu</div>
              </div>
              <div className="w-px bg-slate-200 my-1" />
              <div className="text-center flex-1">
                <div className="text-3xl font-black text-slate-300">{unansweredCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Kosong</div>
              </div>
            </div>

            {submitError && (
              <p className="text-center text-[13px] font-bold text-red-600 mb-4 relative z-10">{submitError}</p>
            )}

            <div className="flex gap-3 relative z-10">
              <button
                onClick={() => setIsSubmitOpen(false)}
                disabled={createAttemptMutation.isPending}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 active-elevate disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={createAttemptMutation.isPending}
                className="flex-1 py-4 rounded-2xl font-bold text-white bg-primary shadow-sm active-elevate disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {createAttemptMutation.isPending && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {createAttemptMutation.isPending ? "Menyimpan..." : "Ya, Kumpulkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
