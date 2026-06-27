'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSupervisor } from '@/components/SupervisorShell';

type League   = { id:number; stage:string; title:string; status:string; };
type Match    = { id:number; leagueId:number; matchday:number; homeGroupId:number; awayGroupId:number; homeScore:number; awayScore:number; status:string; };
type Goal     = { id:number; matchId:number; teamGroupId:number; scorerName:string; };
type Card     = { id:number; matchId:number; leagueId:number; studentId:number; studentName:string; groupId:number; cardType:string; suspensionMatches:number; suspensionServed:boolean; };
type Behavior = { id:number; leagueId:number; studentName:string; groupId:number; type:string; description:string; createdAt:string; };
type Standing = { groupId:number; played:number; won:number; drawn:number; lost:number; goalsFor:number; goalsAgainst:number; goalDiff:number; points:number; };
type Group    = { id:number; name:string; stage:string; };
type Student  = { id:number; studentName:string; groupId:number|null; stage:string; };

const STAGES = ['ابتدائي','متوسط','ثانوي'];
const STATUS_BADGE: Record<string,{bg:string;color:string;label:string}> = {
  setup:    {bg:'#F3F4F6',color:'#6B7280',label:'إعداد'},
  active:   {bg:'#D1FAE5',color:'#065F46',label:'جارٍ'},
  finished: {bg:'#EDE9FE',color:'#5B21B6',label:'منتهي'},
  archived: {bg:'#F3F4F6',color:'#9CA3AF',label:'مؤرشف'},
};
const MATCH_STATUS: Record<string,string> = {scheduled:'قادمة',live:'مباشر',finished:'منتهية'};

