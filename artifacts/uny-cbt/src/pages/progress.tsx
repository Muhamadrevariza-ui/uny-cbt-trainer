import { Link } from 'wouter';
import { useListAttempts } from '@workspace/api-client-react';
import { attemptToExamResult } from '@/lib/adapt';
import { aggregate, computeReadiness, computePriorities, SECTION_LABELS } from '@/lib/analysis';
import { ArrowLeft, TrendingUp, Target, Activity, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Progress() {
  const { data: attempts, isLoading } = useListAttempts();
  const history = (attempts ?? []).map(attemptToExamResult);
  const stats = aggregate(history);
  const readiness = history.length > 0 ? computeReadiness(history) : null;
  const priorities = computePriorities(stats);

  const chartData = history.slice(-10).map((h, i) => ({
    name: `TO ${i + 1}`,
    score: h.score,
  }));

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col pb-10">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 active-elevate">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg text-slate-800">Progress Belajar</h1>
      </div>

      {isLoading ? (
        <div className="p-5 text-sm font-bold text-slate-400">Memuat data progress...</div>
      ) : (
      <div className="p-5 flex flex-col gap-6">
        {readiness && (
          <div className="bg-gradient-to-br from-primary to-blue-700 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Target className="w-40 h-40 transform translate-x-4 -translate-y-4" />
            </div>
            <h2 className="font-black text-white/70 uppercase text-[11px] tracking-widest mb-3 relative z-10">Status Kesiapan UNY</h2>
            <div className="flex items-end gap-3 mb-6 relative z-10">
              <span className="text-6xl font-black tracking-tighter">{readiness.score}</span>
              <span className="text-xl font-bold text-white mb-2">{readiness.status}</span>
            </div>
            
            <div className="space-y-3 relative z-10 mt-6 pt-5 border-t border-white/20">
              {readiness.strengths.slice(0, 2).map((s, i) => (
                <div key={i} className="flex gap-3 text-sm font-medium leading-snug items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-300 shrink-0 mt-0.5" /> 
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {chartData.length > 1 && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-[15px] uppercase tracking-wider text-xs">
              <TrendingUp className="w-5 h-5 text-primary" /> Trend Skor (10 Terakhir)
            </h3>
            <div className="h-56 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} dx={-10} width={40} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                    labelStyle={{color: '#64748b', fontSize: '11px', textTransform: 'uppercase'}}
                  />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={4} dot={{r: 5, fill: 'hsl(var(--primary))', strokeWidth: 3, stroke: '#fff'}} activeDot={{r: 7}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2 text-[15px] uppercase tracking-wider text-xs">
            <Activity className="w-5 h-5 text-amber-500" /> Prioritas Belajar
          </h3>
          <div className="flex flex-col gap-3">
            {priorities.map((p, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <h4 className="font-bold text-[14px] text-slate-800 mb-1.5">{p.title}</h4>
                <p className="text-[13px] text-slate-500 leading-relaxed font-medium">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 mb-4 px-2 text-[12px] uppercase tracking-wider text-slate-500">Akurasi Per Subskill (Terlemah)</h3>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 p-4 bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="col-span-7">Subskill</div>
              <div className="col-span-2 text-center">Soal</div>
              <div className="col-span-3 text-right">Akurasi</div>
            </div>
            <div className="flex flex-col">
              {[...stats.subskills]
                .filter(s => s.attempts > 0)
                .sort((a, b) => a.accuracy - b.accuracy)
                .slice(0, 10)
                .map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 p-4 border-b border-slate-50 items-center last:border-0 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-7 pr-2">
                      <div className="text-[13px] font-bold text-slate-700 leading-tight mb-0.5">{s.subskill}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{SECTION_LABELS[s.section]}</div>
                    </div>
                    <div className="col-span-2 text-center text-[13px] font-bold text-slate-500">{s.attempts}</div>
                    <div className="col-span-3 flex flex-col items-end">
                      <span className={`text-[13px] font-black ${s.accuracy < 50 ? 'text-red-500' : s.accuracy < 70 ? 'text-amber-500' : 'text-green-500'}`}>{s.accuracy}%</span>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div style={{width: `${s.accuracy}%`}} className={`h-full rounded-full ${s.accuracy < 50 ? 'bg-red-500' : s.accuracy < 70 ? 'bg-amber-500' : 'bg-green-500'}`} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
