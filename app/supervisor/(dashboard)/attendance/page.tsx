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
type Group = { id: number; name: string; stage: string };
type AttRec = { registrationId: number; date: string; status: string };
type PointRec = { registrationId: number; delta: number; pointType: string; reason: string };

const STATUSES = [
  { key: 'present', label: 'حاضر',  cls: 'pill-green'  },
  { key: 'late',    label: 'معتذر', cls: 'pill-yellow' },
  { key: 'absent',  label: 'غائب',  cls: 'pill-red'    },
];

const STAGE_COLORS: Record<string, string> = {
  ابتدائي: '#12B3D5',
  متوسط:   '#103F91',
  ثانوي:   '#E52E25',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcPoints(pts: PointRec[]) {
  let individual = 0, collective = 0, deduction = 0;
  for (const p of pts) {
    const t = p.pointType ?? (
      (p.reason ?? '').endsWith('(رصد جماعي للأسرة)') ? 'collective'
        : p.delta < 0 ? 'deduction' : 'individual'
    );
    if (t === 'individual') individual += p.delta;
    else if (t === 'collective') collective += p.delta;
    else deduction += p.delta;
  }
  const total = individual + collective;
  const balance = Math.max(0, total + deduction);
  return { individual, collective, balance, total };
}

type CheckIn = {
  student: Student;
  groupName: string;
  time: string;
  pts: { individual: number; collective: number; balance: number; total: number };
};

type AttCfg = { earlyBefore: string; lateAfter: string; earlyPoints: number; onTimePoints: number; latePoints: number };
const CFG_DEFAULT: AttCfg = { earlyBefore: '08:00', lateAfter: '08:15', earlyPoints: 3, onTimePoints: 2, latePoints: 1 };

export default function AttendancePage() {
  useSupervisor();

  const [mode, setMode] = useState<'fast' | 'list'>('fast');
  const [date, setDate] = useState(todayStr());
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [records, setRecords] = useState<Record<number, string>>({});
  const [allPoints, setAllPoints] = useState<PointRec[]>([]);
  const [fGroup, setFGroup] = useState('');
  const [fStage, setFStage] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [quick, setQuick] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [flash, setFlash] = useState<CheckIn | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  /* attendance config */
  const [cfg, setCfg]         = useState<AttCfg>(CFG_DEFAULT);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgDraft, setCfgDraft] = useState<AttCfg>(CFG_DEFAULT);
  const [cfgSaving, setCfgSaving] = useState(false);

  async function loadStatic() {
    const [sr, gr, pr, cr] = await Promise.all([
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/points', { cache: 'no-store' }),
      fetch('/api/supervisor/attendance-config', { cache: 'no-store' }),
    ]);
    const sj = await sr.json().catch(() => ({ students: [] }));
    const gj = await gr.json().catch(() => ({ groups: [] }));
    const pj = await pr.json().catch(() => ({ points: [] }));
    const cj = await cr.json().catch(() => ({}));
    const allSt: Student[] = sj.students ?? [];
    setStudents(allSt.filter(s =>
      s.registrationStatus === 'approved' &&
      (s.paymentStatus === 'paid' || s.paymentStatus === 'exempted')
    ));
    setGroups(gj.groups ?? []);
    setAllPoints(pj.points ?? []);
    if (cj.earlyBefore) { setCfg(cj); setCfgDraft(cj); }
  }

  async function saveConfig() {
    setCfgSaving(true);
    const r = await fetch('/api/supervisor/attendance-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfgDraft),
    });
    setCfgSaving(false);
    if (r.ok) { setCfg(cfgDraft); setCfgOpen(false); pushToast('success', 'تم حفظ إعدادات الحضور'); }
    else { const j = await r.json().catch(()=>({})); pushToast('error', j.error ?? 'فشل الحفظ'); }
  }

  async function loadDay(d: string) {
    setLoading(true);
    const r = await fetch(`/api/supervisor/attendance?date=${d}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({ attendance: [] }));
    const map: Record<number, string> = {};
    (j.attendance as AttRec[]).forEach(rec => { map[rec.registrationId] = rec.status; });
    setRecords(map);
    setLoading(false);
  }

  useEffect(() => { loadStatic(); }, []);
  useEffect(() => { loadDay(date); }, [date]);
  useEffect(() => {
    if (mode === 'fast') quickRef.current?.focus();
  }, [mode]);

  async function mark(registrationId: number, status: string) {
    setRecords(prev => ({ ...prev, [registrationId]: status }));
    const r = await fetch('/api/supervisor/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId, date, status }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      pushToast('error', j.error ?? 'فشل تسجيل الحضور');
      loadDay(date);
    }
  }

  async function markAll(status: string) {
    const ids = list.map(s => s.id);
    const updates = ids.map(id => fetch('/api/supervisor/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: id, date, status }),
    }));
    setRecords(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = status; }); return n; });
    await Promise.all(updates);
    pushToast('success', status === 'present' ? 'تم تسجيل حضور الكل' : 'تم تسجيل غياب الكل');
  }

  async function quickPresent(e: React.FormEvent) {
    e.preventDefault();
    const mNo = quick.trim();
    if (!mNo || submitting) return;
    setSubmitting(true);

    const r = await fetch('/api/supervisor/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipNo: mNo, date, status: 'present' }),
    });
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      pushToast('error', j.error ?? 'لم يتم العثور على الطالب');
      setQuick('');
      setSubmitting(false);
      quickRef.current?.focus();
      return;
    }

    const student = students.find(s => String(s.membershipNo) === mNo);
    if (student) {
      setRecords(prev => ({ ...prev, [student.id]: 'present' }));
      const groupName = student.groupId
        ? groups.find(g => g.id === student.groupId)?.name ?? '—'
        : '—';
      const studentPts = allPoints.filter(p => p.registrationId === student.id);
      const pts = calcPoints(studentPts);
      const now = new Date();
      const time = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const checkIn: CheckIn = { student, groupName, time, pts };
      setFlash(checkIn);
      setCheckIns(prev => [checkIn, ...prev]);
    }

    setQuick('');
    setSubmitting(false);
    quickRef.current?.focus();
  }

  const list = useMemo(() =>
    students.filter(s =>
      (!fGroup || String(s.groupId) === fGroup) &&
      (!fStage || s.stage === fStage) &&
      (!nameSearch.trim() || s.studentName.includes(nameSearch.trim()))
    ),
    [students, fGroup, fStage, nameSearch]
  );

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, none: 0 };
    list.forEach(s => {
      const st = records[s.id];
      if (st === 'present') c.present++;
      else if (st === 'late') c.late++;
      else if (st === 'absent') c.absent++;
      else c.none++;
    });
    return c;
  }, [list, records]);

  const pct = list.length > 0
    ? Math.round(((counts.present + counts.late) / list.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header + mode toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">تسجيل الحضور</h1>
          <p className="text-sm text-ink-400">{date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCfgDraft(cfg); setCfgOpen(v => !v); }}
            className="btn btn-ghost text-sm py-2 px-3 flex items-center gap-1.5"
            title="إعدادات الحضور"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            إعدادات
          </button>
          <Link
            href="/supervisor/attendance/kiosk"
            className="btn btn-primary text-sm py-2 px-4 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            شاشة التحضير
          </Link>
          <div className="flex bg-ink-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setMode('fast')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === 'fast'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            ⚡ وضع سريع
          </button>
          <button
            onClick={() => setMode('list')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === 'list'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            قائمة كاملة
          </button>
          </div>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {cfgOpen && (
        <div className="card p-5 border-brand/20 bg-brand/5 fade-in">
          <h2 className="font-bold text-ink-900 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            إعدادات أوقات الحضور
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* مبكر */}
            <div className="rounded-xl p-4 space-y-3" style={{ background:'#E7F6EC', border:'1px solid #1B7A4325' }}>
              <div className="font-bold text-sm" style={{ color:'#1B7A43' }}>⭐ مبكر</div>
              <div>
                <label className="label text-xs">قبل الساعة</label>
                <input type="time" className="field text-sm py-2"
                  value={cfgDraft.earlyBefore}
                  onChange={e => setCfgDraft(d => ({ ...d, earlyBefore: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">عدد النقاط</label>
                <input type="number" min={0} max={99} className="field text-sm py-2"
                  value={cfgDraft.earlyPoints}
                  onChange={e => setCfgDraft(d => ({ ...d, earlyPoints: Number(e.target.value) }))} />
              </div>
            </div>
            {/* في الوقت */}
            <div className="rounded-xl p-4 space-y-3" style={{ background:'#EAF1F9', border:'1px solid #103F9125' }}>
              <div className="font-bold text-sm" style={{ color:'#103F91' }}>✓ في الوقت</div>
              <div className="text-xs text-ink-500 pt-1">
                النطاق بين وقت المبكر ووقت المتأخر
                <br/>
                <span className="font-mono font-bold text-ink-700">{cfgDraft.earlyBefore} — {cfgDraft.lateAfter}</span>
              </div>
              <div>
                <label className="label text-xs">عدد النقاط</label>
                <input type="number" min={0} max={99} className="field text-sm py-2"
                  value={cfgDraft.onTimePoints}
                  onChange={e => setCfgDraft(d => ({ ...d, onTimePoints: Number(e.target.value) }))} />
              </div>
            </div>
            {/* متأخر */}
            <div className="rounded-xl p-4 space-y-3" style={{ background:'#FCF3DC', border:'1px solid #9A6B0025' }}>
              <div className="font-bold text-sm" style={{ color:'#9A6B00' }}>⏰ متأخر</div>
              <div>
                <label className="label text-xs">بعد الساعة</label>
                <input type="time" className="field text-sm py-2"
                  value={cfgDraft.lateAfter}
                  onChange={e => setCfgDraft(d => ({ ...d, lateAfter: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">عدد النقاط</label>
                <input type="number" min={0} max={99} className="field text-sm py-2"
                  value={cfgDraft.latePoints}
                  onChange={e => setCfgDraft(d => ({ ...d, latePoints: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCfgOpen(false)} className="btn btn-ghost text-sm py-2 px-4">إلغاء</button>
            <button onClick={saveConfig} disabled={cfgSaving} className="btn btn-primary text-sm py-2 px-5">
              {cfgSaving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
            </button>
          </div>
        </div>
      )}

      {/* ── FAST MODE ── */}
      {mode === 'fast' && (
        <div className="space-y-4">
          {/* Date selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-ink-500 shrink-0">التاريخ</label>
            <input
              type="date"
              className="field py-2 text-sm max-w-[180px]"
              dir="ltr"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Input */}
          <form onSubmit={quickPresent}>
            <div className="card p-6 flex flex-col items-center gap-4">
              <p className="text-ink-500 text-sm">أدخل رقم العضوية ثم اضغط Enter</p>
              <div className="relative w-full max-w-xs">
                <input
                  ref={quickRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="رقم العضوية"
                  value={quick}
                  onChange={e => setQuick(e.target.value)}
                  disabled={submitting}
                  autoFocus
                  dir="ltr"
                  className="w-full text-center text-3xl font-bold py-5 px-6 rounded-2xl border-2 border-ink-200 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 transition-all bg-white placeholder:text-ink-200 tracking-widest"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                />
                {submitting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                    <span className="w-6 h-6 rounded-full border-2 border-ink-200 animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary px-8" disabled={!quick.trim() || submitting}>
                تسجيل حضور
              </button>
            </div>
          </form>

          {/* Flash card — last check-in */}
          {flash && (
            <div key={flash.student.id + flash.time} className="card p-4 border-2 border-green-200 bg-green-50/30 fade-in">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
                  style={{ background: STAGE_COLORS[flash.student.stage] ?? 'var(--accent)' }}
                >
                  {flash.student.studentName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-ink-900 text-base">{flash.student.studentName}</span>
                    <span className="font-mono text-xs text-ink-400">#{flash.student.membershipNo}</span>
                    <span className="pill pill-green text-xs">حاضر ✓</span>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {flash.student.stage} · {flash.student.grade}
                    {flash.groupName !== '—' && <> · {flash.groupName}</>}
                  </div>
                  {/* 4 point boxes */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <PointBox label="فردية" value={flash.pts.individual} color="#103F91" />
                    <PointBox label="جماعية" value={flash.pts.collective} color="#12B3D5" />
                    <PointBox label="الرصيد" value={flash.pts.balance} color="#FF9F1C" />
                    <PointBox label="الاجمالي" value={flash.pts.total} color="#1B7A43" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Today's check-ins log */}
          {checkIns.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-600">تسجيلات هذه الجلسة ({checkIns.length})</h2>
              <div className="card p-0 overflow-hidden divide-y divide-ink-100">
                {checkIns.map((ci, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: STAGE_COLORS[ci.student.stage] ?? 'var(--accent)' }}
                    >
                      {ci.student.studentName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-ink-900 truncate">{ci.student.studentName}</div>
                      <div className="text-xs text-ink-400">{ci.groupName}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs text-ink-400">#{ci.student.membershipNo}</span>
                      <span className="text-xs text-ink-400">{ci.time}</span>
                      <span className="pill pill-green text-xs">حاضر</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {checkIns.length === 0 && !flash && (
            <div className="text-center py-8 text-ink-300 text-sm">
              لم يتم تسجيل أي طالب بعد
            </div>
          )}
        </div>
      )}

      {/* ── LIST MODE ── */}
      {mode === 'list' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">التاريخ</label>
              <input
                type="date"
                className="field"
                dir="ltr"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">المرحلة</label>
              <select className="field" value={fStage} onChange={e => { setFStage(e.target.value); setFGroup(''); }}>
                <option value="">كل المراحل</option>
                <option value="ابتدائي">ابتدائي</option>
                <option value="متوسط">متوسط</option>
                <option value="ثانوي">ثانوي</option>
              </select>
            </div>
            <div>
              <label className="label">المجموعة</label>
              <select className="field" value={fGroup} onChange={e => setFGroup(e.target.value)}>
                <option value="">كل المجموعات</option>
                {groups
                  .filter(g => !fStage || (g as { stage?: string }).stage === fStage)
                  .map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </select>
            </div>
            <form onSubmit={quickPresent}>
              <label className="label">تحضير سريع</label>
              <div className="flex gap-2">
                <input
                  className="field flex-1"
                  dir="ltr"
                  placeholder="رقم العضوية"
                  value={quick}
                  onChange={e => setQuick(e.target.value)}
                  inputMode="numeric"
                />
                <button type="submit" className="btn btn-primary px-4">✓</button>
              </div>
            </form>
          </div>

          {/* Stats + search + bulk */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-wrap gap-2 flex-1">
              <span className="pill pill-green">حاضر {counts.present}</span>
              <span className="pill pill-yellow">معتذر {counts.late}</span>
              <span className="pill pill-red">غائب {counts.absent}</span>
              <span className="pill pill-gray">بدون {counts.none}</span>
              {list.length > 0 && <span className="pill pill-blue">{pct}% حضور</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="field py-1.5 px-3 text-xs w-40"
                placeholder="بحث بالاسم..."
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
              <button
                className="btn btn-ghost text-xs py-1.5 px-3 text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => markAll('present')}
              >
                حضور الكل
              </button>
              <button
                className="btn btn-ghost text-xs py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => markAll('absent')}
              >
                غياب الكل
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
            ) : list.length === 0 ? (
              <p className="text-center py-16 text-ink-400 text-sm">لا يوجد طلاب.</p>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto scroll-soft">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>الطالب</th>
                        <th>العضوية</th>
                        <th>المرحلة</th>
                        <th>الأسرة</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(s => {
                        const groupName = s.groupId
                          ? groups.find(g => g.id === s.groupId)?.name ?? '—'
                          : '—';
                        return (
                          <tr key={s.id}>
                            <td className="font-medium">{s.studentName}</td>
                            <td dir="ltr" className="text-right font-mono text-ink-500 text-sm">
                              #{s.membershipNo}
                            </td>
                            <td className="text-ink-500 text-sm">{s.stage} — {s.grade}</td>
                            <td className="text-ink-500 text-sm">{groupName}</td>
                            <td>
                              <div className="flex gap-1.5">
                                {STATUSES.map(st => (
                                  <button
                                    key={st.key}
                                    onClick={() => mark(s.id, st.key)}
                                    className={`choice py-1 px-3 text-xs ${records[s.id] === st.key ? 'is-active' : ''}`}
                                  >
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
                  {list.map(s => {
                    const current = records[s.id];
                    const groupName = s.groupId
                      ? groups.find(g => g.id === s.groupId)?.name ?? '—'
                      : '—';
                    return (
                      <li key={s.id} className="p-4">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="font-semibold text-ink-900 truncate">{s.studentName}</span>
                          <span dir="ltr" className="font-mono text-xs text-ink-400 shrink-0">
                            #{s.membershipNo}
                          </span>
                        </div>
                        <div className="text-xs text-ink-400 mb-3">
                          {s.stage} — {s.grade}
                          {groupName !== '—' && <span className="mr-2">· {groupName}</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {STATUSES.map(st => (
                            <button
                              key={st.key}
                              onClick={() => mark(s.id, st.key)}
                              className={`choice py-2 text-xs ${current === st.key ? 'is-active' : ''}`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PointBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl py-2 px-1" style={{ background: color + '15', border: `1px solid ${color}30` }}>
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
      <span className="text-[10px] text-ink-500">{label}</span>
    </div>
  );
}
