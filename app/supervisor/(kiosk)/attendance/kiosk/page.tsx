'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ── types ── */
type Student = {
  id: number; membershipNo: number; studentName: string;
  stage: string; grade: string; groupId: number | null;
  registrationStatus: string; paymentStatus: string;
};
type Group  = { id: number; name: string };
type PtRec  = { registrationId: number; delta: number; pointType: string; reason: string };
type AttRec = { registrationId: number; status: string };
type Cfg    = { earlyBefore: string; lateAfter: string; earlyPoints: number; onTimePoints: number; latePoints: number };

const CFG0: Cfg = { earlyBefore: '08:00', lateAfter: '08:15', earlyPoints: 3, onTimePoints: 2, latePoints: 1 };

const STAGE_CLR: Record<string, string> = {
  ابتدائي: '#12B3D5', متوسط: '#103F91', ثانوي: '#E52E25',
};

/* ── helpers ── */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function calcPts(pts: PtRec[]) {
  let ind=0, col=0, ded=0;
  for (const p of pts) {
    const t = p.pointType ?? ((p.reason??'').endsWith('(رصد جماعي للأسرة)') ? 'collective' : p.delta<0 ? 'deduction' : 'individual');
    if (t==='individual') ind+=p.delta;
    else if (t==='collective') col+=p.delta;
    else ded+=p.delta;
  }
  return { individual:ind, collective:col, balance:Math.max(0,ind+col+ded), total:ind+col };
}

type Flash =
  | { kind:'ok';  student:Student; groupName:string; pts:ReturnType<typeof calcPts> }
  | { kind:'dup'; name:string }
  | { kind:'err'; msg:string };

