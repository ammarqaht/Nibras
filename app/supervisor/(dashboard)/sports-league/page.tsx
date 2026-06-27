'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSupervisor } from '@/components/SupervisorShell';
import { pushToast } from '@/components/Toast';

type League   = { id:number; stage:string; title:string; status:string; };
type Match    = { id:number; leagueId:number; matchday:number; homeGroupId:number; awayGroupId:number; homeScore:number; awayScore:number; status:string; };
type Goal     = { id:number; matchId:number; teamGroupId:number; scorerName:string; };
type Card     = { id:number; matchId:number; leagueId:number; studentId:number; studentName:string; groupId:number; cardType:string; suspensionMatches:number; suspensionServed:boolean; punishedAt:string|null; };
type Behavior = { id:number; leagueId:number; matchId:number|null; studentName:string; groupId:number; type:string; description:string; createdAt:string; };
type Standing = { groupId:number; played:number; won:number; drawn:number; lost:number; goalsFor:number; goalsAgainst:number; goalDiff:number; points:number; };
type Group    = { id:number; name:string; stage:string; };
type Student  = { id:number; studentName:string; groupId:number|null; stage:string; };

const STAGES = ['ابتدائي','متوسط','ثانوي'];
const STATUS_BADGE: Record<string,{cls:string;label:string}> = {
  setup:    {cls:'pill-gray',   label:'إعداد'},
  active:   {cls:'pill-green',  label:'جارٍ'},
  finished: {cls:'pill-blue',   label:'منتهي'},
  archived: {cls:'pill-gray',   label:'مؤرشف'},
};
const MATCH_STATUS: Record<string,{cls:string;label:string}> = {
  scheduled:{cls:'pill-gray',label:'قادمة'},
  live:     {cls:'pill-yellow',label:'مباشر 🔴'},
  finished: {cls:'pill-green',label:'منتهية'},
};

