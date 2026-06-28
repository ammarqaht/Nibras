'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '../context';

type League   = { id:number; title:string; status:string; winPoints:number; drawPoints:number; };
type Standing = { rank:number; groupId:number; groupName:string; played:number; won:number; drawn:number; lost:number; goalsFor:number; goalsAgainst:number; goalDiff:number; points:number; isMyGroup:boolean; };
type Match    = { id:number; matchday:number; homeGroupId:number; awayGroupId:number; homeScore:number; awayScore:number; status:string; matchDate:string|null; homeName:string; awayName:string; isMyMatch:boolean; };

const MATCH_STATUS: Record<string,string> = { scheduled:'قادمة', live:'مباشر 🔴', finished:'منتهية' };

export default function StudentSportsLeague() {
  const { user } = useStudent();
  const [league,    setLeague]    = useState<League|null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches,   setMatches]   = useState<Match[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<'standings'|'matches'>('standings');
  const [matchFilter, setMatchFilter] = useState<'upcoming'|'results'|'all'>('upcoming');

  useEffect(() => {
    fetch('/api/student/sports')
      .then(r=>r.json())
      .then(d=>{
        setLeague(d.league||null);
        setStandings(d.standings||[]);
        setMatches(d.matches||[]);
      })
      .finally(()=>setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center" style={{color:'var(--ink-soft)'}}>جارٍ التحميل...</div>;

  const STATUS_COLORS: Record<string,{bg:string;color:string}> = {
    setup:    {bg:'#F3F4F6',color:'#6B7280'},
    active:   {bg:'#D1FAE5',color:'#065F46'},
    finished: {bg:'#EDE9FE',color:'#5B21B6'},
    archived: {bg:'#F3F4F6',color:'#9CA3AF'},
  };
  const STATUS_LABELS: Record<string,string> = { setup:'إعداد', active:'جارٍ', finished:'منتهي', archived:'مؤرشف' };
  const sc = league ? (STATUS_COLORS[league.status]||STATUS_COLORS.setup) : STATUS_COLORS.setup;

  const myStanding = standings.find(s=>s.isMyGroup);

  const filteredMatches = matches.filter(m =>
    matchFilter==='all'      ? true :
    matchFilter==='upcoming' ? ['scheduled','live'].includes(m.status) :
    m.status==='finished'
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 relative min-h-[50vh]">
      <div style={{ filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none' }} className="space-y-5">
        {/* League header */}
        <div className="rounded-2xl p-5 text-white" style={{background:'linear-gradient(135deg,#059669 0%,#047857 100%)'}}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs opacity-75 mb-1">مرحلة {user?.stage}</p>
              <h1 className="text-xl font-bold">{league?.title || 'الدوري الرياضي'}</h1>
              <p className="text-sm opacity-80 mt-1">فوز {league?.winPoints || 3} · تعادل {league?.drawPoints || 1}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{background:sc.bg,color:sc.color}}>
              {league ? (STATUS_LABELS[league.status]||league.status) : 'إعداد'}
            </span>
          </div>

          {/* My group standing highlight */}
          {myStanding && (
            <div className="mt-4 bg-white/20 rounded-xl p-3 flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">#{myStanding.rank}</p>
                <p className="text-xs opacity-75">ترتيب</p>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div className="flex-1">
                <p className="font-bold">{myStanding.groupName}</p>
                <p className="text-sm opacity-75">{myStanding.played} مبارة · {myStanding.points} نقطة</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">{myStanding.goalsFor}–{myStanding.goalsAgainst}</p>
                <p className="text-xs opacity-75">أهداف</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--bg-soft)'}}>
          {([['standings','الجدول'],['matches','المباريات']] as const).map(([t,lbl])=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab===t?'bg-white shadow-sm font-bold':''}`}
              style={{color:tab===t?'var(--accent-deep)':'var(--ink-soft)'}}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ── STANDINGS ── */}
        {tab==='standings' && (
          <div className="card overflow-x-auto">
            {standings.length===0
              ? <p className="p-10 text-center" style={{color:'var(--ink-soft)'}}>لا توجد نتائج بعد</p>
              : (
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr style={{background:'var(--bg-soft)'}}>
                      {['#','الفريق','لع','ف','ت','خ','فه','ن'].map(h=>(
                        <th key={h} className={`px-3 py-3 font-semibold ${h==='الفريق'?'text-right':'text-center'}`} style={{color:'var(--ink-soft)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{'--tw-divide-color':'var(--line)'}as React.CSSProperties}>
                    {standings.map((s,i)=>(
                      <tr key={s.groupId}
                        style={{background:s.isMyGroup?'#EEF3FC':i===0?'#FFFBEB':undefined,fontWeight:s.isMyGroup?700:undefined}}>
                        <td className="px-3 py-3 text-center font-bold" style={{color:'var(--ink-soft)'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                        <td className="px-3 py-3" style={{color:s.isMyGroup?'var(--blue)':'var(--ink)'}}>
                          {s.groupName}
                          {s.isMyGroup&&<span className="text-xs opacity-60 mr-1">(أسرتك)</span>}
                        </td>
                        <td className="px-3 py-3 text-center" style={{color:'var(--ink-soft)'}}>{s.played}</td>
                        <td className="px-3 py-3 text-center text-green-600 font-medium">{s.won}</td>
                        <td className="px-3 py-3 text-center" style={{color:'var(--ink-soft)'}}>{s.drawn}</td>
                        <td className="px-3 py-3 text-center text-red-500">{s.lost}</td>
                        <td className="px-3 py-3 text-center font-medium" style={{color:s.goalDiff>0?'#059669':s.goalDiff<0?'#DC2626':'var(--ink-soft)'}}>
                          {s.goalDiff>0?'+':''}{s.goalDiff}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-base" style={{color:'var(--accent-deep)'}}>{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        )}

        {/* ── MATCHES ── */}
        {tab==='matches' && (
          <div className="space-y-4">
            {/* Filter pills */}
            <div className="flex gap-2">
              {([['upcoming','القادمة'],['results','النتائج'],['all','الكل']] as const).map(([f,lbl])=>(
                <button key={f} onClick={()=>setMatchFilter(f)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                  style={{background:matchFilter===f?'var(--accent)':'var(--card)',color:matchFilter===f?'#fff':'var(--ink)',borderColor:'var(--line)'}}>
                  {lbl}
                </button>
              ))}
            </div>

            {filteredMatches.length===0
              ? <div className="card p-10 text-center" style={{color:'var(--ink-soft)'}}>لا توجد مباريات</div>
              : (
                <div className="space-y-3">
                  {filteredMatches.map(m=>(
                    <div key={m.id} className={`card p-4 ${m.isMyMatch?'border-2':''}`}
                      style={{borderColor:m.isMyMatch?'var(--accent)':undefined}}>
                      {m.matchDate&&<p className="text-xs text-center mb-2" style={{color:'var(--ink-soft)'}}>{m.matchDate}</p>}
                      <div className="flex items-center gap-3">
                        <span className={`flex-1 text-right text-sm font-bold ${m.homeGroupId===user?.groupId?'text-blue-600':''}`} style={{color:m.homeGroupId===user?.groupId?'var(--blue)':'var(--ink)'}}>{m.homeName}</span>
                        <div className="shrink-0 text-center">
                          {m.status==='finished'
                            ? <span className="text-xl font-bold tabular-nums" style={{color:'var(--ink)'}}>{m.homeScore} – {m.awayScore}</span>
                            : <span className="text-sm font-bold" style={{color:'var(--ink-soft)'}}>vs</span>
                          }
                          <p className="text-[11px] mt-0.5" style={{color:m.status==='live'?'#92400E':'var(--ink-soft)'}}>{MATCH_STATUS[m.status]||m.status}</p>
                        </div>
                        <span className={`flex-1 text-left text-sm font-bold`} style={{color:m.awayGroupId===user?.groupId?'var(--blue)':'var(--ink)'}}>{m.awayName}</span>
                      </div>
                      {m.isMyMatch && <p className="text-xs text-center mt-2 font-medium" style={{color:'var(--accent-deep)'}}>مباراة أسرتك</p>}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(250,250,247,0.3)', zIndex: 10 }}>
        <div className="text-center bg-white/95 backdrop-blur-md p-8 rounded-2xl border border-line shadow-2xl max-w-sm">
          <p className="text-5xl mb-4">🔧</p>
          <h2 className="font-display text-xl font-bold mb-3" style={{ color: 'var(--ink)' }}>صفحة الدوري قيد الصيانة</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            نعمل حالياً على تحديث الجداول وترتيب المجموعات ومنافسات الدوري الرياضي. ترقبوا الإطلاق قريباً! 🏆
          </p>
        </div>
      </div>
  );
}