/* ═══════════════════════════════════════════════════════ */
export default function KioskPage() {
  const router = useRouter();

  const [ready,      setReady]      = useState(false);
  const [logoOk,     setLogoOk]     = useState(true);
  const [students,   setStudents]   = useState<Student[]>([]);
  const [groups,     setGroups]     = useState<Group[]>([]);
  const [allPts,     setAllPts]     = useState<PtRec[]>([]);
  const [todayRecs,  setTodayRecs]  = useState<Record<number,string>>({});
  const [presentCnt, setPresentCnt] = useState(0);
  const [lateCnt,    setLateCnt]    = useState(0);
  const [cfg,        setCfg]        = useState<Cfg>(CFG0);
  const [cfgDraft,   setCfgDraft]   = useState<Cfg>(CFG0);
  const [cfgOpen,    setCfgOpen]    = useState(false);
  const [cfgSaving,  setCfgSaving]  = useState(false);
  const [input,      setInput]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [flash,      setFlash]      = useState<Flash|null>(null);
  const [clock,      setClock]      = useState('');
  const [dateLabel,  setDateLabel]  = useState('');

  const flashTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  /* ── auth ── */
  useEffect(() => {
    fetch('/api/supervisor/auth/me', { cache:'no-store' })
      .then(r => { if (r.status===401) router.replace('/supervisor/login'); else setReady(true); })
      .catch(() => router.replace('/supervisor/login'));
  }, [router]);

  /* ── clock ── */
  useEffect(() => {
    function tick() {
      const n = new Date();
      setClock(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`);
      setDateLabel(n.toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── load data ── */
  const loadData = useCallback(async () => {
    const [sr,gr,pr,ar,cr] = await Promise.all([
      fetch('/api/supervisor/students',          { cache:'no-store' }),
      fetch('/api/supervisor/groups',            { cache:'no-store' }),
      fetch('/api/supervisor/points',            { cache:'no-store' }),
      fetch(`/api/supervisor/attendance?date=${todayStr()}`, { cache:'no-store' }),
      fetch('/api/supervisor/attendance-config', { cache:'no-store' }),
    ]);
    const sj = await sr.json().catch(()=>({students:[]}));
    const gj = await gr.json().catch(()=>({groups:[]}));
    const pj = await pr.json().catch(()=>({points:[]}));
    const aj = await ar.json().catch(()=>({attendance:[]}));
    const cj = await cr.json().catch(()=>({}));

    setStudents((sj.students??[]).filter((s:Student) =>
      s.registrationStatus==='approved' && (s.paymentStatus==='paid'||s.paymentStatus==='exempted')
    ));
    setGroups(gj.groups??[]);
    setAllPts(pj.points??[]);
    if (cj.earlyBefore) { setCfg(cj); setCfgDraft(cj); }

    let p=0, l=0;
    const map: Record<number,string> = {};
    (aj.attendance as AttRec[]).forEach(r => {
      map[r.registrationId] = r.status;
      if (r.status==='present') p++;
      else if (r.status==='late') l++;
    });
    setTodayRecs(map);
    setPresentCnt(p);
    setLateCnt(l);
  }, []);

  useEffect(() => { if (ready) loadData(); }, [ready, loadData]);

  /* ── refocus after flash ── */
  useEffect(() => {
    if (!flash || flash.kind !== 'ok') {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [flash]);

  function showFlash(f: Flash) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(f);
    flashTimer.current = setTimeout(() => { setFlash(null); }, 4000);
  }

  /* ── submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mNo = input.trim();
    if (!mNo || busy) return;

    const student = students.find(s => String(s.membershipNo) === mNo);
    if (student && todayRecs[student.id]) {
      showFlash({ kind:'dup', name:student.studentName });
      setInput('');
      return;
    }

    setBusy(true);
    const r = await fetch('/api/supervisor/attendance', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ membershipNo:mNo, date:todayStr(), status:'present' }),
    });
    const j = await r.json().catch(()=>({}));
    setInput('');
    setBusy(false);

    if (!r.ok) { showFlash({ kind:'err', msg:j.error??'لم يتم العثور على الطالب' }); return; }

    const found = students.find(s => String(s.membershipNo) === mNo);
    if (found) {
      const groupName = found.groupId ? groups.find(g=>g.id===found.groupId)?.name??'—' : '—';
      const pts = calcPts(allPts.filter(p=>p.registrationId===found.id));
      setTodayRecs(prev => ({...prev,[found.id]:'present'}));
      setPresentCnt(prev => prev+1);
      showFlash({ kind:'ok', student:found, groupName, pts });
    }
  }

  /* ── save config ── */
  async function saveConfig() {
    setCfgSaving(true);
    const r = await fetch('/api/supervisor/attendance-config', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(cfgDraft),
    });
    setCfgSaving(false);
    if (r.ok) { setCfg(cfgDraft); setCfgOpen(false); }
  }

  /* ── render ── */
  if (!ready) return (
    <div className="min-h-dvh flex items-center justify-center">
      <span className="w-8 h-8 rounded-full border-[3px] border-ink-200 animate-spin" style={{borderTopColor:'var(--accent)'}}/>
    </div>
  );

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4"
      style={{ background:'var(--bg)' }}
      onClick={() => inputRef.current?.focus()}
    >

      {/* Exit button — fixed, very subtle */}
      <button
        onClick={e => { e.stopPropagation(); router.push('/supervisor/attendance'); }}
        className="fixed top-4 left-5 text-xs text-ink-200 hover:text-ink-500 transition-colors"
      >
        ← خروج
      </button>

      {/* Settings gear — fixed, subtle */}
      <button
        onClick={e => { e.stopPropagation(); setCfgDraft(cfg); setCfgOpen(true); }}
        className="fixed bottom-4 left-5 text-ink-200 hover:text-ink-400 transition-colors p-1"
        title="إعدادات الحضور"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </button>

      {/* ══ Central layout ══ */}
      <div className="w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>

        {/* ─ Main card ─ */}
        <div className="bg-white rounded-3xl shadow-xl border border-ink-100 overflow-hidden">
          <div className="px-8 pt-8 pb-7 space-y-5 text-center">

            {/* Logo */}
            <div className="flex justify-center">
              {logoOk
                ? <img src="/nibras-logo.png" alt="نادي نبراس" className="h-12 w-auto object-contain" onError={() => setLogoOk(false)}/>
                : <span className="text-2xl font-bold text-ink-900" style={{fontFamily:'var(--font-display)'}}>نادي نبراس</span>
              }
            </div>

            {/* Date */}
            <p className="text-sm text-ink-400 leading-relaxed">{dateLabel}</p>

            {/* Clock */}
            <p
              className="text-5xl font-bold text-ink-800 tracking-widest tabular-nums"
              style={{fontFamily:'ui-monospace,monospace'}}
            >
              {clock}
            </p>

            <div className="border-t border-ink-100"/>

            {/* Input */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={busy}
                  autoFocus
                  autoComplete="off"
                  dir="ltr"
                  placeholder="0000"
                  className="w-full text-center rounded-2xl border-2 border-ink-200 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 transition-all bg-white placeholder:text-ink-200 py-5 text-5xl font-bold tracking-[0.2em]"
                  style={{fontFamily:'ui-monospace,monospace'}}
                />
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                    <span className="w-7 h-7 rounded-full border-[3px] border-ink-200 animate-spin" style={{borderTopColor:'var(--accent)'}}/>
                  </div>
                )}
              </div>
              <button type="submit" disabled={!input.trim()||busy} className="btn btn-primary w-full text-lg py-4">
                تسجيل الحضور
              </button>
            </form>

            {/* Error / Duplicate — inline, small */}
            {flash && flash.kind !== 'ok' && (
              <div className={`text-sm font-medium py-2.5 px-4 rounded-xl fade-in ${
                flash.kind==='dup' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
              }`}>
                {flash.kind==='dup'
                  ? <>سبق تسجيل حضور <strong>{flash.name}</strong> اليوم</>
                  : flash.msg
                }
              </div>
            )}

            {/* Present / Late counters — simple, small */}
            {(presentCnt > 0 || lateCnt > 0) && (
              <>
                <div className="border-t border-ink-100"/>
                <div className="flex justify-center items-center gap-5 text-sm">
                  <span className="flex items-center gap-1.5 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                    حضر: <strong>{presentCnt}</strong>
                  </span>
                  {lateCnt > 0 && (
                    <span className="flex items-center gap-1.5 text-yellow-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block"/>
                      متأخر: <strong>{lateCnt}</strong>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─ Student result card — separated, bigger ─ */}
        {flash?.kind === 'ok' && (
          <div className="bg-white rounded-3xl shadow-lg border border-green-100 px-6 py-6 fade-in">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shrink-0"
                style={{background: STAGE_CLR[flash.student.stage] ?? 'var(--accent)'}}
              >
                {flash.student.studentName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xl text-ink-900 leading-tight">{flash.student.studentName}</span>
                  <span className="pill pill-green text-xs">✓ حاضر</span>
                </div>
                <div className="font-mono text-sm text-ink-400 mt-0.5">#{flash.student.membershipNo}</div>
                <div className="text-sm text-ink-500 mt-0.5">
                  {flash.student.stage}
                  {flash.groupName !== '—' && <> · {flash.groupName}</>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-5">
              <PtBox label="فردية"    value={flash.pts.individual} color="#103F91"/>
              <PtBox label="جماعية"   value={flash.pts.collective} color="#12B3D5"/>
              <PtBox label="الرصيد"   value={flash.pts.balance}    color="#FF9F1C"/>
              <PtBox label="الإجمالي" value={flash.pts.total}      color="#1B7A43"/>
            </div>
          </div>
        )}
      </div>

      {/* ══ Settings popup ══ */}
      {cfgOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in"
          onClick={() => setCfgOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-ink-100 w-full max-w-sm p-6 pop-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-ink-900 text-lg">إعدادات أوقات الحضور</h2>
              <button onClick={() => setCfgOpen(false)} className="text-ink-300 hover:text-ink-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {/* مبكر */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{background:'#E7F6EC',border:'1px solid #1B7A4320'}}>
                <div>
                  <label className="label text-xs" style={{color:'#1B7A43'}}>⭐ مبكر — قبل</label>
                  <input type="time" className="field text-sm py-2" value={cfgDraft.earlyBefore}
                    onChange={e => setCfgDraft(d=>({...d,earlyBefore:e.target.value}))}/>
                </div>
                <div>
                  <label className="label text-xs" style={{color:'#1B7A43'}}>النقاط</label>
                  <input type="number" min={0} max={99} className="field text-sm py-2" value={cfgDraft.earlyPoints}
                    onChange={e => setCfgDraft(d=>({...d,earlyPoints:Number(e.target.value)}))}/>
                </div>
              </div>
              {/* في الوقت */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{background:'#EAF1F9',border:'1px solid #103F9120'}}>
                <div>
                  <label className="label text-xs" style={{color:'#103F91'}}>✓ في الوقت</label>
                  <p className="text-xs font-mono text-ink-500 mt-2">{cfgDraft.earlyBefore} — {cfgDraft.lateAfter}</p>
                </div>
                <div>
                  <label className="label text-xs" style={{color:'#103F91'}}>النقاط</label>
                  <input type="number" min={0} max={99} className="field text-sm py-2" value={cfgDraft.onTimePoints}
                    onChange={e => setCfgDraft(d=>({...d,onTimePoints:Number(e.target.value)}))}/>
                </div>
              </div>
              {/* متأخر */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{background:'#FCF3DC',border:'1px solid #9A6B0020'}}>
                <div>
                  <label className="label text-xs" style={{color:'#9A6B00'}}>⏰ متأخر — بعد</label>
                  <input type="time" className="field text-sm py-2" value={cfgDraft.lateAfter}
                    onChange={e => setCfgDraft(d=>({...d,lateAfter:e.target.value}))}/>
                </div>
                <div>
                  <label className="label text-xs" style={{color:'#9A6B00'}}>النقاط</label>
                  <input type="number" min={0} max={99} className="field text-sm py-2" value={cfgDraft.latePoints}
                    onChange={e => setCfgDraft(d=>({...d,latePoints:Number(e.target.value)}))}/>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setCfgOpen(false)} className="btn btn-ghost text-sm py-2 px-4">إلغاء</button>
              <button onClick={saveConfig} disabled={cfgSaving} className="btn btn-primary text-sm py-2 px-5">
                {cfgSaving ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PtBox({ label, value, color }: { label:string; value:number; color:string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-1"
      style={{background:`${color}15`, border:`1px solid ${color}30`}}>
      <span className="text-2xl font-bold" style={{color}}>{value}</span>
      <span className="text-[11px] text-ink-500">{label}</span>
    </div>
  );
}