function computeStandings(matches:Match[], win=2, draw=1, loss=0): Standing[] {
  const map = new Map<number,Standing>();
  const ensure = (gid:number) => {
    if (!map.has(gid)) map.set(gid,{groupId:gid,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDiff:0,points:0});
    return map.get(gid)!;
  };
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

  // ── Main tab: league or stats ────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'league'|'stats'>('league');

  // ── League section state ─────────────────────────────────────────────────────
  const [stage,    setStage]    = useState(STAGES[0]);
  const [leagues,  setLeagues]  = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState<number|null>(null);
  const [matches,  setMatches]  = useState<Match[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [allBehaviors, setAllBehaviors] = useState<Behavior[]>([]);
  const [groups,   setGroups]   = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [subTab,   setSubTab]   = useState<'standings'|'matches'|'cards'|'behavior'>('standings');
  const [matchday, setMatchday] = useState(1);

  // ── Stats section state ──────────────────────────────────────────────────────
  const [statsStage,    setStatsStage]    = useState(STAGES[0]);
  const [statsLeagues,  setStatsLeagues]  = useState<League[]>([]);
  const [statsMatches,  setStatsMatches]  = useState<Match[]>([]);
  const [statsGoals,    setStatsGoals]    = useState<Goal[]>([]);
  const [statsLoading,  setStatsLoading]  = useState(false);
  const [statsLeagueId, setStatsLeagueId] = useState<number|null>(null);

  // ── Match modal ──────────────────────────────────────────────────────────────
  const [openMatch,   setOpenMatch]   = useState<Match|null>(null);
  const [matchGoals,  setMatchGoals]  = useState<Goal[]>([]);
  const [matchCards,  setMatchCards]  = useState<Card[]>([]);

  // ── Form modals ──────────────────────────────────────────────────────────────
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [showAddMatch,     setShowAddMatch]      = useState(false);
  const [showGoalForm,     setShowGoalForm]      = useState(false);
  const [showCardForm,     setShowCardForm]      = useState(false);
  const [showBehaviorForm, setShowBehaviorForm]  = useState(false);

  const [leagueForm, setLeagueForm] = useState({title:''});
  const [matchForm,  setMatchForm]  = useState({matchday:1,homeGroupId:'',awayGroupId:''});
  const [goalForm,   setGoalForm]   = useState({teamGroupId:'',scorerName:''});
  const [cardForm,   setCardForm]   = useState({groupId:'',studentId:'',studentName:'',cardType:'yellow'});
  const [behaviorForm, setBehaviorForm] = useState({groupId:'',studentId:'',studentName:'',behaviorType:'positive',description:''});

  // ── Derived ──────────────────────────────────────────────────────────────────
  const league        = leagues.find(l=>l.id===leagueId)||null;
  const stageGroups   = groups.filter(g=>g.stage===stage);
  const groupName     = (id:number) => groups.find(g=>g.id===id)?.name||`فريق ${id}`;
  const standings     = computeStandings(matches);
  const maxMatchday   = matches.length>0?Math.max(...matches.map(m=>m.matchday)):1;
  const matchdays     = Array.from({length:maxMatchday},(_,i)=>i+1);
  const dayMatches    = matches.filter(m=>m.matchday===matchday);
  const suspensions   = allCards.filter(c=>c.suspensionMatches>0&&!c.suspensionServed);
  const stageStudents = students.filter(s=>s.stage===stage);
  const groupStudents = (gid:number|string) => gid?stageStudents.filter(s=>s.groupId===Number(gid)):[];

  const api = useCallback(async (url:string,opts?:RequestInit)=>{
    const r=await fetch(url,opts); return r.json();
  },[]);

  // ── Load groups + students once ──────────────────────────────────────────────
  useEffect(()=>{
    Promise.all([
      fetch('/api/supervisor/groups').then(r=>r.json()),
      fetch('/api/supervisor/students').then(r=>r.json()),
    ]).then(([gd,sd])=>{ setGroups(gd.groups||[]); setStudents(sd.students||[]); });
  },[]);

  // ── Load leagues for current stage ──────────────────────────────────────────
  const loadLeagues = useCallback(async(s:string)=>{
    setLoading(true);
    const d=await api(`/api/supervisor/sports/leagues?stage=${encodeURIComponent(s)}`);
    const list:League[]=d.leagues||[];
    setLeagues(list);
    setLeagueId(list[0]?.id||null);
    setLoading(false);
  },[api]);

  const loadLeagueData = useCallback(async(lid:number)=>{
    const[md,cd,bd]=await Promise.all([
      api(`/api/supervisor/sports/matches?leagueId=${lid}`),
      api(`/api/supervisor/sports/events?type=cards&leagueId=${lid}`),
      api(`/api/supervisor/sports/events?type=behaviors&leagueId=${lid}`),
    ]);
    setMatches(md.matches||[]);
    setAllCards(cd.cards||[]);
    setAllBehaviors(bd.behaviors||[]);
  },[api]);

  useEffect(()=>{ loadLeagues(stage); },[stage,loadLeagues]);
  useEffect(()=>{
    if(leagueId) loadLeagueData(leagueId);
    else{ setMatches([]); setAllCards([]); setAllBehaviors([]); }
  },[leagueId,loadLeagueData]);

  // ── Load stats ───────────────────────────────────────────────────────────────
  const loadStats = useCallback(async(s:string)=>{
    setStatsLoading(true);
    const d=await api(`/api/supervisor/sports/leagues?stage=${encodeURIComponent(s)}`);
    const list:League[]=d.leagues||[];
    setStatsLeagues(list);
    const activeLeague=list.find(l=>l.status==='active')||list[0]||null;
    setStatsLeagueId(activeLeague?.id||null);
    if(activeLeague){
      const[md,gd]=await Promise.all([
        api(`/api/supervisor/sports/matches?leagueId=${activeLeague.id}`),
        api(`/api/supervisor/sports/events?type=goals&leagueId=${activeLeague.id}`),
      ]);
      setStatsMatches(md.matches||[]);
      setStatsGoals(gd.goals||[]);
    } else {
      setStatsMatches([]); setStatsGoals([]);
    }
    setStatsLoading(false);
  },[api]);

  useEffect(()=>{ if(mainTab==='stats') loadStats(statsStage); },[statsStage,mainTab,loadStats]);

  // ── Computed stats ───────────────────────────────────────────────────────────
  const statsStandings = computeStandings(statsMatches);

  // Goals per matchday
  const matchdayGoals = (() => {
    const matchById=Object.fromEntries(statsMatches.map(m=>[m.id,m]));
    const byDay=new Map<number,{matches:Set<number>;goals:number}>();
    for(const m of statsMatches){
      if(!byDay.has(m.matchday)) byDay.set(m.matchday,{matches:new Set(),goals:0});
      byDay.get(m.matchday)!.matches.add(m.id);
    }
    for(const g of statsGoals){
      const m=matchById[g.matchId];
      if(!m) continue;
      if(!byDay.has(m.matchday)) byDay.set(m.matchday,{matches:new Set(),goals:0});
      byDay.get(m.matchday)!.goals++;
    }
    return Array.from(byDay.entries()).sort((a,b)=>a[0]-b[0]).map(([day,v])=>({day,matches:v.matches.size,goals:v.goals}));
  })();

  // Top scorers
  const topScorers = (() => {
    const map=new Map<string,{name:string;groupId:number;count:number}>();
    for(const g of statsGoals){
      const key=`${g.scorerName}|${g.teamGroupId}`;
      if(!map.has(key)) map.set(key,{name:g.scorerName,groupId:g.teamGroupId,count:0});
      map.get(key)!.count++;
    }
    return Array.from(map.values()).sort((a,b)=>b.count-a.count).slice(0,10);
  })();

  const totalGoals   = statsGoals.length;
  const totalMatches = statsMatches.length;
  const finishedMatches = statsMatches.filter(m=>m.status==='finished').length;

  // ── League actions ───────────────────────────────────────────────────────────
  const createLeague=async()=>{
    if(!leagueForm.title.trim())return;
    const d=await api('/api/supervisor/sports/leagues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,title:leagueForm.title,pointsEnabled:false,winPoints:2,drawPoints:1,lossPoints:0})});
    if(d.league){setLeagues(p=>[d.league,...p]);setLeagueId(d.league.id);setShowCreateLeague(false);setLeagueForm({title:''});}
  };

  const setLeagueStatus=async(status:string)=>{
    if(!leagueId)return;
    const d=await api('/api/supervisor/sports/leagues',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:leagueId,status})});
    if(d.league)setLeagues(p=>p.map(l=>l.id===d.league.id?d.league:l));
  };

  const openMatchModal=async(m:Match)=>{
    setOpenMatch(m);
    const[gd,cd]=await Promise.all([
      api(`/api/supervisor/sports/events?type=goals&matchId=${m.id}`),
      api(`/api/supervisor/sports/events?type=cards&matchId=${m.id}`),
    ]);
    setMatchGoals(gd.goals||[]);setMatchCards(cd.cards||[]);
  };

  const adjustScore=async(side:'home'|'away',delta:number)=>{
    if(!openMatch)return;
    const cur=side==='home'?openMatch.homeScore:openMatch.awayScore;
    const val=Math.max(0,cur+delta);
    const patch=side==='home'?{homeScore:val}:{awayScore:val};
    const d=await api('/api/supervisor/sports/matches',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:openMatch.id,...patch})});
    if(d.match){setOpenMatch(d.match);setMatches(p=>p.map(m=>m.id===d.match.id?d.match:m));}
  };

  const setMatchStatus=async(status:string)=>{
    if(!openMatch)return;
    const d=await api('/api/supervisor/sports/matches',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:openMatch.id,status})});
    if(d.match){setOpenMatch(d.match);setMatches(p=>p.map(m=>m.id===d.match.id?d.match:m));}
  };

  const addMatch=async()=>{
    if(!leagueId||!matchForm.homeGroupId||!matchForm.awayGroupId)return;
    const d=await api('/api/supervisor/sports/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leagueId,matchday:Number(matchForm.matchday)||1,homeGroupId:Number(matchForm.homeGroupId),awayGroupId:Number(matchForm.awayGroupId)})});
    if(d.match){setMatches(p=>[...p,d.match]);setMatchday(d.match.matchday);setShowAddMatch(false);setMatchForm({matchday:1,homeGroupId:'',awayGroupId:''});}
  };

  const deleteMatch=async(mid:number)=>{
    if(!confirm('حذف المباراة؟'))return;
    await api(`/api/supervisor/sports/matches?id=${mid}`,{method:'DELETE'});
    setMatches(p=>p.filter(m=>m.id!==mid));
    if(openMatch?.id===mid)setOpenMatch(null);
  };

  const addGoal=async()=>{
    if(!openMatch||!goalForm.teamGroupId||!goalForm.scorerName.trim())return;
    const d=await api('/api/supervisor/sports/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'goal',matchId:openMatch.id,teamGroupId:Number(goalForm.teamGroupId),scorerName:goalForm.scorerName})});
    if(d.goal){
      setMatchGoals(p=>[...p,d.goal]);
      await adjustScore(d.goal.teamGroupId===openMatch.homeGroupId?'home':'away',1);
      setShowGoalForm(false);setGoalForm({teamGroupId:'',scorerName:''});
    }
  };

  const removeGoal=async(goalId:number,teamGroupId:number)=>{
    await api(`/api/supervisor/sports/events?type=goal&id=${goalId}`,{method:'DELETE'});
    setMatchGoals(p=>p.filter(g=>g.id!==goalId));
    if(openMatch)await adjustScore(teamGroupId===openMatch.homeGroupId?'home':'away',-1);
  };

  const addCard=async()=>{
    if(!openMatch||!leagueId||!cardForm.groupId||!cardForm.studentName.trim())return;
    const d=await api('/api/supervisor/sports/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'card',matchId:openMatch.id,leagueId,groupId:Number(cardForm.groupId),studentId:Number(cardForm.studentId)||0,studentName:cardForm.studentName,cardType:cardForm.cardType})});
    if(d.card){setMatchCards(p=>[...p,d.card]);setAllCards(p=>[...p,d.card]);setShowCardForm(false);setCardForm({groupId:'',studentId:'',studentName:'',cardType:'yellow'});}
  };

  const removeCard=async(cardId:number)=>{
    await api(`/api/supervisor/sports/events?type=card&id=${cardId}`,{method:'DELETE'});
    setMatchCards(p=>p.filter(c=>c.id!==cardId));
    setAllCards(p=>p.filter(c=>c.id!==cardId));
  };

  const addBehavior=async()=>{
    if(!leagueId||!behaviorForm.groupId||!behaviorForm.studentName.trim()||!behaviorForm.description.trim())return;
    const d=await api('/api/supervisor/sports/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'behavior',leagueId,groupId:Number(behaviorForm.groupId),studentId:Number(behaviorForm.studentId)||0,studentName:behaviorForm.studentName,behaviorType:behaviorForm.behaviorType,description:behaviorForm.description})});
    if(d.behavior){setAllBehaviors(p=>[d.behavior,...p]);setShowBehaviorForm(false);setBehaviorForm({groupId:'',studentId:'',studentName:'',behaviorType:'positive',description:''});}
  };

  const markSuspensionServed=async(cardId:number)=>{
    await api('/api/supervisor/sports/events',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'card',id:cardId,suspensionServed:true})});
    setAllCards(p=>p.map(c=>c.id===cardId?{...c,suspensionServed:true}:c));
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold" style={{color:'var(--ink)'}}>الدوري الرياضي</h1>
        {league&&canEdit&&(
          <div className="flex gap-2">
            {league.status==='setup'    && <button className="btn btn-primary text-sm" onClick={()=>setLeagueStatus('active')}>▶ بدء الدوري</button>}
            {league.status==='active'   && <button className="btn btn-ghost  text-sm" onClick={()=>setLeagueStatus('finished')}>إنهاء الدوري</button>}
            {league.status==='finished' && <button className="btn btn-ghost  text-sm" onClick={()=>setLeagueStatus('archived')}>أرشفة</button>}
          </div>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{background:'var(--bg-soft)'}}>
        {([['league','الدوري'],['stats','الإحصائيات']] as const).map(([t,lbl])=>(
          <button key={t} onClick={()=>{ setMainTab(t); if(t==='stats') loadStats(statsStage); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${mainTab===t?'bg-white shadow-sm font-bold':''}`}
            style={{color:mainTab===t?'var(--accent-deep)':'var(--ink-soft)'}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ════════════════ LEAGUE TAB ════════════════ */}
      {mainTab==='league' && (
        <>
          {/* Stage tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--bg-soft)'}}>
            {STAGES.map(s=>(
              <button key={s} onClick={()=>{setStage(s);setSubTab('standings');setMatchday(1);}}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${stage===s?'bg-white shadow-sm font-bold':''}`}
                style={{color:stage===s?'var(--accent-deep)':'var(--ink-soft)'}}>
                {s}
              </button>
            ))}
          </div>

          {leagues.length>1&&(
            <div className="flex gap-2 flex-wrap">
              {leagues.map(l=>(
                <button key={l.id} onClick={()=>setLeagueId(l.id)}
                  className="px-3 py-1.5 rounded-lg text-sm border"
                  style={{borderColor:leagueId===l.id?'var(--accent)':'var(--line)',fontWeight:leagueId===l.id?700:400,background:leagueId===l.id?'#FFF7ED':'var(--card)'}}>
                  {l.title}
                </button>
              ))}
            </div>
          )}

          {loading?(
            <div className="py-10 text-center" style={{color:'var(--ink-soft)'}}>جارٍ التحميل...</div>
          ):leagues.length===0?(
            <div className="card p-14 text-center space-y-4">
              <p className="text-5xl">⚽</p>
              <p className="font-bold text-lg" style={{color:'var(--ink)'}}>لا يوجد دوري لمرحلة {stage}</p>
              {canEdit&&<button className="btn btn-primary" onClick={()=>setShowCreateLeague(true)}>+ إنشاء دوري</button>}
            </div>
          ):(
            <>
              {league&&(
                <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="font-bold text-base" style={{color:'var(--ink)'}}>{league.title}</p>
                  {(()=>{const s=STATUS_BADGE[league.status]||STATUS_BADGE.setup;return(
                    <span className="px-3 py-1 rounded-full text-xs font-bold" style={{background:s.bg,color:s.color}}>{s.label}</span>
                  );})()}
                </div>
              )}

              {/* Sub-tabs */}
              <div className="flex border-b" style={{borderColor:'var(--line)'}}>
                {([['standings','الجدول'],['matches','المباريات'],['cards','البطاقات'],['behavior','السلوك']] as const).map(([t,lbl])=>(
                  <button key={t} onClick={()=>setSubTab(t)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab===t?'border-orange-500':'border-transparent'}`}
                    style={{color:subTab===t?'var(--accent-deep)':'var(--ink-soft)'}}>
                    {lbl}
                    {t==='cards'&&suspensions.length>0&&<span className="mr-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{suspensions.length}</span>}
                  </button>
                ))}
              </div>

              {/* STANDINGS */}
              {subTab==='standings'&&(
                <StandingsTable standings={standings} groupName={groupName}/>
              )}

              {/* MATCHES */}
              {subTab==='matches'&&(
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-1 flex-wrap">
                      {matchdays.map(d=>(
                        <button key={d} onClick={()=>setMatchday(d)}
                          className="px-3 py-1.5 rounded-lg text-sm border"
                          style={{background:matchday===d?'var(--accent)':'var(--card)',color:matchday===d?'#fff':'var(--ink)',borderColor:'var(--line)',fontWeight:matchday===d?700:400}}>
                          الجولة {d}
                        </button>
                      ))}
                      {canEdit&&(
                        <button onClick={()=>{setMatchForm(f=>({...f,matchday:maxMatchday+1}));setShowAddMatch(true);}}
                          className="px-3 py-1.5 rounded-lg text-sm border border-dashed"
                          style={{borderColor:'var(--accent)',color:'var(--accent)'}}>
                          + جولة جديدة
                        </button>
                      )}
                    </div>
                    {canEdit&&<button className="btn btn-primary text-sm" onClick={()=>{setMatchForm(f=>({...f,matchday}));setShowAddMatch(true);}}>+ إضافة مباراة</button>}
                  </div>

                  {dayMatches.length===0
                    ?<div className="card p-10 text-center" style={{color:'var(--ink-soft)'}}>لا توجد مباريات في هذه الجولة</div>
                    :<div className="space-y-3">
                      {dayMatches.map(m=>(
                        <div key={m.id} className="card p-4 cursor-pointer hover:shadow-md transition-shadow select-none" onClick={()=>openMatchModal(m)}>
                          <div className="flex items-center gap-4">
                            <span className="flex-1 text-right font-bold" style={{color:'var(--ink)'}}>{groupName(m.homeGroupId)}</span>
                            <div className="shrink-0 text-center">
                              <div className="text-2xl font-bold tabular-nums" style={{color:'var(--ink)'}}>{m.homeScore} – {m.awayScore}</div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium inline-block mt-0.5"
                                style={{background:m.status==='live'?'#FEF3C7':m.status==='finished'?'#D1FAE5':'var(--bg-soft)',color:m.status==='live'?'#92400E':m.status==='finished'?'#065F46':'var(--ink-soft)'}}>
                                {MATCH_STATUS[m.status]||m.status}{m.status==='live'&&' 🔴'}
                              </span>
                            </div>
                            <span className="flex-1 text-left font-bold" style={{color:'var(--ink)'}}>{groupName(m.awayGroupId)}</span>
                            {canEdit&&<button className="text-red-400 hover:text-red-600 px-2 py-1 text-sm shrink-0" onClick={e=>{e.stopPropagation();deleteMatch(m.id);}}>✕</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              )}

              {/* CARDS */}
              {subTab==='cards'&&(
                <div className="space-y-4">
                  {suspensions.length>0&&(
                    <div className="rounded-xl p-4 space-y-2" style={{background:'#FEF3C7'}}>
                      <p className="text-sm font-bold" style={{color:'#92400E'}}>⚠️ لاعبون موقوفون — {suspensions.length}</p>
                      {suspensions.map(c=>(
                        <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5">
                          <div>
                            <p className="text-sm font-bold" style={{color:'var(--ink)'}}>{c.studentName}</p>
                            <p className="text-xs" style={{color:'var(--ink-soft)'}}>{groupName(c.groupId)}</p>
                          </div>
                          {canEdit&&<button className="text-xs px-3 py-1 rounded-lg font-medium text-white" style={{background:'#059669'}} onClick={()=>markSuspensionServed(c.id)}>تنفيذ الإيقاف</button>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="card divide-y" style={{'--tw-divide-color':'var(--line)'}as React.CSSProperties}>
                    <p className="px-4 py-3 font-bold" style={{color:'var(--ink)'}}>جميع البطاقات ({allCards.length})</p>
                    {allCards.length===0?<p className="px-4 py-6 text-center" style={{color:'var(--ink-soft)'}}>لا توجد بطاقات</p>
                      :allCards.map(c=>(
                        <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="text-xl">{c.cardType==='yellow'?'🟨':'🟥'}</span>
                          <div className="flex-1"><p className="text-sm font-bold" style={{color:'var(--ink)'}}>{c.studentName}</p><p className="text-xs" style={{color:'var(--ink-soft)'}}>{groupName(c.groupId)}</p></div>
                          {c.suspensionMatches>0&&<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.suspensionServed?'opacity-40':''}`} style={{background:'#FEE2E2',color:'#7C2D12'}}>{c.suspensionServed?'مُنفَّذ':'إيقاف'} {c.suspensionMatches}م</span>}
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BEHAVIOR */}
              {subTab==='behavior'&&(
                <div className="space-y-4">
                  {canEdit&&<div className="flex justify-end"><button className="btn btn-primary text-sm" onClick={()=>setShowBehaviorForm(true)}>+ إضافة ملاحظة</button></div>}
                  <div className="card divide-y" style={{'--tw-divide-color':'var(--line)'}as React.CSSProperties}>
                    {allBehaviors.length===0?<p className="px-4 py-10 text-center" style={{color:'var(--ink-soft)'}}>لا توجد ملاحظات سلوكية</p>
                      :allBehaviors.map(b=>(
                        <div key={b.id} className="flex gap-3 p-4">
                          <span className="text-xl mt-0.5">{b.type==='positive'?'✅':'❌'}</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold" style={{color:'var(--ink)'}}>{b.studentName} — {groupName(b.groupId)}</p>
                            <p className="text-sm mt-0.5" style={{color:'var(--ink)'}}>{b.description}</p>
                            <p className="text-xs mt-1" style={{color:'var(--ink-soft)'}}>{new Date(b.createdAt).toLocaleDateString('ar-SA')}</p>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {leagues.length>0&&canEdit&&(
                <div className="flex justify-center pt-2">
                  <button className="text-sm" style={{color:'var(--ink-soft)'}} onClick={()=>setShowCreateLeague(true)}>+ إنشاء دوري جديد لمرحلة {stage}</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════════ STATS TAB ════════════════ */}
      {mainTab==='stats'&&(
        <>
          {/* Stage tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--bg-soft)'}}>
            {STAGES.map(s=>(
              <button key={s} onClick={()=>setStatsStage(s)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${statsStage===s?'bg-white shadow-sm font-bold':''}`}
                style={{color:statsStage===s?'var(--accent-deep)':'var(--ink-soft)'}}>
                {s}
              </button>
            ))}
          </div>

          {statsLoading?(
            <div className="py-10 text-center" style={{color:'var(--ink-soft)'}}>جارٍ التحميل...</div>
          ):!statsLeagueId?(
            <div className="card p-14 text-center space-y-3">
              <p className="text-4xl">📊</p>
              <p style={{color:'var(--ink-soft)'}}>لا يوجد دوري لمرحلة {statsStage}</p>
            </div>
          ):(
            <div className="space-y-5">
              {/* League name + league count */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="font-bold" style={{color:'var(--ink)'}}>{statsLeagues.find(l=>l.id===statsLeagueId)?.title}</p>
                <span className="text-sm px-3 py-1 rounded-full" style={{background:'var(--bg-soft)',color:'var(--ink-soft)'}}>
                  {statsLeagues.length} دوري في هذه المرحلة
                </span>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'إجمالي المباريات',value:totalMatches,icon:'⚽'},
                  {label:'المباريات المنتهية',value:finishedMatches,icon:'✅'},
                  {label:'إجمالي الأهداف',value:totalGoals,icon:'🎯'},
                ].map(c=>(
                  <div key={c.label} className="card p-4 text-center">
                    <p className="text-2xl mb-1">{c.icon}</p>
                    <p className="text-2xl font-bold" style={{color:'var(--ink)'}}>{c.value}</p>
                    <p className="text-xs mt-0.5" style={{color:'var(--ink-soft)'}}>{c.label}</p>
                  </div>
                ))}
              </div>

              {/* Goals per matchday */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b font-bold" style={{color:'var(--ink)',borderColor:'var(--line)'}}>أهداف الجولات</div>
                {matchdayGoals.length===0
                  ?<p className="p-6 text-center" style={{color:'var(--ink-soft)'}}>لا بيانات</p>
                  :<table className="w-full text-sm">
                    <thead>
                      <tr style={{background:'var(--bg-soft)'}}>
                        {['الجولة','المباريات','الأهداف','المعدل'].map(h=>(
                          <th key={h} className="px-4 py-2.5 text-center font-semibold" style={{color:'var(--ink-soft)'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{'--tw-divide-color':'var(--line)'}as React.CSSProperties}>
                      {matchdayGoals.map(row=>(
                        <tr key={row.day}>
                          <td className="px-4 py-3 text-center font-bold" style={{color:'var(--ink)'}}>الجولة {row.day}</td>
                          <td className="px-4 py-3 text-center" style={{color:'var(--ink-soft)'}}>{row.matches}</td>
                          <td className="px-4 py-3 text-center font-bold" style={{color:'var(--accent-deep)'}}>{row.goals}</td>
                          <td className="px-4 py-3 text-center" style={{color:'var(--ink-soft)'}}>
                            {row.matches>0?(row.goals/row.matches).toFixed(1):'—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              </div>

              {/* Top scorers */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b font-bold" style={{color:'var(--ink)',borderColor:'var(--line)'}}>أكثر الهدّافين</div>
                {topScorers.length===0
                  ?<p className="p-6 text-center" style={{color:'var(--ink-soft)'}}>لا أهداف مسجّلة</p>
                  :<div className="divide-y" style={{'--tw-divide-color':'var(--line)'}as React.CSSProperties}>
                    {topScorers.map((s,i)=>(
                      <div key={`${s.name}-${s.groupId}`} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{background:i===0?'#FEF3C7':i===1?'#F3F4F6':i===2?'#FEE2E2':'var(--bg-soft)',color:i===0?'#92400E':i===1?'#374151':i===2?'#7C2D12':'var(--ink-soft)'}}>
                          {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold" style={{color:'var(--ink)'}}>{s.name}</p>
                          <p className="text-xs" style={{color:'var(--ink-soft)'}}>{groupName(s.groupId)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-bold" style={{color:'var(--accent-deep)'}}>{s.count}</span>
                          <span className="text-xs" style={{color:'var(--ink-soft)'}}>هدف</span>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>

              {/* Group standings */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b font-bold" style={{color:'var(--ink)',borderColor:'var(--line)'}}>ترتيب الفرق</div>
                <StandingsTable standings={statsStandings} groupName={groupName}/>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MATCH DETAIL MODAL ── */}
      {openMatch&&(
        <Modal title="تفاصيل المباراة" onClose={()=>setOpenMatch(null)} wide>
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-6 py-4">
              <div className="flex-1 text-center"><p className="font-bold" style={{color:'var(--ink)'}}>{groupName(openMatch.homeGroupId)}</p><p className="text-xs mt-0.5" style={{color:'var(--ink-soft)'}}>صاحب الأرض</p></div>
              <div className="flex items-center gap-2">
                {canEdit&&<RoundBtn onClick={()=>adjustScore('home',-1)} label="−"/>}
                <span className="text-4xl font-bold tabular-nums w-8 text-center" style={{color:'var(--ink)'}}>{openMatch.homeScore}</span>
                {canEdit&&<RoundBtn onClick={()=>adjustScore('home',1)} label="+" accent/>}
              </div>
              <span className="text-2xl font-bold" style={{color:'var(--ink-soft)'}}>–</span>
              <div className="flex items-center gap-2">
                {canEdit&&<RoundBtn onClick={()=>adjustScore('away',1)} label="+" accent/>}
                <span className="text-4xl font-bold tabular-nums w-8 text-center" style={{color:'var(--ink)'}}>{openMatch.awayScore}</span>
                {canEdit&&<RoundBtn onClick={()=>adjustScore('away',-1)} label="−"/>}
              </div>
              <div className="flex-1 text-center"><p className="font-bold" style={{color:'var(--ink)'}}>{groupName(openMatch.awayGroupId)}</p><p className="text-xs mt-0.5" style={{color:'var(--ink-soft)'}}>الضيف</p></div>
            </div>

            {canEdit&&(
              <div className="flex gap-2 justify-center">
                {(['scheduled','live','finished'] as const).map(st=>(
                  <button key={st} onClick={()=>setMatchStatus(st)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{background:openMatch.status===st?'var(--accent)':'var(--card)',color:openMatch.status===st?'#fff':'var(--ink)',borderColor:openMatch.status===st?'var(--accent)':'var(--line)'}}>
                    {MATCH_STATUS[st]}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border p-3 space-y-2" style={{borderColor:'var(--line)'}}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold" style={{color:'var(--ink)'}}>⚽ الأهداف ({matchGoals.length})</p>
                  {canEdit&&<button className="text-xs font-medium" style={{color:'var(--accent)'}} onClick={()=>{setGoalForm({teamGroupId:String(openMatch.homeGroupId),scorerName:''});setShowGoalForm(true);}}>+ هدف</button>}
                </div>
                {matchGoals.length===0?<p className="text-xs py-2 text-center" style={{color:'var(--ink-soft)'}}>لا أهداف</p>
                  :matchGoals.map(g=>(
                    <div key={g.id} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5" style={{background:'var(--bg-soft)'}}>
                      <span>⚽</span>
                      <span className="flex-1 font-medium" style={{color:'var(--ink)'}}>{g.scorerName}</span>
                      <span className="text-xs" style={{color:'var(--ink-soft)'}}>{groupName(g.teamGroupId)}</span>
                      {canEdit&&<button className="text-red-400 text-xs hover:text-red-600" onClick={()=>removeGoal(g.id,g.teamGroupId)}>✕</button>}
                    </div>
                  ))
                }
              </div>
              <div className="rounded-xl border p-3 space-y-2" style={{borderColor:'var(--line)'}}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold" style={{color:'var(--ink)'}}>🟨 البطاقات ({matchCards.length})</p>
                  {canEdit&&<button className="text-xs font-medium" style={{color:'var(--accent)'}} onClick={()=>{setCardForm({groupId:String(openMatch.homeGroupId),studentId:'',studentName:'',cardType:'yellow'});setShowCardForm(true);}}>+ بطاقة</button>}
                </div>
                {matchCards.length===0?<p className="text-xs py-2 text-center" style={{color:'var(--ink-soft)'}}>لا بطاقات</p>
                  :matchCards.map(c=>(
                    <div key={c.id} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5" style={{background:'var(--bg-soft)'}}>
                      <span>{c.cardType==='yellow'?'🟨':'🟥'}</span>
                      <span className="flex-1 font-medium" style={{color:'var(--ink)'}}>{c.studentName}</span>
                      {c.suspensionMatches>0&&<span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background:'#FEE2E2',color:'#7C2D12'}}>إيقاف</span>}
                      {canEdit&&<button className="text-red-400 text-xs hover:text-red-600" onClick={()=>removeCard(c.id)}>✕</button>}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE LEAGUE */}
      {showCreateLeague&&(
        <Modal title={`إنشاء دوري — مرحلة ${stage}`} onClose={()=>setShowCreateLeague(false)}>
          <div className="space-y-4">
            <Field label="عنوان الدوري">
              <input className="input mt-1 w-full" placeholder="مثال: دوري الأسر الرمضاني" value={leagueForm.title} onChange={e=>setLeagueForm({title:e.target.value})}/>
            </Field>
            <ModalActions onConfirm={createLeague} onCancel={()=>setShowCreateLeague(false)} confirmLabel="إنشاء"/>
          </div>
        </Modal>
      )}

      {/* ADD MATCH */}
      {showAddMatch&&(
        <Modal title="إضافة مباراة" onClose={()=>setShowAddMatch(false)}>
          <div className="space-y-4">
            <Field label="الجولة">
              <input type="number" min={1} className="input mt-1 w-full" value={matchForm.matchday} onChange={e=>setMatchForm(f=>({...f,matchday:Number(e.target.value)}))}/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="الفريق الأول (صاحب الأرض)">
                <select className="input mt-1 w-full" value={matchForm.homeGroupId} onChange={e=>setMatchForm(f=>({...f,homeGroupId:e.target.value}))}>
                  <option value="">اختر...</option>
                  {stageGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="الفريق الثاني (الضيف)">
                <select className="input mt-1 w-full" value={matchForm.awayGroupId} onChange={e=>setMatchForm(f=>({...f,awayGroupId:e.target.value}))}>
                  <option value="">اختر...</option>
                  {stageGroups.filter(g=>String(g.id)!==matchForm.homeGroupId).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
            </div>
            <ModalActions onConfirm={addMatch} onCancel={()=>setShowAddMatch(false)} confirmLabel="إضافة"/>
          </div>
        </Modal>
      )}

      {/* GOAL FORM */}
      {showGoalForm&&openMatch&&(
        <Modal title="تسجيل هدف" onClose={()=>setShowGoalForm(false)}>
          <div className="space-y-4">
            <Field label="الفريق">
              <select className="input mt-1 w-full" value={goalForm.teamGroupId} onChange={e=>setGoalForm(f=>({...f,teamGroupId:e.target.value}))}>
                <option value={openMatch.homeGroupId}>{groupName(openMatch.homeGroupId)}</option>
                <option value={openMatch.awayGroupId}>{groupName(openMatch.awayGroupId)}</option>
              </select>
            </Field>
            <Field label="اسم الهدّاف">
              <input className="input mt-1 w-full" placeholder="اكتب الاسم..." value={goalForm.scorerName} onChange={e=>setGoalForm(f=>({...f,scorerName:e.target.value}))}/>
            </Field>
            <ModalActions onConfirm={addGoal} onCancel={()=>setShowGoalForm(false)} confirmLabel="تسجيل الهدف"/>
          </div>
        </Modal>
      )}

      {/* CARD FORM */}
      {showCardForm&&openMatch&&(
        <Modal title="إضافة بطاقة" onClose={()=>setShowCardForm(false)}>
          <div className="space-y-4">
            <Field label="الفريق">
              <select className="input mt-1 w-full" value={cardForm.groupId} onChange={e=>setCardForm(f=>({...f,groupId:e.target.value,studentId:'',studentName:''}))}>
                <option value={openMatch.homeGroupId}>{groupName(openMatch.homeGroupId)}</option>
                <option value={openMatch.awayGroupId}>{groupName(openMatch.awayGroupId)}</option>
              </select>
            </Field>
            <Field label="اللاعب">
              <select className="input mt-1 w-full" value={cardForm.studentId} onChange={e=>{const s=groupStudents(cardForm.groupId).find(st=>st.id===Number(e.target.value));setCardForm(f=>({...f,studentId:e.target.value,studentName:s?.studentName||''}));}}>
                <option value="">اختر لاعباً...</option>
                {groupStudents(cardForm.groupId).map(s=><option key={s.id} value={s.id}>{s.studentName}</option>)}
              </select>
              <input className="input mt-2 w-full" placeholder="أو اكتب الاسم يدوياً" value={cardForm.studentName} onChange={e=>setCardForm(f=>({...f,studentName:e.target.value,studentId:''}))}/>
            </Field>
            <Field label="نوع البطاقة">
              <div className="flex gap-3 mt-2">
                {[['yellow','🟨 صفراء','#FEF3C7','#F59E0B'],['red','🟥 حمراء','#FEE2E2','#EF4444']].map(([v,lbl,bg,border])=>(
                  <button key={v} onClick={()=>setCardForm(f=>({...f,cardType:v}))}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all"
                    style={{background:cardForm.cardType===v?bg:'var(--card)',borderColor:cardForm.cardType===v?border:'var(--line)'}}>
                    {lbl}
                  </button>
                ))}
              </div>
            </Field>
            <ModalActions onConfirm={addCard} onCancel={()=>setShowCardForm(false)} confirmLabel="إضافة البطاقة"/>
          </div>
        </Modal>
      )}

      {/* BEHAVIOR FORM */}
      {showBehaviorForm&&(
        <Modal title="إضافة ملاحظة سلوكية" onClose={()=>setShowBehaviorForm(false)}>
          <div className="space-y-4">
            <Field label="الفريق">
              <select className="input mt-1 w-full" value={behaviorForm.groupId} onChange={e=>setBehaviorForm(f=>({...f,groupId:e.target.value,studentId:'',studentName:''}))}>
                <option value="">اختر...</option>
                {stageGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="اللاعب">
              <select className="input mt-1 w-full" value={behaviorForm.studentId} onChange={e=>{const s=groupStudents(behaviorForm.groupId).find(st=>st.id===Number(e.target.value));setBehaviorForm(f=>({...f,studentId:e.target.value,studentName:s?.studentName||''}));}}>
                <option value="">اختر لاعباً...</option>
                {groupStudents(behaviorForm.groupId).map(s=><option key={s.id} value={s.id}>{s.studentName}</option>)}
              </select>
              <input className="input mt-2 w-full" placeholder="أو اكتب الاسم يدوياً" value={behaviorForm.studentName} onChange={e=>setBehaviorForm(f=>({...f,studentName:e.target.value,studentId:''}))}/>
            </Field>
            <Field label="النوع">
              <div className="flex gap-3 mt-2">
                {[['positive','✅ إيجابي','#D1FAE5','#059669'],['negative','❌ سلبي','#FEE2E2','#EF4444']].map(([v,lbl,bg,border])=>(
                  <button key={v} onClick={()=>setBehaviorForm(f=>({...f,behaviorType:v as 'positive'|'negative'}))}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all"
                    style={{background:behaviorForm.behaviorType===v?bg:'var(--card)',borderColor:behaviorForm.behaviorType===v?border:'var(--line)'}}>
                    {lbl}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="الوصف">
              <textarea rows={3} className="input mt-1 w-full resize-none" placeholder="اكتب الملاحظة..." value={behaviorForm.description} onChange={e=>setBehaviorForm(f=>({...f,description:e.target.value}))}/>
            </Field>
            <ModalActions onConfirm={addBehavior} onCancel={()=>setShowBehaviorForm(false)} confirmLabel="إضافة الملاحظة"/>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared mini-components ────────────────────────────────────────────────────

function StandingsTable({standings,groupName}:{standings:Standing[];groupName:(id:number)=>string}) {
  if(standings.length===0) return <p className="p-10 text-center" style={{color:'var(--ink-soft)'}}>لا توجد نتائج بعد</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr style={{background:'var(--bg-soft)'}}>
            {['#','الفريق','لع','ف','ت','خ','لـه','عـه','فـه','ن'].map(h=>(
              <th key={h} className={`px-3 py-3 font-semibold ${h==='الفريق'?'text-right':'text-center'}`} style={{color:'var(--ink-soft)'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{'--tw-divide-color':'var(--line)'}as React.CSSProperties}>
          {standings.map((s,i)=>(
            <tr key={s.groupId} style={{background:i===0?'#FFFBEB':undefined}}>
              <td className="px-3 py-3 text-center font-bold" style={{color:'var(--ink-soft)'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
              <td className="px-3 py-3 font-bold" style={{color:'var(--ink)'}}>{groupName(s.groupId)}</td>
              <td className="px-3 py-3 text-center" style={{color:'var(--ink-soft)'}}>{s.played}</td>
              <td className="px-3 py-3 text-center text-green-600 font-medium">{s.won}</td>
              <td className="px-3 py-3 text-center" style={{color:'var(--ink-soft)'}}>{s.drawn}</td>
              <td className="px-3 py-3 text-center text-red-500">{s.lost}</td>
              <td className="px-3 py-3 text-center" style={{color:'var(--ink-soft)'}}>{s.goalsFor}</td>
              <td className="px-3 py-3 text-center" style={{color:'var(--ink-soft)'}}>{s.goalsAgainst}</td>
              <td className="px-3 py-3 text-center font-medium" style={{color:s.goalDiff>0?'#059669':s.goalDiff<0?'#DC2626':'var(--ink-soft)'}}>{s.goalDiff>0?'+':''}{s.goalDiff}</td>
              <td className="px-3 py-3 text-center font-bold text-base" style={{color:'var(--accent-deep)'}}>{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({title,onClose,children,wide}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,.5)'}}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide?'max-w-2xl':'max-w-md'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:'var(--line)'}}>
          <h2 className="font-bold text-base" style={{color:'var(--ink)'}}>{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-lg" style={{color:'var(--ink-soft)'}}>✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="block"><span className="text-sm font-medium" style={{color:'var(--ink)'}}>{label}</span>{children}</label>;
}
function ModalActions({onConfirm,onCancel,confirmLabel}:{onConfirm:()=>void;onCancel:()=>void;confirmLabel:string}) {
  return (
    <div className="flex gap-2 pt-2">
      <button className="btn btn-primary flex-1" onClick={onConfirm}>{confirmLabel}</button>
      <button className="btn btn-ghost flex-1" onClick={onCancel}>إلغاء</button>
    </div>
  );
}
function RoundBtn({onClick,label,accent}:{onClick:()=>void;label:string;accent?:boolean}) {
  return (
    <button onClick={onClick} className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold"
      style={{background:accent?'var(--accent)':'#F3F4F6',color:accent?'#fff':'var(--ink)'}}>
      {label}
    </button>
  );
}
