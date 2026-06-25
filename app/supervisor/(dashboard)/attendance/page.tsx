'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = {
  id: number; membershipNo: number; studentName: string;
  stage: string; grade: string; groupId: number | null;
  registrationStatus: string; paymentStatus: string;
};
type Group  = { id: number; name: string; stage: string };
type AttRec = { registrationId: number; date: string; status: string; createdAt?: string };
type LogEntry = {
  registrationId: number; studentName: string; membershipNo: number;
  groupName: string; checkinTime: string; status: 'present' | 'late';
};

const STATUSES = [
  { key: 'present', label: 'حاضر',  colorCls: 'choice-present', pill: 'pill-green'  },
  { key: 'late',    label: 'متأخر',  colorCls: 'choice-late',    pill: 'pill-yellow' },
  { key: 'excused', label: 'معتذر',  colorCls: 'choice-excused', pill: 'pill-blue'   },
  { key: 'absent',  label: 'غائب',   colorCls: 'choice-absent',  pill: 'pill-red'    },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' }); }
  catch { return '—'; }
}

type AttCfg = { attendanceStart: string; lateAfter: string; onTimePoints: number; latePoints: number };
const CFG0: AttCfg = { attendanceStart: '07:30', lateAfter: '08:15', onTimePoints: 2, latePoints: 1 };

