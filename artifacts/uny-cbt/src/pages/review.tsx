import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { useGetAttempt, useExplainQuestion } from '@workspace/api-client-react';
import { attemptToExamResult } from '@/lib/adapt';
import { ArrowLeft, ChevronLeft, ChevronRight, Brain, CheckCircle, XCircle } from 'lucide-react';
import { SECTION_LABELS } from '@/lib/analysis';

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const { data: attempt, isLoading, isError } = useGetAttempt(id || "");
  const [qIndex, setQIndex] = useState(0);
  const explainMutation = useExplainQuestion();

  if (isLoading) return <div className="min-h-[100dvh] flex justify-center items-center bg-slate-50 font-bold text-slate-500">Memuat...</div>;
  if (isError || !attempt) return <div className="min-h-[100dvh] flex justify-center items-center bg-slate-50 font-bold text-slate-500">Data tidak ditemukan</div>;

  const result = attemptToExamResult(attempt);
  if (result.questions.length === 0) return <div className="min-h-[100dvh] flex justify-center items-center bg-slate-50 font-bold text-slate-500">Tidak ada soal</div>;

  const qr = result.questions[qIndex];
  const q = qr.question;

  const handleExplain = () => {
    explainMutation.mutate({
      data: {
        section: q.section,
        subskill: q.subskill,
        question: q.question,
        passage: q.passage,
        options: q.options,
        correctAnswer: q.correctAnswer,
        userAnswer: qr.userAnswer,
        basicExplanation: q.explanation
      }
    });
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col relative select-none">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <Link href={`/results/${result.id}`} className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 active-elevate">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center px-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Review Soal</div>
          <div className="font-bold text-slate-800 text-[15px] mt-0.5">{qIndex + 1} / {result.questions.length}</div>
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md ${qr.isCorrect ? 'bg-green-100 text-green-700' : qr.userAnswer === null ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'}`}>
              {qr.isCorrect ? 'BENAR' : qr.userAnswer === null ? 'KOSONG' : 'SALAH'}
            </span>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{SECTION_LABELS[q.section]} • {q.subskill}</span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${q.difficulty === 'mudah' ? 'bg-green-50 text-green-600' : q.difficulty === 'sedang' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
            {q.difficulty}
          </span>
        </div>

        {q.passage && (
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">
              {q.passage}
            </div>
          </div>
        )}

        <div className="p-5 bg-white mb-2 shadow-sm">
          <div className="text-[15px] text-slate-800 font-medium leading-relaxed mb-6" dangerouslySetInnerHTML={{__html: q.question}}></div>
          
          <div className="flex flex-col gap-3">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correctAnswer;
              const isUserAnswer = i === qr.userAnswer;
              
              let btnClass = "border-slate-200 bg-white opacity-50";
              let icon = <div className="w-8 h-8 rounded-full border-2 border-slate-300 flex items-center justify-center text-sm font-black text-slate-400">{String.fromCharCode(65 + i)}</div>;
              
              if (isCorrect) {
                btnClass = "border-green-500 bg-green-50 shadow-sm opacity-100 ring-2 ring-green-500/20";
                icon = <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />;
              } else if (isUserAnswer && !isCorrect) {
                btnClass = "border-red-400 bg-red-50 opacity-100";
                icon = <XCircle className="w-8 h-8 text-red-500 shrink-0" />;
              }

              return (
                <div key={i} className={`w-full text-left p-4 rounded-2xl border-2 flex items-start gap-4 ${btnClass}`}>
                  {icon}
                  <div className={`mt-1 flex-1 text-sm leading-relaxed ${isCorrect ? 'text-green-900 font-bold' : isUserAnswer ? 'text-red-900 font-semibold' : 'text-slate-600 font-medium'}`}>
                    {opt}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 pb-8">
          <div className="bg-blue-50/80 border-2 border-blue-100 rounded-3xl p-6 shadow-sm">
            <h3 className="font-black text-blue-900 mb-3 flex items-center gap-2 text-[15px] uppercase tracking-wider">
              <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-[11px]">{String.fromCharCode(65 + q.correctAnswer)}</span>
              Kunci Jawaban
            </h3>
            <p className="text-[14px] text-blue-900/80 leading-relaxed font-medium">{q.explanation}</p>
            
            <div className="mt-6 pt-6 border-t border-blue-200/50">
              {explainMutation.data && explainMutation.variables?.data.question === q.question ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-900/50 mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-indigo-500" /> Konsep Dasar</h4>
                    <p className="text-[14px] text-slate-800 font-bold leading-relaxed">{explainMutation.data.concept}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-900/50 mb-3">Penjelasan Detail</h4>
                    <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{explainMutation.data.detailedExplanation}</p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100/60 shadow-sm">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-800/60 mb-2">Tips Mengerjakan</h4>
                    <p className="text-[14px] text-amber-900/90 font-medium leading-relaxed">{explainMutation.data.tipForNext}</p>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleExplain}
                  disabled={explainMutation.isPending}
                  className="w-full bg-white text-indigo-700 border-2 border-indigo-100 py-4 rounded-2xl font-bold text-[15px] shadow-sm flex justify-center items-center gap-3 active-elevate transition-all hover:border-indigo-200"
                >
                  {explainMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                  ) : <Brain className="w-5 h-5" />}
                  Minta Penjelasan AI
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 flex gap-3 z-10 safe-area-bottom shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        <button 
          onClick={() => setQIndex(i => Math.max(0, i - 1))}
          disabled={qIndex === 0}
          className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-700 flex justify-center active-elevate disabled:opacity-30 disabled:bg-slate-50 bg-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-[2] py-4 flex flex-col justify-center items-center font-bold text-slate-800 text-[15px]">
          Soal {qIndex + 1}
        </div>
        <button 
          onClick={() => setQIndex(i => Math.min(result.questions.length - 1, i + 1))}
          disabled={qIndex === result.questions.length - 1}
          className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-700 flex justify-center active-elevate disabled:opacity-30 disabled:bg-slate-50 bg-white"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
