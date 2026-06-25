'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Student = {
  id: number; membershipNo: number; studentName: string;
  stage: string; grade: string; groupId: number | null;
  registrationStatus: string; paymentStatus: string;
};
type Group  = { id: number; name: string };
type PtRec  = { registrationId: number; delta: number; pointType: string; reason: string };
type AttRec = { registrationId: number; status: string; createdAt?: string };
type Cfg    = { attendanceStart: string; lateAfter: string; onTimePoints: number; latePoints: number };

const CFG0: Cfg = { attendanceStart: '07:30', lateAfter: '08:15', onTimePoints: 2, latePoints: 1 };
const STAGE_CLR: Record<string, string> = { ابتدائي: '#12B3D5', متوسط: '#103F91', ثانوي: '#E52E25' };
const EXIT_MS = 3000;
const RING_R  = 13; // SVG circle radius
const RING_C  = 2 * Math.PI * RING_R; // circumference ≈ 81.68

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function calcPts(pts: PtRec[]) {
  let ind=0, col=0, ded=0;
  for (const p of pts) {
    const t = p.pointType ?? ((p.reason??'').endsWith('(رصد جماعي للأسرة)') ? 'collective' : p.delta<0 ? 'deduction' : 'individual');
    if (t==='individual') ind+=p.delta; else if (t==='collective') col+=p.delta; else ded+=p.delta;
  }
  return { individual:ind, collective:col, balance:Math.max(0,ind+col+ded), total:ind+col };
}

function timeToMins(hhmm: string) {
  const [h,m] = hhmm.split(':').map(Number);
  return h*60+m;
}

function getStatus(cfg: Cfg): 'present' | 'late' {
  const n = new Date();
  return n.getHours()*60+n.getMinutes() > timeToMins(cfg.lateAfter) ? 'late' : 'present';
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' }); }
  catch { return '—'; }
}

type Flash =
  | { kind:'ok';  student:Student; groupName:string; pts:ReturnType<typeof calcPts>; status:'present'|'late' }
  | { kind:'dup'; name:string }
  | { kind:'early' }
  | { kind:'err'; msg:string };

