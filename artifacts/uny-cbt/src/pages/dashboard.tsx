import { Link } from 'wouter';
import { getHistory } from '@/lib/storage';
import { aggregate, computeReadiness } from '@/lib/analysis';
import { BookOpen, Target, Clock, Trophy, BarChart3, History, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const history = getHistory();
  const stats = aggregate(history);
  const readiness = history.length > 0 ? computeReadiness(history) : null;
  const recentHistory = [...history].reverse().slice(0, 5);

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col pb-10">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-[2rem] shadow-sm pb-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        
        <h1 className="text-2xl font-bold tracking-tight relative z-10">Halo, Pejuang UNY!</h1>
        <p className="opacity-90 text-sm mt-1 font-medium relative z-10">Siapkan dirimu untuk masuk kampus impian.</p>
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-6 relative z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="text-white/70 text-xs font-bold mb-1 uppercase tracking-wider">Skor Terakhir</div>
            <div className="text-3xl font-black">{stats.latestScore ?? '-'}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="text-white/70 text-xs font-bold mb-1 uppercase tracking-wider">Akurasi</div>
            <div className="text-3xl font-black">{stats.avgAccuracy}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="text-white/70 text-xs font-bold mb-1 uppercase tracking-wider">Soal Dijawab</div>
            <div className="text-2xl font-bold">{stats.totalQuestions}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="text-white/70 text-xs font-bold mb-1 uppercase tracking-wider">Simulasi</div>
            <div className="text-2xl font-bold">{stats.totalExams}</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 flex-1 flex flex-col gap-6 -mt-4">
        {readiness && readiness.enoughData && (
          <Link href="/progress" className="block w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-100 active-elevate relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-50 to-transparent flex items-center justify-end pr-4 text-slate-400">
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-slate-800">Estimasi Kesiapan</h2>
            </div>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-3xl font-black text-primary">{readiness.score}<span className="text-lg text-slate-400 font-bold">/100</span></span>
              <span className="text-xs font-bold text-slate-500 mb-1.5 px-2.5 py-1 bg-slate-100 rounded-md uppercase tracking-wider">{readiness.status}</span>
            </div>
          </Link>
        )}

        <div>
          <h2 className="font-bold text-slate-800 mb-3 text-lg flex items-center gap-2 px-1">
            <BookOpen className="w-5 h-5 text-slate-600" /> Mode Latihan
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/setup/mini" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 active-elevate group">
              <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center transition-colors group-hover:bg-blue-100">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-[15px]">Mini TO</div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">12 soal • 15 mnt</div>
              </div>
            </Link>
            <Link href="/setup/full" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 active-elevate group">
              <div className="bg-teal-50 text-teal-600 w-12 h-12 rounded-xl flex items-center justify-center transition-colors group-hover:bg-teal-100">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-[15px]">Full TO</div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">40 soal • 50 mnt</div>
              </div>
            </Link>
            <Link href="/setup/materi" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 active-elevate group">
              <div className="bg-purple-50 text-purple-600 w-12 h-12 rounded-xl flex items-center justify-center transition-colors group-hover:bg-purple-100">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-[15px]">Per Materi</div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Fokus kelemahan</div>
              </div>
            </Link>
            <Link href="/setup/review" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 active-elevate group">
              <div className="bg-orange-50 text-orange-600 w-12 h-12 rounded-xl flex items-center justify-center transition-colors group-hover:bg-orange-100">
                <History className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-[15px]">Review</div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Ulangi yang salah</div>
              </div>
            </Link>
          </div>
        </div>

        {recentHistory.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-800 mb-3 text-lg flex items-center gap-2 px-1">
              <BarChart3 className="w-5 h-5 text-slate-600" /> Riwayat Terakhir
            </h2>
            <div className="flex flex-col gap-3">
              {recentHistory.map(exam => (
                <Link key={exam.id} href={`/results/${exam.id}`} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active-elevate group">
                  <div className="flex-1 pr-4">
                    <div className="font-bold text-slate-800 text-[15px] truncate">{exam.title}</div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                      {new Date(exam.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ':')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-4 border-l border-slate-100">
                    <div className="text-xl font-black text-primary">{exam.score}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Skor</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-5 text-center">
              <Link href="/progress" className="text-primary text-sm font-bold uppercase tracking-wider py-2 px-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                Lihat Semua Progress
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}