export default function AttendancePage() {
  const { user } = useSupervisor();

  const roles = useMemo(() => (user?.role ?? '').split(',').map(r => r.trim()).filter(Boolean), [user]);
  const isAdmin     = roles.includes('admin') || user?.permissions?.includes('*');
  const canEdit     = isAdmin || roles.includes('attendance_supervisor');
  const isGroupsSup = !canEdit && roles.includes('groups_supervisor');
  const isStageSup  = !canEdit && !isGroupsSup && roles.includes('stage_supervisor');

  /* My assigned group IDs (groups_supervisor) */
  const myGroupIds = useMemo(() => {
    if (!user?.groupIds) return new Set<number>();
    return new Set(user.groupIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
  }, [user]);

  /* My assigned stage (stage_supervisor) */
  const myStage = user?.stage ?? '';

  const [date,       setDate]       = useState(todayStr());
  const [students,   setStudents]   = useState<Student[]>([]);
  const [groups,     setGroups]     = useState<Group[]>([]);
  const [records,    setRecords]    = useState<Record<number,string>>({});
  const [fGroup,     setFGroup]     = useState('');
  const [fStage,     setFStage]     = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [quick,      setQuick]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);

  const [cfg,       setCfg]       = useState<AttCfg>(CFG0);
  const [cfgOpen,   setCfgOpen]   = useState(false);
  const [cfgDraft,  setCfgDraft]  = useState<AttCfg>(CFG0);
  const [cfgSaving, setCfgSaving] = useState(false);

  /* daily log */
  const [logOpen,    setLogOpen]    = useState(false);
  const [logSearch,  setLogSearch]  = useState('');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  async function loadStatic() {
    const [sr,gr,cr] = await Promise.all([
      fetch('/api/supervisor/students',          { cache:'no-store' }),
      fetch('/api/supervisor/groups',            { cache:'no-store' }),
      fetch('/api/supervisor/attendance-config', { cache:'no-store' }),
    ]);
    const sj = await sr.json().catch(()=>({students:[]}));
    const gj = await gr.json().catch(()=>({groups:[]}));
    const cj = await cr.json().catch(()=>({}));
    setStudents((sj.students??[]).filter((s:Student) =>
      s.registrationStatus==='approved' &&
      (!s.paymentStatus || s.paymentStatus==='paid' || s.paymentStatus==='exempted')
    ));
    setGroups(gj.groups??[]);
    if (cj.lateAfter) { setCfg(cj); setCfgDraft(cj); }
  }

  async function loadDay(d: string) {
    setLoading(true);
    const r = await fetch(`/api/supervisor/attendance?date=${d}`, { cache:'no-store' });
    const j = await r.json().catch(()=>({attendance:[]}));
    const map: Record<number,string> = {};
    (j.attendance as AttRec[]).forEach(rec=>{ map[rec.registrationId]=rec.status; });
    setRecords(map);
    setLoading(false);
  }

  async function saveConfig() {
    setCfgSaving(true);
    const r = await fetch('/api/supervisor/attendance-config',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(cfgDraft),
    });
    setCfgSaving(false);
    if (r.ok) { setCfg(cfgDraft); setCfgOpen(false); pushToast('success','تم حفظ إعدادات الحضور'); }
    else { const j=await r.json().catch(()=>({})); pushToast('error', j.error??'فشل الحفظ'); }
  }

  async function openLog() {
    setLogSearch('');
    setLogLoading(true);
    setLogOpen(true);
    const r = await fetch(`/api/supervisor/attendance?date=${date}`, { cache:'no-store' });
    const j = await r.json().catch(()=>({attendance:[]}));
    const sMap = new Map(students.map(s => [s.id, s]));
    const gMap = new Map(groups.map(g => [g.id, g.name]));
    const entries: LogEntry[] = (j.attendance as AttRec[])
      .filter(rec => rec.status==='present' || rec.status==='late')
      .sort((a,b) => (b.createdAt??'').localeCompare(a.createdAt??''))
      .flatMap(rec => {
        const s = sMap.get(rec.registrationId);
        if (!s) return [];
        return [{
          registrationId: rec.registrationId,
          studentName: s.studentName,
          membershipNo: s.membershipNo,
          groupName: s.groupId ? (gMap.get(s.groupId)??'—') : '—',
          checkinTime: rec.createdAt ? fmtTime(rec.createdAt) : '—',
          status: rec.status as 'present'|'late',
        }];
      });
    setLogEntries(entries);
    setLogLoading(false);
  }

  async function cancelLogEntry(registrationId: number) {
    const r = await fetch(
      `/api/supervisor/attendance?registrationId=${registrationId}&date=${date}`,
      { method: 'DELETE' }
    );
    if (r.ok) {
      setLogEntries(prev => prev.filter(e => e.registrationId !== registrationId));
      setRecords(prev => { const n={...prev}; delete n[registrationId]; return n; });
    }
  }

  useEffect(() => { loadStatic(); }, []);
  useEffect(() => { loadDay(date); }, [date]);

  async function mark(registrationId: number, status: string) {
    setRecords(prev=>({...prev,[registrationId]:status}));
    const r = await fetch('/api/supervisor/attendance',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ registrationId, date, status }),
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      pushToast('error', j.error??'فشل تسجيل الحضور');
      loadDay(date);
    }
  }

  async function markAll(status: string) {
    const ids = list.map(s=>s.id);
    setRecords(prev=>{ const n={...prev}; ids.forEach(id=>{ n[id]=status; }); return n; });
    await Promise.all(ids.map(id=>fetch('/api/supervisor/attendance',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ registrationId:id, date, status }),
    })));
    pushToast('success', status==='present' ? 'تم تسجيل حضور الكل' : 'تم تسجيل غياب الكل');
  }

  async function quickPresent(e: React.FormEvent) {
    e.preventDefault();
    const mNo = quick.trim();
    if (!mNo||submitting) return;
    setSubmitting(true);
    const r = await fetch('/api/supervisor/attendance',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ membershipNo:mNo, date, status:'present' }),
    });
    const j = await r.json().catch(()=>({}));
    setSubmitting(false);
    if (!r.ok) { pushToast('error', j.error??'لم يتم العثور على الطالب'); }
    else {
      const s = students.find(s=>String(s.membershipNo)===mNo);
      if (s) setRecords(prev=>({...prev,[s.id]:'present'}));
      pushToast('success','تم تسجيل الحضور');
    }
    setQuick('');
    quickRef.current?.focus();
  }

  /* filtered list based on role */
  const list = useMemo(()=>{
    return students.filter(s=>
      (!fGroup||String(s.groupId)===fGroup) &&
      (!fStage||s.stage===fStage) &&
      (!nameSearch.trim()||s.studentName.includes(nameSearch.trim()))
    );
  }, [students,fGroup,fStage,nameSearch]);

  const counts = useMemo(()=>{
    const c = { present:0, late:0, excused:0, absent:0, none:0 };
    list.forEach(s=>{
      const st = records[s.id];
      if (st==='present') c.present++;
      else if (st==='late') c.late++;
      else if (st==='excused') c.excused++;
      else if (st==='absent') c.absent++;
      else c.none++;
    });
    return c;
  },[list,records]);

  const pct = list.length>0
    ? Math.round(((counts.present+counts.late)/list.length)*100)
    : 0;

  /* For stage_supervisor: group the list by family/group */
  const stageGroups = useMemo(()=>{
    if (!isStageSup) return [];
    const groupMap = new Map<number, { group: Group; students: Student[] }>();
    const ungrouped: Student[] = [];
    for (const s of list) {
      if (s.groupId) {
        const g = groups.find(g=>g.id===s.groupId);
        if (g) {
          if (!groupMap.has(g.id)) groupMap.set(g.id, { group: g, students: [] });
          groupMap.get(g.id)!.students.push(s);
        } else ungrouped.push(s);
      } else ungrouped.push(s);
    }
    const result = Array.from(groupMap.values());
    if (ungrouped.length>0) result.push({ group: { id:0, name:'بدون أسرة', stage:'' }, students: ungrouped });
    return result;
  }, [isStageSup, list, groups]);

  const filteredLog = useMemo(()=>{
    if (!logSearch.trim()) return logEntries;
    const q = logSearch.trim();
    return logEntries.filter(e => e.studentName.includes(q) || String(e.membershipNo).includes(q) || e.groupName.includes(q));
  }, [logEntries, logSearch]);

  const logPresentCnt = logEntries.filter(e=>e.status==='present').length;
  const logLateCnt    = logEntries.filter(e=>e.status==='late').length;

  return (
    <div className="space-y-4">

      {/* ── Settings modal ── */}
      {cfgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in"
          onClick={()=>setCfgOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-ink-100 w-full max-w-xs p-5 pop-in"
            onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink-900">إعدادات الحضور</h2>
              <button onClick={()=>setCfgOpen(false)} className="text-ink-300 hover:text-ink-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label text-xs">وقت بداية الحضور</label>
                <input type="time" className="field text-sm py-2" value={cfgDraft.attendanceStart}
                  onChange={e=>setCfgDraft(d=>({...d,attendanceStart:e.target.value}))}/>
              </div>
              <div>
                <label className="label text-xs">وقت التأخر</label>
                <input type="time" className="field text-sm py-2" value={cfgDraft.lateAfter}
                  onChange={e=>setCfgDraft(d=>({...d,lateAfter:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">نقاط الحضور</label>
                  <input type="number" min={0} max={99} className="field text-sm py-2" value={cfgDraft.onTimePoints}
                    onChange={e=>setCfgDraft(d=>({...d,onTimePoints:Number(e.target.value)}))}/>
                </div>
                <div>
                  <label className="label text-xs">نقاط التأخر</label>
                  <input type="number" min={0} max={99} className="field text-sm py-2" value={cfgDraft.latePoints}
                    onChange={e=>setCfgDraft(d=>({...d,latePoints:Number(e.target.value)}))}/>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={()=>setCfgOpen(false)} className="btn btn-ghost text-sm py-2 px-4">إلغاء</button>
              <button onClick={saveConfig} disabled={cfgSaving} className="btn btn-primary text-sm py-2 px-5">
                {cfgSaving ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Daily Log Modal ── */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm fade-in"
          onClick={()=>setLogOpen(false)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-ink-100 pop-in flex flex-col max-h-[90dvh]"
            onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-ink-100 shrink-0">
              <div>
                <h2 className="font-bold text-ink-900">سجل الحضور — {date}</h2>
                <div className="flex gap-2 mt-1">
                  <span className="pill pill-green text-xs">حاضر {logPresentCnt}</span>
                  {logLateCnt>0 && <span className="pill pill-yellow text-xs">متأخر {logLateCnt}</span>}
                </div>
              </div>
              <button onClick={()=>setLogOpen(false)} className="p-1.5 rounded-lg text-ink-300 hover:text-ink-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-5 py-3 border-b border-ink-100 shrink-0">
              <input type="text" className="field py-2 text-sm" placeholder="بحث بالاسم أو رقم العضوية أو المجموعة…"
                value={logSearch} onChange={e=>setLogSearch(e.target.value)} autoFocus/>
            </div>
            <div className="overflow-y-auto scroll-soft flex-1 divide-y divide-ink-100">
              {logLoading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="w-7 h-7 rounded-full border-[3px] border-ink-200 animate-spin" style={{borderTopColor:'var(--accent)'}}/>
                </div>
              ) : filteredLog.length===0 ? (
                <p className="text-center py-12 text-ink-300 text-sm">لا توجد نتائج</p>
              ) : filteredLog.map(e=>(
                <div key={e.registrationId} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand/10 text-brand text-sm font-bold shrink-0">
                    {e.studentName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-ink-900 truncate">{e.studentName}</div>
                    <div className="text-xs text-ink-400 truncate">
                      <span dir="ltr" className="font-mono">#{e.membershipNo}</span>
                      {e.groupName!=='—' && <> · {e.groupName}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-ink-500 tabular-nums">{e.checkinTime}</span>
                    <span className={`pill text-[11px] py-0.5 px-2 ${e.status==='present' ? 'pill-green' : 'pill-yellow'}`}>
                      {e.status==='present' ? 'حاضر' : 'متأخر'}
                    </span>
                    {canEdit && (
                      <button onClick={()=>cancelLogEntry(e.registrationId)}
                        className="p-1 rounded-lg text-ink-200 hover:text-red-500 hover:bg-red-50 transition-colors" title="إلغاء الحضور">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-ink-100 shrink-0">
              <button onClick={()=>setLogOpen(false)} className="btn btn-ghost w-full py-2 text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">تسجيل الحضور</h1>
          <p className="text-sm text-ink-400">{date}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Log button — visible to all */}
          <button onClick={openLog}
            className="btn btn-ghost text-sm py-2 px-3 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
            السجل
          </button>
          {/* Settings — canEdit only */}
          {canEdit && (
            <button onClick={()=>{ setCfgDraft(cfg); setCfgOpen(true); }}
              className="btn btn-ghost text-sm py-2 px-3 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              إعدادات
            </button>
          )}
          {/* Kiosk link — canEdit only */}
          {canEdit && (
            <Link href="/supervisor/attendance/kiosk"
              className="btn btn-primary text-sm py-2 px-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              شاشة التحضير
            </Link>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="label">التاريخ</label>
          <input type="date" className="field" dir="ltr" value={date}
            onChange={e=>setDate(e.target.value)}/>
        </div>
        {/* Stage filter: hidden for groups_supervisor & stage_supervisor (auto-filtered) */}
        {!isGroupsSup && !isStageSup && (
          <div>
            <label className="label">المرحلة</label>
            <select className="field" value={fStage}
              onChange={e=>{ setFStage(e.target.value); setFGroup(''); }}>
              <option value="">كل المراحل</option>
              <option value="ابتدائي">ابتدائي</option>
              <option value="متوسط">متوسط</option>
              <option value="ثانوي">ثانوي</option>
            </select>
          </div>
        )}
        {/* Group filter: hidden for groups_supervisor (auto-filtered) */}
        {!isGroupsSup && !isStageSup && (
          <div>
            <label className="label">المجموعة</label>
            <select className="field" value={fGroup} onChange={e=>setFGroup(e.target.value)}>
              <option value="">كل المجموعات</option>
              {groups
                .filter(g=>!fStage||(g as {stage?:string}).stage===fStage)
                .map(g=><option key={g.id} value={String(g.id)}>{g.name}</option>)}
            </select>
          </div>
        )}
        {canEdit && (
          <form onSubmit={quickPresent}>
            <label className="label">تحضير سريع</label>
            <div className="flex gap-2">
              <input ref={quickRef} className="field flex-1" dir="ltr" placeholder="رقم العضوية"
                value={quick} onChange={e=>setQuick(e.target.value)} inputMode="numeric"/>
              <button type="submit" className="btn btn-primary px-4">✓</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          <span className="pill pill-green">حاضر {counts.present}</span>
          <span className="pill pill-yellow">متأخر {counts.late}</span>
          <span className="pill pill-blue">معتذر {counts.excused}</span>
          <span className="pill pill-red">غائب {counts.absent}</span>
          <span className="pill pill-gray">بدون {counts.none}</span>
          {list.length>0 && (
            <span className="pill" style={{background:'#e0f2fe',color:'#0369a1'}}>{pct}% حضور</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" className="field py-1.5 px-3 text-xs w-40" placeholder="بحث بالاسم..."
            value={nameSearch} onChange={e=>setNameSearch(e.target.value)}/>
          {canEdit && <>
            <button className="btn btn-ghost text-xs py-1.5 px-3 text-green-600 border-green-200 hover:bg-green-50"
              onClick={()=>markAll('present')}>حضور الكل</button>
            <button className="btn btn-ghost text-xs py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50"
              onClick={()=>markAll('absent')}>غياب الكل</button>
          </>}
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="card p-16 text-center text-ink-400 text-sm">جارٍ التحميل…</div>
      ) : list.length===0 ? (
        <div className="card p-16 text-center text-ink-400 text-sm">لا يوجد طلاب.</div>
      ) : isStageSup ? (
        /* Stage supervisor: grouped by family */
        <div className="space-y-4">
          {stageGroups.map(({ group, students: groupStudents }) => (
            <div key={group.id} className="card p-0 overflow-hidden">
              <div className="px-4 py-3 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
                <span className="font-semibold text-ink-800 text-sm">{group.name}</span>
                <span className="text-xs text-ink-400">{groupStudents.length} طالب</span>
              </div>
              <ul className="divide-y divide-ink-100">
                {groupStudents.map(s=>{
                  const st = records[s.id];
                  const sp = STATUSES.find(x=>x.key===st);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-ink-900 truncate">{s.studentName}</div>
                        <div className="text-xs text-ink-400">
                          <span dir="ltr" className="font-mono">#{s.membershipNo}</span>
                          · {s.grade}
                        </div>
                      </div>
                      {sp ? (
                        <span className={`pill text-xs shrink-0 ${sp.pill}`}>{sp.label}</span>
                      ) : (
                        <span className="pill pill-gray text-xs shrink-0">بدون</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : isGroupsSup ? (
        /* Groups supervisor: simple read-only list */
        <div className="card p-0 overflow-hidden">
          <ul className="divide-y divide-ink-200">
            {list.map(s=>{
              const st = records[s.id];
              const sp = STATUSES.find(x=>x.key===st);
              return (
                <li key={s.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 truncate">{s.studentName}</div>
                    <div className="text-xs text-ink-400">
                      <span dir="ltr" className="font-mono">#{s.membershipNo}</span>
                      · {s.stage} — {s.grade}
                    </div>
                  </div>
                  {sp ? (
                    <span className={`pill text-xs shrink-0 ${sp.pill}`}>{sp.label}</span>
                  ) : (
                    <span className="pill pill-gray text-xs shrink-0">بدون</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        /* canEdit: full editable table */
        <div className="card p-0 overflow-hidden">
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto scroll-soft">
            <table className="tbl">
              <thead>
                <tr>
                  <th>الطالب</th><th>العضوية</th><th>المرحلة</th><th>الأسرة</th><th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {list.map(s=>{
                  const groupName = s.groupId ? groups.find(g=>g.id===s.groupId)?.name??'—' : '—';
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">{s.studentName}</td>
                      <td dir="ltr" className="text-right font-mono text-ink-500 text-sm">#{s.membershipNo}</td>
                      <td className="text-ink-500 text-sm">{s.stage} — {s.grade}</td>
                      <td className="text-ink-500 text-sm">{groupName}</td>
                      <td>
                        <div className="flex gap-1.5">
                          {STATUSES.map(st=>(
                            <button key={st.key} onClick={()=>mark(s.id,st.key)}
                              className={`choice py-1 px-3 text-xs ${st.colorCls} ${records[s.id]===st.key ? 'is-active' : ''}`}>
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <ul className="lg:hidden divide-y divide-ink-200">
            {list.map(s=>{
              const current = records[s.id];
              const groupName = s.groupId ? groups.find(g=>g.id===s.groupId)?.name??'—' : '—';
              return (
                <li key={s.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="font-semibold text-ink-900 truncate">{s.studentName}</span>
                    <span dir="ltr" className="font-mono text-xs text-ink-400 shrink-0">#{s.membershipNo}</span>
                  </div>
                  <div className="text-xs text-ink-400 mb-3">
                    {s.stage} — {s.grade}
                    {groupName!=='—' && <span className="mr-2">· {groupName}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STATUSES.map(st=>(
                      <button key={st.key} onClick={()=>mark(s.id,st.key)}
                        className={`choice py-2 text-xs ${st.colorCls} ${current===st.key ? 'is-active' : ''}`}>
                        {st.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