function computeStandings(matches:Match[], teamIds:number[], win=2, draw=1, loss=0): Standing[] {
  const map = new Map<number,Standing>();
  const ensure = (gid:number) => {
    if (!map.has(gid)) map.set(gid,{groupId:gid,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDiff:0,points:0});
    return map.get(gid)!;
  };
  for (const gid of teamIds) ensure(gid);
  for (const m of matches){ ensure(m.homeGroupId); ensure(m.awayGroupId); }
  for (const m of matches.filter(m=>m.status==='finished')){
    const h=ensure(m.homeGroupId),a=ensure(m.awayGroupId);
    h.played++;a.played++;
    h.goalsFor+=m.homeScore;h.goalsAgainst+=m.awayScore;
    a.goalsFor+=m.awayScore;a.goalsAgainst+=m.homeScore;
    if(m.homeScore>m.awayScore){h.won++;h.points+=win;a.lost++;a.points+=loss;}
    else if(m.homeScore<m.awayScore){a.won++;a.points+=win;h.lost++;h.points+=loss;}
    else{h.drawn++;h.points+=draw;a.drawn++;a.points+=draw;}
  }
  for(const[,s]of map)s.goalDiff=s.goalsFor-s.goalsAgainst;
  return Array.from(map.values()).sort((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff||b.goalsFor-a.goalsFor);
}

export default function SportsLeaguePage() {
  const { user } = useSupervisor();
  const canEdit = user?.role?.split(',').map(r=>r.trim()).some(r=>['admin','sports_supervisor'].includes(r)) ?? false;

  const [leagues,  setLeagues]  = useState<League[]>([]);
  const [groups,   setGroups]   = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading,  setLoading]  = useState(true);

  // create-league modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title:'', stage:STAGES[0] });

  // league detail modal
  const [openLeague, setOpenLeague] = useState<League|null>(null);
  const [modalTab, setModalTab]     = useState<'teams'|'matches'|'cards'|'behavior'>('matches');
  const [matches,  setMatches]      = useState<Match[]>([]);
  const [cards,    setCards]        = useState<Card[]>([]);
  const [behaviors,setBehaviors]    = useState<Behavior[]>([]);
  const [goals,    setGoals]        = useState<Goal[]>([]);
  const [expandedMatch, setExpandedMatch] = useState<number|null>(null);
  const [actionsOpen,   setActionsOpen]   = useState(false);
  const [cardsView,     setCardsView]     = useState<'active'|'log'>('active');

  // forms
  const [showAddMatch,  setShowAddMatch]  = useState(false);
  const [matchForm,     setMatchForm]     = useState({ homeGroupId:'', awayGroupId:'' });
  const [showGoalForm,  setShowGoalForm]  = useState(false);
  const [goalForm,      setGoalForm]      = useState({ matchId:0, teamGroupId:'', scorerName:'' });
  const [showCardForm,  setShowCardForm]  = useState(false);
  const [cardForm,      setCardForm]      = useState({ matchId:0, groupId:'', studentId:'', studentName:'', cardType:'yellow' });
  const [showBehaviorForm, setShowBehaviorForm] = useState(false);
  const [behaviorForm,  setBehaviorForm]  = useState({ matchId:0, groupId:'', studentId:'', studentName:'', behaviorType:'positive', description:'' });

  const api = useCallback(async (url:string, opts?:RequestInit) => {
    const r = await fetch(url, opts); return r.json();
  }, []);

  // ── derived ──
  const groupName     = (id:number) => groups.find(g=>g.id===id)?.name || `فريق ${id}`;
  const stageGroups   = openLeague ? groups.filter(g=>g.stage===openLeague.stage) : [];
  const stageStudents = openLeague ? students.filter(s=>s.stage===openLeague.stage) : [];
  const groupStudents = (gid:number|string) => gid ? stageStudents.filter(s=>s.groupId===Number(gid)) : [];
  const standings     = computeStandings(matches, stageGroups.map(g=>g.id));
  const activeCards   = cards.filter(c=>!c.punishedAt);
  const punishedCards = cards.filter(c=>c.punishedAt);
  const suspensions   = activeCards.filter(c=>c.suspensionMatches>0 && !c.suspensionServed);
  const matchGoals    = (mid:number) => goals.filter(g=>g.matchId===mid);
  const matchCards    = (mid:number) => cards.filter(c=>c.matchId===mid);
  const topScorers = (() => {
    const map = new Map<string,{name:string;groupId:number;count:number}>();
    for (const g of goals){ const k=`${g.scorerName}|${g.teamGroupId}`; if(!map.has(k)) map.set(k,{name:g.scorerName,groupId:g.teamGroupId,count:0}); map.get(k)!.count++; }
    return Array.from(map.values()).sort((a,b)=>b.count-a.count).slice(0,10);
  })();

  // ── load ──
  useEffect(()=>{
    Promise.all([
      fetch('/api/supervisor/groups').then(r=>r.json()),
      fetch('/api/supervisor/students').then(r=>r.json()),
      fetch('/api/supervisor/sports/leagues').then(r=>r.json()),
    ]).then(([gd,sd,ld])=>{
      setGroups(gd.groups||[]); setStudents(sd.students||[]); setLeagues(ld.leagues||[]);
      setLoading(false);
    });
  },[]);

  const openLeagueModal = async (l:League) => {
    setOpenLeague(l); setModalTab('matches'); setExpandedMatch(null); setActionsOpen(false); setCardsView('active');
    const [md,cd,bd,gd] = await Promise.all([
      api(`/api/supervisor/sports/matches?leagueId=${l.id}`),
      api(`/api/supervisor/sports/events?type=cards&leagueId=${l.id}`),
      api(`/api/supervisor/sports/events?type=behaviors&leagueId=${l.id}`),
      api(`/api/supervisor/sports/events?type=goals&leagueId=${l.id}`),
    ]);
    setMatches(md.matches||[]); setCards(cd.cards||[]); setBehaviors(bd.behaviors||[]); setGoals(gd.goals||[]);
  };

  // ── league actions ──
  const createLeague = async () => {
    if (!createForm.title.trim()) return;
    const d = await api('/api/supervisor/sports/leagues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage:createForm.stage,title:createForm.title,pointsEnabled:false,winPoints:2,drawPoints:1,lossPoints:0})});
    if (d.league){ setLeagues(p=>[d.league,...p]); setShowCreate(false); setCreateForm({title:'',stage:STAGES[0]}); pushToast('success','تم إنشاء الدوري'); }
  };
  const setLeagueStatus = async (status:string) => {
    if (!openLeague) return;
    const d = await api('/api/supervisor/sports/leagues',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:openLeague.id,status})});
    if (d.league){ setLeagues(p=>p.map(l=>l.id===d.league.id?d.league:l)); setOpenLeague(d.league); }
  };
  const deleteLeague = async () => {
    if (!openLeague || !confirm('حذف الدوري نهائياً بكل مبارياته وبطاقاته؟')) return;
    await api(`/api/supervisor/sports/leagues?id=${openLeague.id}`,{method:'DELETE'});
    setLeagues(p=>p.filter(l=>l.id!==openLeague.id)); setOpenLeague(null);
    pushToast('info','تم حذف الدوري');
  };

  // ── match actions ──
  const addMatch = async () => {
    if (!openLeague || !matchForm.homeGroupId || !matchForm.awayGroupId) return;
    const d = await api('/api/supervisor/sports/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leagueId:openLeague.id,matchday:1,homeGroupId:Number(matchForm.homeGroupId),awayGroupId:Number(matchForm.awayGroupId)})});
    if (d.match){ setMatches(p=>[...p,d.match]); setShowAddMatch(false); setMatchForm({homeGroupId:'',awayGroupId:''}); }
  };
  const deleteMatch = async (mid:number) => {
    if (!confirm('حذف المباراة؟')) return;
    await api(`/api/supervisor/sports/matches?id=${mid}`,{method:'DELETE'});
    setMatches(p=>p.filter(m=>m.id!==mid));
  };
  const patchMatch = async (mid:number, patch:Partial<Match>) => {
    const d = await api('/api/supervisor/sports/matches',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:mid,...patch})});
    if (d.match) setMatches(p=>p.map(m=>m.id===d.match.id?d.match:m));
    return d.match as Match|undefined;
  };
  const adjustScore = async (m:Match, side:'home'|'away', delta:number) => {
    const cur = side==='home'?m.homeScore:m.awayScore;
    await patchMatch(m.id, side==='home'?{homeScore:Math.max(0,cur+delta)}:{awayScore:Math.max(0,cur+delta)});
  };

  // ── goal / card / behavior ──
  const openScorer = (m:Match, teamGroupId:number) => { setGoalForm({matchId:m.id,teamGroupId:String(teamGroupId),scorerName:''}); setShowGoalForm(true); };
  const addGoal = async () => {
    const m = matches.find(x=>x.id===goalForm.matchId); if(!m||!goalForm.teamGroupId||!goalForm.scorerName.trim()) return;
    const d = await api('/api/supervisor/sports/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'goal',matchId:m.id,teamGroupId:Number(goalForm.teamGroupId),scorerName:goalForm.scorerName})});
    if (d.goal){ setGoals(p=>[...p,d.goal]); await adjustScore(m, Number(goalForm.teamGroupId)===m.homeGroupId?'home':'away', 1); setShowGoalForm(false); setGoalForm({matchId:0,teamGroupId:'',scorerName:''}); }
  };
  const removeGoal = async (g:Goal) => {
    const m = matches.find(x=>x.id===g.matchId);
    await api(`/api/supervisor/sports/events?type=goal&id=${g.id}`,{method:'DELETE'});
    setGoals(p=>p.filter(x=>x.id!==g.id));
    if (m) await adjustScore(m, g.teamGroupId===m.homeGroupId?'home':'away', -1);
  };
  const openCard = (m:Match) => { setCardForm({matchId:m.id,groupId:String(m.homeGroupId),studentId:'',studentName:'',cardType:'yellow'}); setShowCardForm(true); };
  const addCard = async () => {
    if (!openLeague || !cardForm.matchId || !cardForm.groupId || !cardForm.studentName.trim()) return;
    const d = await api('/api/supervisor/sports/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'card',matchId:cardForm.matchId,leagueId:openLeague.id,groupId:Number(cardForm.groupId),studentId:Number(cardForm.studentId)||0,studentName:cardForm.studentName,cardType:cardForm.cardType})});
    if (d.card){ setCards(p=>[...p,d.card]); setShowCardForm(false); setCardForm({matchId:0,groupId:'',studentId:'',studentName:'',cardType:'yellow'}); }
  };
  const removeCard = async (id:number) => { await api(`/api/supervisor/sports/events?type=card&id=${id}`,{method:'DELETE'}); setCards(p=>p.filter(c=>c.id!==id)); };
  const markPunished = async (id:number) => {
    const now = new Date().toISOString();
    await api('/api/supervisor/sports/events',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'card',id,punishedAt:now})});
    setCards(p=>p.map(c=>c.id===id?{...c,punishedAt:now,suspensionServed:true}:c));
  };
  const openBehavior = (m?:Match) => { setBehaviorForm({matchId:m?.id||0,groupId:m?String(m.homeGroupId):'',studentId:'',studentName:'',behaviorType:'positive',description:''}); setShowBehaviorForm(true); };
  const addBehavior = async () => {
    if (!openLeague || !behaviorForm.groupId || !behaviorForm.studentName.trim() || !behaviorForm.description.trim()) return;
    const d = await api('/api/supervisor/sports/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'behavior',leagueId:openLeague.id,matchId:behaviorForm.matchId||null,groupId:Number(behaviorForm.groupId),studentId:Number(behaviorForm.studentId)||0,studentName:behaviorForm.studentName,behaviorType:behaviorForm.behaviorType,description:behaviorForm.description})});
    if (d.behavior){ setBehaviors(p=>[d.behavior,...p]); setShowBehaviorForm(false); setBehaviorForm({matchId:0,groupId:'',studentId:'',studentName:'',behaviorType:'positive',description:''}); }
  };

  // ── render ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 bg-brand/10">⚽</span>
          <div>
            <h1 className="text-2xl font-bold text-ink-900">الدوري الرياضي</h1>
            <p className="text-sm text-ink-500">دوريات الأسر لكل مرحلة</p>
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary text-sm flex items-center gap-1.5" onClick={()=>{ setCreateForm({title:'',stage:STAGES[0]}); setShowCreate(true); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            إضافة دوري
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-16 text-center text-ink-400 text-sm">جارٍ التحميل…</div>
      ) : (
        <div className="space-y-6">
          {STAGES.map(stage => {
            const stageLeagues = leagues.filter(l=>l.stage===stage);
            return (
              <section key={stage}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-bold text-ink-800">مرحلة {stage}</h2>
                  <span className="text-xs text-ink-400">({stageLeagues.length} دوري)</span>
                </div>
                {stageLeagues.length === 0 ? (
                  <div className="card p-8 text-center text-ink-400 text-sm border border-dashed">
                    لا يوجد دوري لهذه المرحلة بعد
                    {canEdit && <button className="block mx-auto mt-3 btn btn-secondary text-sm" onClick={()=>{ setCreateForm({title:'',stage}); setShowCreate(true); }}>+ إنشاء دوري لمرحلة {stage}</button>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {stageLeagues.map(l => {
                      const sb = STATUS_BADGE[l.status]||STATUS_BADGE.setup;
                      return (
                        <button key={l.id} onClick={()=>openLeagueModal(l)}
                          className="card p-4 text-right hover:shadow-md hover:-translate-y-0.5 transition-all border border-ink-150">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-ink-900">{l.title}</span>
                            <span className={`pill ${sb.cls} text-xs shrink-0`}>{sb.label}</span>
                          </div>
                          <span className="text-xs text-brand-600 font-semibold mt-3 inline-flex items-center gap-1">
                            فتح الدوري
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ════ LEAGUE DETAIL MODAL ════ */}
      {openLeague && (
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50" onClick={()=>setOpenLeague(null)}>
          <div className="modal-panel w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            {/* header */}
            <div className="p-4 border-b border-ink-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-ink-900">{openLeague.title}</h2>
                  {(()=>{const sb=STATUS_BADGE[openLeague.status]||STATUS_BADGE.setup;return <span className={`pill ${sb.cls} text-xs`}>{sb.label}</span>;})()}
                  <span className="text-xs text-ink-400">مرحلة {openLeague.stage}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canEdit && (
                    <button className="btn btn-secondary text-xs py-1.5 px-2.5" onClick={()=>setActionsOpen(o=>!o)}>إجراءات الدوري</button>
                  )}
                  <button onClick={()=>setOpenLeague(null)} className="btn btn-ghost p-2" aria-label="إغلاق">✕</button>
                </div>
              </div>
              {canEdit && actionsOpen && (
                <div className="flex flex-wrap gap-2 mt-3 fade-in">
                  {openLeague.status==='setup'    && <button className="btn btn-primary text-xs py-1.5 px-3" onClick={()=>setLeagueStatus('active')}>▶ بدء الدوري</button>}
                  {openLeague.status==='active'   && <button className="btn btn-secondary text-xs py-1.5 px-3" onClick={()=>setLeagueStatus('finished')}>⏹ إنهاء الدوري</button>}
                  {(openLeague.status==='active'||openLeague.status==='finished') && <button className="btn btn-secondary text-xs py-1.5 px-3" onClick={()=>setLeagueStatus('archived')}>🗄 أرشفة</button>}
                  {openLeague.status==='archived' && <button className="btn btn-primary text-xs py-1.5 px-3" onClick={()=>setLeagueStatus('active')}>↩ إعادة تفعيل</button>}
                  <button className="btn btn-danger text-xs py-1.5 px-3" onClick={deleteLeague}>🗑 حذف الدوري</button>
                </div>
              )}
              {/* tabs */}
              <div className="flex gap-2 mt-3 overflow-x-auto scroll-soft">
                {([['teams','قائمة الفرق'],['matches','المباريات'],['cards','البطاقات'],['behavior','السلوك']] as const).map(([t,lbl])=>(
                  <button key={t} onClick={()=>setModalTab(t)}
                    className={`choice py-1.5 px-3 text-sm font-bold shrink-0 ${modalTab===t?'is-active':''}`}>
                    {lbl}{t==='cards'&&suspensions.length>0 && <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-nred-600 text-white text-[10px]">{suspensions.length}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* body */}
            <div className="p-4 overflow-y-auto scroll-soft flex-1">
              {/* TEAMS / STANDINGS */}
              {modalTab==='teams' && (
                <div className="space-y-5 fade-in">
                  <div className="card p-0 overflow-hidden">
                    <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-100 font-bold text-sm text-ink-800">ترتيب الفرق</div>
                    <StandingsTable standings={standings} groupName={groupName}/>
                  </div>
                  <div className="card p-0 overflow-hidden">
                    <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-100 font-bold text-sm text-ink-800">أكثر الهدّافين</div>
                    {topScorers.length===0 ? <p className="p-6 text-center text-ink-400 text-sm">لا أهداف مسجّلة بعد</p>
                      : <div className="divide-y divide-ink-100">
                          {topScorers.map((s,i)=>(
                            <div key={`${s.name}-${s.groupId}`} className="flex items-center gap-3 px-4 py-2.5">
                              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-ink-50 text-ink-600 shrink-0">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
                              <div className="flex-1 min-w-0"><p className="text-sm font-bold text-ink-900 truncate">{s.name}</p><p className="text-xs text-ink-400">{groupName(s.groupId)}</p></div>
                              <span className="text-base font-bold text-brand-600">{s.count}</span>
                            </div>
                          ))}
                        </div>}
                  </div>
                </div>
              )}

              {/* MATCHES */}
              {modalTab==='matches' && (
                <div className="space-y-3 fade-in">
                  {canEdit && (
                    <div className="flex justify-end">
                      <button className="btn btn-primary text-sm" onClick={()=>{ setMatchForm({homeGroupId:'',awayGroupId:''}); setShowAddMatch(true); }}>+ إضافة مباراة</button>
                    </div>
                  )}
                  {matches.length===0 ? <div className="card p-10 text-center text-ink-400 text-sm">لا توجد مباريات بعد</div>
                    : matches.map(m=>{
                        const ms = MATCH_STATUS[m.status]||MATCH_STATUS.scheduled;
                        const open = expandedMatch===m.id;
                        return (
                          <div key={m.id} className="card p-0 overflow-hidden border border-ink-150">
                            <button onClick={()=>setExpandedMatch(open?null:m.id)} className="w-full p-4 flex items-center gap-3 text-right hover:bg-cream-50/40 transition-colors">
                              <span className="flex-1 text-right font-bold text-ink-900 truncate">{groupName(m.homeGroupId)}</span>
                              <div className="shrink-0 text-center">
                                <div className="text-xl font-bold tabular-nums text-ink-900">{m.homeScore} – {m.awayScore}</div>
                                <span className={`pill ${ms.cls} text-[10px] py-0.5 px-2`}>{ms.label}</span>
                              </div>
                              <span className="flex-1 text-left font-bold text-ink-900 truncate">{groupName(m.awayGroupId)}</span>
                              <svg className={`w-4 h-4 text-ink-300 shrink-0 transition-transform ${open?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>

                            {open && (
                              <div className="border-t border-ink-100 p-4 space-y-4 fade-in bg-cream-50/30">
                                {/* score editing */}
                                {canEdit && (
                                  <div className="flex items-center justify-center gap-3 sm:gap-5">
                                    <div className="flex-1 text-center min-w-0"><p className="text-xs text-ink-400 mb-1 truncate">{groupName(m.homeGroupId)}</p>
                                      <div className="flex items-center justify-center gap-1.5">
                                        <RoundBtn label="−" onClick={()=>adjustScore(m,'home',-1)}/>
                                        <span className="text-2xl font-bold tabular-nums w-7 text-center">{m.homeScore}</span>
                                        <RoundBtn label="+" accent onClick={()=>openScorer(m,m.homeGroupId)}/>
                                      </div>
                                    </div>
                                    <span className="text-ink-300 font-bold">–</span>
                                    <div className="flex-1 text-center min-w-0"><p className="text-xs text-ink-400 mb-1 truncate">{groupName(m.awayGroupId)}</p>
                                      <div className="flex items-center justify-center gap-1.5">
                                        <RoundBtn label="−" onClick={()=>adjustScore(m,'away',-1)}/>
                                        <span className="text-2xl font-bold tabular-nums w-7 text-center">{m.awayScore}</span>
                                        <RoundBtn label="+" accent onClick={()=>openScorer(m,m.awayGroupId)}/>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* status */}
                                {canEdit && (
                                  <div className="flex gap-2 justify-center flex-wrap">
                                    {(['scheduled','live','finished'] as const).map(st=>(
                                      <button key={st} onClick={()=>patchMatch(m.id,{status:st})}
                                        className={`choice text-xs py-1 px-3 ${m.status===st?'is-active':''}`}>{MATCH_STATUS[st].label}</button>
                                    ))}
                                  </div>
                                )}

                                {/* goals + cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="rounded-xl border border-ink-150 p-3 space-y-2 bg-white">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-ink-800">⚽ الأهداف ({matchGoals(m.id).length})</p>
                                      {canEdit && <button className="text-xs font-bold text-brand-600" onClick={()=>openScorer(m,m.homeGroupId)}>+ هدف</button>}
                                    </div>
                                    {matchGoals(m.id).length===0 ? <p className="text-xs text-ink-400 text-center py-1">لا أهداف</p>
                                      : matchGoals(m.id).map(g=>(
                                          <div key={g.id} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 bg-cream-50">
                                            <span>⚽</span><span className="flex-1 font-medium text-ink-800 truncate">{g.scorerName}</span>
                                            <span className="text-xs text-ink-400 shrink-0">{groupName(g.teamGroupId)}</span>
                                            {canEdit && <button className="text-nred-400 hover:text-nred-600 text-xs" onClick={()=>removeGoal(g)}>✕</button>}
                                          </div>
                                        ))}
                                  </div>
                                  <div className="rounded-xl border border-ink-150 p-3 space-y-2 bg-white">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-ink-800">🟨 البطاقات ({matchCards(m.id).length})</p>
                                      {canEdit && <button className="text-xs font-bold text-brand-600" onClick={()=>openCard(m)}>+ بطاقة</button>}
                                    </div>
                                    {matchCards(m.id).length===0 ? <p className="text-xs text-ink-400 text-center py-1">لا بطاقات</p>
                                      : matchCards(m.id).map(c=>(
                                          <div key={c.id} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 bg-cream-50">
                                            <span>{c.cardType==='yellow'?'🟨':'🟥'}</span><span className="flex-1 font-medium text-ink-800 truncate">{c.studentName}</span>
                                            {c.suspensionMatches>0 && <span className="pill pill-red text-[10px] py-0.5 px-1.5">إيقاف</span>}
                                            {canEdit && <button className="text-nred-400 hover:text-nred-600 text-xs" onClick={()=>removeCard(c.id)}>✕</button>}
                                          </div>
                                        ))}
                                  </div>
                                </div>

                                {canEdit && (
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <button className="btn btn-secondary text-xs py-1.5 px-3" onClick={()=>openBehavior(m)}>+ ملاحظة سلوكية</button>
                                    <button className="btn text-xs py-1.5 px-3 text-nred-600 border-nred-200 bg-nred-50 hover:bg-nred-100" onClick={()=>deleteMatch(m.id)}>حذف المباراة</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                </div>
              )}

              {/* CARDS */}
              {modalTab==='cards' && (
                <div className="space-y-4 fade-in">
                  <div className="flex gap-1 p-1 rounded-xl w-fit bg-ink-50">
                    {([['active','البطاقات النشطة'],['log','سجل المخالفات']] as const).map(([v,lbl])=>(
                      <button key={v} onClick={()=>setCardsView(v)} className={`choice py-1.5 px-3 text-sm ${cardsView===v?'is-active':''}`}>
                        {lbl}{v==='log'&&punishedCards.length>0 && <span className="mr-1 text-xs">({punishedCards.length})</span>}
                      </button>
                    ))}
                  </div>
                  {cardsView==='active' ? (
                    <>
                      {suspensions.length>0 && (
                        <div className="rounded-xl p-3 bg-yellow-50 border border-yellow-250">
                          <p className="text-sm font-bold text-yellow-700">⚠️ لاعبون موقوفون — {suspensions.length}</p>
                          <p className="text-xs text-yellow-700/80 mt-0.5">اضغط «تم المعاقبة» بعد تنفيذ الإيقاف لنقل المخالفة إلى السجل.</p>
                        </div>
                      )}
                      <div className="card p-0 overflow-hidden divide-y divide-ink-100">
                        <p className="px-4 py-2.5 font-bold text-sm text-ink-800 bg-ink-50">البطاقات النشطة ({activeCards.length})</p>
                        {activeCards.length===0 ? <p className="px-4 py-6 text-center text-ink-400 text-sm">لا توجد بطاقات نشطة</p>
                          : activeCards.map(c=>(
                              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                                <span className="text-xl shrink-0">{c.cardType==='yellow'?'🟨':'🟥'}</span>
                                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-ink-900 truncate">{c.studentName}</p><p className="text-xs text-ink-400">{groupName(c.groupId)}</p></div>
                                {c.suspensionMatches>0 && <span className="pill pill-red text-xs shrink-0">إيقاف {c.suspensionMatches}م</span>}
                                {canEdit && <button className="btn btn-primary text-xs py-1.5 px-3 shrink-0" onClick={()=>markPunished(c.id)}>تم المعاقبة</button>}
                              </div>
                            ))}
                      </div>
                    </>
                  ) : (
                    <div className="card p-0 overflow-hidden divide-y divide-ink-100">
                      <p className="px-4 py-2.5 font-bold text-sm text-ink-800 bg-ink-50">سجل المخالفات المُنفَّذة ({punishedCards.length})</p>
                      {punishedCards.length===0 ? <p className="px-4 py-6 text-center text-ink-400 text-sm">لا توجد مخالفات منفّذة بعد</p>
                        : punishedCards.map(c=>(
                            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                              <span className="text-xl shrink-0 opacity-70">{c.cardType==='yellow'?'🟨':'🟥'}</span>
                              <div className="flex-1 min-w-0"><p className="text-sm font-bold text-ink-900 truncate">{c.studentName}</p><p className="text-xs text-ink-400">{groupName(c.groupId)}</p></div>
                              <div className="text-left shrink-0"><span className="pill pill-green text-[10px] py-0.5 px-2">تمت المعاقبة</span><p className="text-[11px] text-ink-400 mt-0.5">{c.punishedAt?new Date(c.punishedAt).toLocaleDateString('ar-SA'):''}</p></div>
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              )}

              {/* BEHAVIOR */}
              {modalTab==='behavior' && (
                <div className="space-y-4 fade-in">
                  {canEdit && <div className="flex justify-end"><button className="btn btn-primary text-sm" onClick={()=>openBehavior()}>+ إضافة ملاحظة</button></div>}
                  <div className="card p-0 overflow-hidden divide-y divide-ink-100">
                    {behaviors.length===0 ? <p className="px-4 py-10 text-center text-ink-400 text-sm">لا توجد ملاحظات سلوكية</p>
                      : behaviors.map(b=>(
                          <div key={b.id} className="flex gap-3 p-4">
                            <span className="text-xl mt-0.5">{b.type==='positive'?'✅':'❌'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-ink-900">{b.studentName} — {groupName(b.groupId)}</p>
                              <p className="text-sm text-ink-700 mt-0.5">{b.description}</p>
                              <p className="text-xs text-ink-400 mt-1">{new Date(b.createdAt).toLocaleDateString('ar-SA')}</p>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE LEAGUE */}
      {showCreate && (
        <Modal title="إنشاء دوري جديد" onClose={()=>setShowCreate(false)}>
          <div className="space-y-4">
            <Field label="المرحلة">
              <select className="field mt-1" value={createForm.stage} onChange={e=>setCreateForm(f=>({...f,stage:e.target.value}))}>
                {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="عنوان الدوري">
              <input className="field mt-1" placeholder="مثال: دوري الأسر الرمضاني" value={createForm.title} onChange={e=>setCreateForm(f=>({...f,title:e.target.value}))}/>
            </Field>
            <ModalActions onConfirm={createLeague} onCancel={()=>setShowCreate(false)} confirmLabel="إنشاء"/>
          </div>
        </Modal>
      )}

      {/* ADD MATCH */}
      {showAddMatch && openLeague && (
        <Modal title="إضافة مباراة" onClose={()=>setShowAddMatch(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="صاحب الأرض">
                <select className="field mt-1" value={matchForm.homeGroupId} onChange={e=>setMatchForm(f=>({...f,homeGroupId:e.target.value}))}>
                  <option value="">اختر...</option>
                  {stageGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="الضيف">
                <select className="field mt-1" value={matchForm.awayGroupId} onChange={e=>setMatchForm(f=>({...f,awayGroupId:e.target.value}))}>
                  <option value="">اختر...</option>
                  {stageGroups.filter(g=>String(g.id)!==matchForm.homeGroupId).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
            </div>
            <ModalActions onConfirm={addMatch} onCancel={()=>setShowAddMatch(false)} confirmLabel="إضافة"/>
          </div>
        </Modal>
      )}

      {/* GOAL / SCORER */}
      {showGoalForm && (
        <Modal title="تسجيل هدف" onClose={()=>setShowGoalForm(false)}>
          {(()=>{ const m=matches.find(x=>x.id===goalForm.matchId); if(!m) return null; return (
            <div className="space-y-4">
              <Field label="الفريق">
                <select className="field mt-1" value={goalForm.teamGroupId} onChange={e=>setGoalForm({matchId:m.id,teamGroupId:e.target.value,scorerName:''})}>
                  <option value={m.homeGroupId}>{groupName(m.homeGroupId)}</option>
                  <option value={m.awayGroupId}>{groupName(m.awayGroupId)}</option>
                </select>
              </Field>
              <Field label="مُسجّل الهدف">
                <select className="field mt-1" value={groupStudents(goalForm.teamGroupId).some(s=>s.studentName===goalForm.scorerName)?goalForm.scorerName:''} onChange={e=>setGoalForm(f=>({...f,scorerName:e.target.value}))}>
                  <option value="">اختر لاعباً من {groupName(Number(goalForm.teamGroupId))}...</option>
                  {groupStudents(goalForm.teamGroupId).map(s=><option key={s.id} value={s.studentName}>{s.studentName}</option>)}
                </select>
                <input className="field mt-2" placeholder="أو اكتب الاسم يدوياً" value={goalForm.scorerName} onChange={e=>setGoalForm(f=>({...f,scorerName:e.target.value}))}/>
              </Field>
              <ModalActions onConfirm={addGoal} onCancel={()=>setShowGoalForm(false)} confirmLabel="تسجيل الهدف"/>
            </div>
          ); })()}
        </Modal>
      )}

      {/* CARD */}
      {showCardForm && (
        <Modal title="إضافة بطاقة" onClose={()=>setShowCardForm(false)}>
          {(()=>{ const m=matches.find(x=>x.id===cardForm.matchId); if(!m) return null; return (
            <div className="space-y-4">
              <Field label="الفريق">
                <select className="field mt-1" value={cardForm.groupId} onChange={e=>setCardForm(f=>({...f,groupId:e.target.value,studentId:'',studentName:''}))}>
                  <option value={m.homeGroupId}>{groupName(m.homeGroupId)}</option>
                  <option value={m.awayGroupId}>{groupName(m.awayGroupId)}</option>
                </select>
              </Field>
              <Field label="اللاعب">
                <select className="field mt-1" value={cardForm.studentId} onChange={e=>{const s=groupStudents(cardForm.groupId).find(st=>st.id===Number(e.target.value));setCardForm(f=>({...f,studentId:e.target.value,studentName:s?.studentName||''}));}}>
                  <option value="">اختر لاعباً...</option>
                  {groupStudents(cardForm.groupId).map(s=><option key={s.id} value={s.id}>{s.studentName}</option>)}
                </select>
                <input className="field mt-2" placeholder="أو اكتب الاسم يدوياً" value={cardForm.studentName} onChange={e=>setCardForm(f=>({...f,studentName:e.target.value,studentId:''}))}/>
              </Field>
              <Field label="نوع البطاقة">
                <div className="flex gap-3 mt-2">
                  {[['yellow','🟨 صفراء'],['red','🟥 حمراء']].map(([v,lbl])=>(
                    <button key={v} onClick={()=>setCardForm(f=>({...f,cardType:v}))} className={`choice flex-1 py-2 text-center ${cardForm.cardType===v?'is-active':''}`}>{lbl}</button>
                  ))}
                </div>
              </Field>
              <ModalActions onConfirm={addCard} onCancel={()=>setShowCardForm(false)} confirmLabel="إضافة البطاقة"/>
            </div>
          ); })()}
        </Modal>
      )}

      {/* BEHAVIOR */}
      {showBehaviorForm && (
        <Modal title="إضافة ملاحظة سلوكية" onClose={()=>setShowBehaviorForm(false)}>
          <div className="space-y-4">
            <Field label="الفريق">
              <select className="field mt-1" value={behaviorForm.groupId} onChange={e=>setBehaviorForm(f=>({...f,groupId:e.target.value,studentId:'',studentName:''}))}>
                <option value="">اختر...</option>
                {stageGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="اللاعب">
              <select className="field mt-1" value={behaviorForm.studentId} onChange={e=>{const s=groupStudents(behaviorForm.groupId).find(st=>st.id===Number(e.target.value));setBehaviorForm(f=>({...f,studentId:e.target.value,studentName:s?.studentName||''}));}}>
                <option value="">اختر لاعباً...</option>
                {groupStudents(behaviorForm.groupId).map(s=><option key={s.id} value={s.id}>{s.studentName}</option>)}
              </select>
              <input className="field mt-2" placeholder="أو اكتب الاسم يدوياً" value={behaviorForm.studentName} onChange={e=>setBehaviorForm(f=>({...f,studentName:e.target.value,studentId:''}))}/>
            </Field>
            <Field label="النوع">
              <div className="flex gap-3 mt-2">
                {[['positive','✅ إيجابي'],['negative','❌ سلبي']].map(([v,lbl])=>(
                  <button key={v} onClick={()=>setBehaviorForm(f=>({...f,behaviorType:v}))} className={`choice flex-1 py-2 text-center ${behaviorForm.behaviorType===v?'is-active':''}`}>{lbl}</button>
                ))}
              </div>
            </Field>
            <Field label="الوصف">
              <textarea rows={3} className="field mt-1 resize-none" placeholder="اكتب الملاحظة..." value={behaviorForm.description} onChange={e=>setBehaviorForm(f=>({...f,description:e.target.value}))}/>
            </Field>
            <ModalActions onConfirm={addBehavior} onCancel={()=>setShowBehaviorForm(false)} confirmLabel="إضافة الملاحظة"/>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── shared bits ──
function StandingsTable({standings,groupName}:{standings:Standing[];groupName:(id:number)=>string}) {
  if (standings.length===0) return <p className="p-8 text-center text-ink-400 text-sm">لا توجد فرق بعد</p>;
  return (
    <div className="overflow-x-auto scroll-soft">
      <table className="tbl text-center min-w-[480px]">
        <thead><tr>{['#','الفريق','لع','ف','ت','خ','+/-','ن'].map(h=><th key={h} className={h==='الفريق'?'!text-right':''}>{h}</th>)}</tr></thead>
        <tbody>
          {standings.map((s,i)=>(
            <tr key={s.groupId} className={i===0?'bg-yellow-50/40':''}>
              <td className="font-bold text-ink-500">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
              <td className="!text-right font-bold text-ink-900">{groupName(s.groupId)}</td>
              <td className="text-ink-500">{s.played}</td>
              <td className="text-green-600 font-medium">{s.won}</td>
              <td className="text-ink-500">{s.drawn}</td>
              <td className="text-nred-500">{s.lost}</td>
              <td className="text-ink-500">{s.goalDiff>0?'+':''}{s.goalDiff}</td>
              <td className="font-bold text-brand-600">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  return (
    <div className="modal-backdrop flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="modal-panel w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-ink-200">
          <h3 className="font-bold text-ink-900">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost p-2" aria-label="إغلاق">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function ModalActions({onConfirm,onCancel,confirmLabel}:{onConfirm:()=>void;onCancel:()=>void;confirmLabel:string}) {
  return (
    <div className="flex gap-2 pt-1">
      <button className="btn btn-primary flex-1" onClick={onConfirm}>{confirmLabel}</button>
      <button className="btn btn-ghost flex-1" onClick={onCancel}>إلغاء</button>
    </div>
  );
}
function RoundBtn({onClick,label,accent}:{onClick:()=>void;label:string;accent?:boolean}) {
  return (
    <button onClick={onClick}
      className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold border transition-transform hover:scale-110 active:scale-95 ${accent?'bg-brand text-white border-brand':'bg-white text-ink-700 border-ink-200'}`}>
      {label}
    </button>
  );
}
