import { useParams, Link } from 'wouter';
import { getResult, getHistory } from '@/lib/storage';
import { aggregate, computePriorities, SECTION_LABELS } from '@/lib/analysis';
import { useAnalyzeExam } from '@workspace/api-client-react';
import { ArrowLeft, Brain, Sparkles, Target, CheckCircle2, XCircle, MinusCircle, Clock } from 'lucide-react';
import { fmtMinutes } from '@/lib/format';

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const result = getResult(id || "");
  const history = getHistory();
  const analyzeMutation = useAnalyzeExam();
  
  if (!result) return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 font-bold text-slate-500">Data tidak ditemukan</div>;

  const handleAIAnalyze = () => {
    analyzeMutation.mutate({
      data: {
        totalQuestions: result.totalQuestions,
        correct: result.correct,
        incorrect: result.incorrect,
        unanswered: result.unanswered,
        score: result.score,
        accuracy: result.accuracy,
        historyCount: history.length,
        sections: Object.entries(result.sections).map(([section, s]) => ({
          section,
          total: s!.total,
          correct: s!.correct,
          incorrect: s!.incorrect,
          unanswered: s!.unanswered,
          accuracy: s!.accuracy,
          subskills: []
        }))
      }
    });
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col pb-24 relative overflow-x-hidden">
      <div className="bg-primary text-primary-foreground px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white active-elevate">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-tight truncate">Hasil {result.title}</h1>
          <p className="text-[11px] font-medium text-primary-foreground/70 uppercase tracking-widest mt-0.5">{new Date(result.date).toLocaleString('id-ID').replace('.',':')}</p>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-6 -mt-1 bg-primary pb-12 rounded-b-[2.5rem] relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
        
        <div className="bg-white rounded-3xl p-6 shadow-xl flex flex-col items-center border border-white text-center relative z-10 mt-2">
          <div className="w-36 h-36 rounded-full bg-slate-50 flex items-center justify-center border-[10px] border-primary/5 mb-5 shadow-inner">
            <span className="text-6xl font-black text-slate-800 tracking-tighter">{result.score}</span>
          </div>
          <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Skor Akhir</h2>
          <p className="text-primary text-[15px] font-black">Akurasi {result.accuracy}%</p>
          
          <div className="grid grid-cols-4 gap-2 w-full mt-6 pt-6 border-t border-slate-100">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-lg font-black text-slate-800">{result.correct}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Benar</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-lg font-black text-slate-800">{result.incorrect}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Salah</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <MinusCircle className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-lg font-black text-slate-800">{result.unanswered}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kosong</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-lg font-black text-slate-800">{fmtMinutes(result.timeUsedSec).replace(' menit', 'm')}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Waktu</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-6 z-10 flex flex-col gap-6">
        
        {/* AI Analysis Button & Card */}
        {analyzeMutation.data ? (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 shadow-sm border border-indigo-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 blur-xl rounded-full"></div>
            
            <div className="flex items-center gap-2 text-indigo-700 font-bold mb-4 relative z-10 text-[15px]">
              <Sparkles className="w-5 h-5" /> Analisis AI
            </div>
            <p className="text-slate-700 text-sm leading-relaxed mb-6 font-medium relative z-10">{analyzeMutation.data.summary}</p>
            
            <div className="space-y-4 relative z-10">
              <div className="bg-white/60 rounded-2xl p-4 border border-white">
                <h4 className="text-[11px] font-black uppercase text-indigo-900/50 tracking-widest mb-3">Kekuatan Utama</h4>
                <ul className="text-sm text-slate-700 space-y-2.5">
                  {analyzeMutation.data.strengths.map((s, i) => (
                    <li key={i} className="flex gap-3 leading-snug">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="font-medium">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white/60 rounded-2xl p-4 border border-white">
                <h4 className="text-[11px] font-black uppercase text-indigo-900/50 tracking-widest mb-3">Fokus Perbaikan</h4>
                <ul className="text-sm text-slate-700 space-y-2.5">
                  {analyzeMutation.data.weaknesses.map((s, i) => (
                    <li key={i} className="flex gap-3 leading-snug">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-medium">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-5 bg-indigo-900 text-white rounded-[2rem] text-center shadow-lg relative z-10">
              <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mb-1.5">Status Kesiapan</div>
              <div className="text-xl font-black mb-3">{analyzeMutation.data.readinessLevel}</div>
              <div className="text-[13px] text-indigo-100 italic leading-relaxed px-2 font-medium">"{analyzeMutation.data.motivationalMessage}"</div>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleAIAnalyze}
            disabled={analyzeMutation.isPending}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-5 rounded-3xl shadow-md flex items-center justify-center gap-3 font-bold active-elevate disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {analyzeMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Brain className="w-6 h-6 transition-transform group-hover:scale-110" />
            )}
            <span className="text-[15px]">{analyzeMutation.isPending ? "Menganalisis Pola..." : "Minta Analisis AI"}</span>
          </button>
        )}

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-5 text-[15px]">Rincian Per Bagian</h3>
          <div className="space-y-6">
            {Object.entries(result.sections).map(([sec, stats]) => {
              if (!stats) return null;
              return (
                <div key={sec}>
                  <div className="flex justify-between items-end mb-2.5">
                    <span className="font-bold text-[13px] text-slate-700 uppercase tracking-wider">{SECTION_LABELS[sec as keyof typeof SECTION_LABELS]}</span>
                    <span className={`text-[13px] font-black ${stats.accuracy >= 70 ? 'text-green-500' : stats.accuracy >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{stats.accuracy}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    <div style={{width: `${(stats.correct/stats.total)*100}%`}} className="bg-green-500" />
                    <div style={{width: `${(stats.incorrect/stats.total)*100}%`}} className="bg-red-500" />
                  </div>
                  <div className="flex gap-4 mt-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span className="text-green-600">{stats.correct} Benar</span>
                    <span className="text-red-500">{stats.incorrect} Salah</span>
                    <span className="text-slate-400">{stats.unanswered} Kosong</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white/80 backdrop-blur-md border-t border-slate-200/50 p-4 flex gap-3 z-20 safe-area-bottom shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        <Link href={`/review/${result.id}`} className="flex-1 py-4 rounded-2xl border-2 border-primary text-primary font-black text-[15px] flex justify-center items-center active-elevate bg-white shadow-sm">
          Review Jawaban
        </Link>
        <Link href="/" className="flex-[1.2] py-4 rounded-2xl bg-primary text-white font-black text-[15px] flex justify-center items-center shadow-md active-elevate">
          Selesai
        </Link>
      </div>
    </div>
  );
}