export default function KioskPage() {
  const router = useRouter();

  const [ready,       setReady]       = useState(false);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [groups,      setGroups]      = useState<Group[]>([]);
  const [todayRecs,   setTodayRecs]   = useState<Record<number,string>>({});
  const [cfg,         setCfg]         = useState<Cfg>(CFG0);
  const [input,       setInput]       = useState('');
  const [busy,        setBusy]        = useState(false);
  const [flash,       setFlash]       = useState<Flash|null>(null);
  const [clock,       setClock]       = useState('');
  const [dateLabel,   setDateLabel]   = useState('');

  /* exit hold */
  const [exitPct,    setExitPct]    = useState(0);
  const exitRafRef   = useRef<number|null>(null);
  const exitStartRef = useRef<number>(0);


  const flashTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  /* ── auth check ── */
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

  /* ── initial data ── */
  const loadData = useCallback(async () => {
    const [sr,gr,ar,cr] = await Promise.all([
      fetch('/api/supervisor/students',          { cache:'no-store' }),
      fetch('/api/supervisor/groups',            { cache:'no-store' }),
      fetch(`/api/supervisor/attendance?date=${todayStr()}`, { cache:'no-store' }),
      fetch('/api/supervisor/attendance-config', { cache:'no-store' }),
    ]);
    const sj = await sr.json().catch(()=>({students:[]}));
    const gj = await gr.json().catch(()=>({groups:[]}));
    const aj = await ar.json().catch(()=>({attendance:[]}));
    const cj = await cr.json().catch(()=>({}));

    const approved: Student[] = (sj.students??[]).filter((s: Student) =>
      s.registrationStatus==='approved' && (s.paymentStatus==='paid'||s.paymentStatus==='exempted')
    );
    setStudents(approved);
    setGroups(gj.groups??[]);
    if (cj.lateAfter) { setCfg(cj); }

    const map: Record<number,string> = {};
    (aj.attendance as AttRec[]).forEach(r => { map[r.registrationId]=r.status; });
    setTodayRecs(map);
  }, []);

  useEffect(() => { if (ready) loadData(); }, [ready, loadData]);

  /* focus input when flash clears */
  useEffect(() => {
    if (!flash) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [flash]);

  /* ── flash helper ── */
  function showFlash(f: Flash) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(f);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  }

  /* ── hold-to-exit ── */
  function startExit(e: React.PointerEvent) {
    e.preventDefault();
    exitStartRef.current = performance.now();
    function frame(now: number) {
      const pct = Math.min(100, ((now - exitStartRef.current) / EXIT_MS) * 100);
      setExitPct(pct);
      if (pct < 100) {
        exitRafRef.current = requestAnimationFrame(frame);
      } else {
        router.push('/supervisor/attendance');
      }
    }
    exitRafRef.current = requestAnimationFrame(frame);
  }
  function stopExit() {
    if (exitRafRef.current) cancelAnimationFrame(exitRafRef.current);
    setExitPct(0);
  }

  /* ── check-in core logic ── */
  async function doCheckIn(mNo: string) {
    if (!mNo||busy) return;
    setInput('');

    const n = new Date();
    if (n.getHours()*60+n.getMinutes() < timeToMins(cfg.attendanceStart)) {
      showFlash({ kind:'early' }); return;
    }

    const student = students.find(s=>String(s.membershipNo)===mNo);
    if (student && todayRecs[student.id]) {
      showFlash({ kind:'dup', name:student.studentName }); return;
    }

    const status = getStatus(cfg);
    setBusy(true);

    const ar = await fetch('/api/supervisor/attendance', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ membershipNo:mNo, date:todayStr(), status }),
    });
    const aj = await ar.json().catch(()=>({}));

    if (!ar.ok) { setBusy(false); showFlash({ kind:'err', msg:aj.error??'لم يتم العثور على الطالب' }); return; }

    const found = students.find(s=>String(s.membershipNo)===mNo) ?? aj.student as Student|undefined;
    if (!found) { setBusy(false); showFlash({ kind:'err', msg:'الطالب غير موجود' }); return; }

    const pts = status==='present' ? cfg.onTimePoints : cfg.latePoints;
    await fetch('/api/supervisor/points', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        registrationId: found.id, delta: pts,
        reason: status==='present' ? 'حضور بالوقت' : 'حضور متأخر',
        category: 'attendance', pointType: 'individual',
      }),
    });

    const pr = await fetch(`/api/supervisor/points?studentId=${found.id}`, { cache:'no-store' });
    const pj = await pr.json().catch(()=>({points:[]}));
    const updatedPts = calcPts(pj.points??[]);

    const groupName = found.groupId ? groups.find(g=>g.id===found.groupId)?.name??'—' : '—';
    setTodayRecs(prev=>({...prev,[found.id]:status}));
    setBusy(false);
    showFlash({ kind:'ok', student:found, groupName, pts:updatedPts, status });
  }

  /* ── check-in submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doCheckIn(input.trim());
  }

  if (!ready) return (
    <div className="min-h-dvh flex items-center justify-center">
      <span className="w-8 h-8 rounded-full border-[3px] border-ink-200 animate-spin" style={{borderTopColor:'var(--accent)'}}/>
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-4"
      style={{background:'var(--bg)'}}>

      {/* ══ UPPER CARD ══ */}
      <div className="bg-white rounded-3xl shadow-lg border border-ink-100 w-full max-w-md overflow-hidden"
        onClick={()=>inputRef.current?.focus()}>
        <div className="p-6 space-y-4">

          {/* Top row: Logo | Date | Log + Exit */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <Image src="/logos/nibras-icon.png" alt="نادي نبراس" width={36} height={36}
              className="shrink-0" style={{objectFit:'contain', objectPosition:'top'}}/>

            <span className="text-xs text-ink-400 text-center flex-1 leading-snug">{dateLabel}</span>

            <div className="flex items-center gap-1 shrink-0">
              {/* Hold-to-exit button */}
              <button
                onPointerDown={e=>{e.stopPropagation(); startExit(e);}}
                onPointerUp={e=>{e.stopPropagation(); stopExit();}}
                onPointerLeave={e=>{e.stopPropagation(); stopExit();}}
                className="relative p-1.5 rounded-lg text-ink-200 hover:text-ink-500 transition-colors select-none"
                style={{touchAction:'none'}} title="اضغط باستمرار للخروج">
                {/* progress ring */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 28 28" style={{transform:'rotate(-90deg)'}}>
                  <circle cx="14" cy="14" r={RING_R} fill="none" stroke="#F0EEE9" strokeWidth="2"/>
                  {exitPct>0 && (
                    <circle cx="14" cy="14" r={RING_R} fill="none" stroke="var(--accent)" strokeWidth="2"
                      strokeDasharray={RING_C}
                      strokeDashoffset={RING_C - (exitPct/100)*RING_C}
                      strokeLinecap="round"/>
                  )}
                </svg>
                <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Clock */}
          <div className="text-center py-1">
            <span className="text-5xl font-bold text-ink-800 tabular-nums tracking-widest"
              style={{fontFamily:'ui-monospace,monospace'}}>{clock}</span>
          </div>

          {/* Input + Button */}
          <form onSubmit={handleSubmit} className="space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="relative">
              <input
                ref={inputRef}
                type="text" inputMode="numeric"
                value={input}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setInput(val);
                  if (val.length === 4 && !busy) doCheckIn(val);
                }}
                disabled={busy} autoFocus autoComplete="off" dir="ltr" placeholder="0000"
                className="w-full text-center rounded-2xl border-2 border-ink-200 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 transition-all bg-white placeholder:text-ink-200 py-5 text-5xl font-bold tracking-[0.2em]"
                style={{fontFamily:'ui-monospace,monospace'}}
              />
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                  <span className="w-7 h-7 rounded-full border-[3px] border-ink-200 animate-spin" style={{borderTopColor:'var(--accent)'}}/>
                </div>
              )}
            </div>
            <button type="submit" disabled={!input.trim()||busy}
              className="btn btn-primary w-full py-3.5 text-base">
              تسجيل الحضور
            </button>
          </form>

          {/* 2 timing chips */}
          <div className="flex gap-2 justify-center flex-wrap" onClick={e=>e.stopPropagation()}>
            <span className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-100 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
              حضور قبل {cfg.lateAfter} · +{cfg.onTimePoints} نقطة
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-full px-3 py-1">
              ⏰ متأخر بعد {cfg.lateAfter} · +{cfg.latePoints} نقطة
            </span>
          </div>
        </div>
      </div>

      {/* ══ LOWER CARD ══ */}
      <div className="bg-white rounded-3xl shadow-lg border border-ink-100 w-full max-w-md p-5">
        <div className="flex items-center gap-3 min-h-[60px] mb-4">
          {flash?.kind==='ok' ? (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0"
                style={{background: STAGE_CLR[flash.student.stage]??'var(--accent)'}}>
                {flash.student.studentName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink-900 text-base truncate">{flash.student.studentName}</div>
                <div className="text-xs text-ink-400 mt-0.5">
                  <span dir="ltr" className="font-mono">#{flash.student.membershipNo}</span>
                  {flash.groupName!=='—' && <> · {flash.groupName}</>}
                  · {flash.student.stage}
                </div>
              </div>
              <span className={`pill shrink-0 ${flash.status==='present' ? 'pill-green' : 'pill-late'}`}>
                {flash.status==='present' ? '✓ حاضر' : '⏰ متأخر'}
              </span>
            </>
          ) : flash?.kind==='dup' ? (
            <div className="flex items-center gap-3 w-full bg-yellow-50 rounded-2xl px-4 py-3 fade-in">
              <span className="text-yellow-500 text-xl">⚠</span>
              <div>
                <div className="font-bold text-ink-900 text-sm">{flash.name}</div>
                <div className="text-xs text-yellow-700">تم تسجيل حضورك مسبقاً اليوم</div>
              </div>
            </div>
          ) : flash?.kind==='early' ? (
            <div className="flex items-center gap-3 w-full bg-blue-50 rounded-2xl px-4 py-3 fade-in">
              <span className="text-blue-500 text-xl">🕐</span>
              <div>
                <div className="font-bold text-ink-900 text-sm">لم يبدأ وقت الحضور بعد</div>
                <div className="text-xs text-blue-700">يبدأ الحضور من الساعة {cfg.attendanceStart}</div>
              </div>
            </div>
          ) : flash?.kind==='err' ? (
            <div className="flex items-center gap-3 w-full bg-red-50 rounded-2xl px-4 py-3 fade-in">
              <span className="text-red-500 text-xl">✗</span>
              <div className="text-red-700 text-sm font-medium">{flash.msg}</div>
            </div>
          ) : (
            <div className="text-ink-300 text-sm w-full text-center py-2">
              في انتظار تسجيل الطالب…
            </div>
          )}
        </div>

        {/* 4 point boxes */}
        <div className="grid grid-cols-4 gap-2 border-t border-ink-100 pt-4">
          <PtBox label="فردية"    value={flash?.kind==='ok' ? flash.pts.individual : null} color="#103F91"/>
          <PtBox label="جماعية"   value={flash?.kind==='ok' ? flash.pts.collective : null} color="#12B3D5"/>
          <PtBox label="الرصيد"   value={flash?.kind==='ok' ? flash.pts.balance    : null} color="#FF9F1C"/>
          <PtBox label="الإجمالي" value={flash?.kind==='ok' ? flash.pts.total      : null} color="#1B7A43"/>
        </div>
      </div>

    </div>
  );
}

function PtBox({ label, value, color }: { label:string; value:number|null; color:string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl py-3 px-1"
      style={{background:`${color}12`, border:`1px solid ${color}25`}}>
      <span className="text-lg font-bold" style={{color: value===null ? '#C4BDB4' : color}}>
        {value===null ? '—' : value}
      </span>
      <span className="text-[10px] text-ink-400">{label}</span>
    </div>
  );
}
