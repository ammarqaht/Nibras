'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = { id: number; membershipNo: number; studentName: string; groupId: number | null; registrationStatus: string; paymentStatus: string };
type Group = { id: number; name: string };
type Point = {
  id: number; registrationId: number; delta: number; reason: string;
  category: string; recordedBy: string | null; createdAt: string;
};

const CATEGORIES = [
  { key: 'behavior', label: 'سلوك' },
  { key: 'participation', label: 'مشاركة' },
  { key: 'activity', label: 'نشاط' },
  { key: 'other', label: 'أخرى' }
];
const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;

export default function PointsPage() {
  const { user } = useSupervisor();
  const roles = user?.role ? user.role.split(',').map((r) => r.trim()) : [];
  const isGlobal = roles.some((r) =>
    ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [groupId, setGroupId] = useState('');
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('5');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('behavior');
  const [busy, setBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'history'>('leaderboard');
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

  async function loadAll() {
    const [sr, gr, pr] = await Promise.all([
      fetch('/api/supervisor/students?scope=all', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/points', { cache: 'no-store' })
    ]);
    const srj = await sr.json().catch(() => ({ students: [] }));
    const grj = await gr.json().catch(() => ({ groups: [] }));
    const prj = await pr.json().catch(() => ({ points: [] }));
    const allSt: Student[] = srj.students ?? [];
    setStudents(allSt.filter((s) => s.registrationStatus === 'approved' && (s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' || s.paymentStatus === '')));

    setGroups(grj.groups ?? []);
    setPoints(prj.points ?? []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        if (studentId) {
          const selected = students.find((s) => String(s.id) === studentId);
          if (selected) {
            setStudentQuery(`${selected.studentName} (#${selected.membershipNo})`);
          }
        } else {
          setStudentQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [studentId, students]);

  const nameOf = useMemo(() => {
    const m = new Map(students.map((s) => [s.id, s.studentName]));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [students]);

  const leaderboard = useMemo(() => {
    const pointsMap = new Map<number, number>();
    points.forEach((p) => {
      pointsMap.set(p.registrationId, (pointsMap.get(p.registrationId) ?? 0) + p.delta);
    });

    const list = students.map((s) => {
      const total = pointsMap.get(s.id) ?? 0;
      const groupName = s.groupId ? groups.find((g) => g.id === s.groupId)?.name : '—';
      return {
        ...s,
        totalPoints: total,
        groupName
      };
    });

    list.sort((a, b) => b.totalPoints - a.totalPoints);
    return list;
  }, [students, points, groups]);

  const filteredLeaderboard = useMemo(() => {
    return leaderboard.filter((item) =>
      item.studentName.toLowerCase().includes(leaderboardSearch.trim().toLowerCase())
    );
  }, [leaderboard, leaderboardSearch]);

  const filteredStudents = useMemo(() => {
    if (!studentQuery.trim()) return students;
    const q = studentQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        String(s.membershipNo).includes(q)
    );
  }, [students, studentQuery]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const delta = sign * Math.abs(parseInt(amount, 10) || 0);
    if (!delta || !reason.trim()) return pushToast('error', 'أدخل عدد النقاط والسبب');
    if (mode === 'individual' && !studentId) return pushToast('error', 'اختر الطالب');
    if (mode === 'group' && !groupId) return pushToast('error', 'اختر المجموعة');

    setBusy(true);
    const r = await fetch('/api/supervisor/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: mode === 'individual' ? studentId : undefined,
        groupId: mode === 'group' ? groupId : undefined,
        delta, reason: reason.trim(), category
      })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل تسجيل النقاط');
    pushToast('success', j.bulk ? `تم رصد النقاط لـ ${j.pointRecords.length} طالب` : 'تم رصد النقاط');
    setReason('');
    setStudentId('');
    setStudentQuery('');
    loadAll();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">رصد النقاط</h1>
        <p className="text-sm text-ink-500">امنح أو اخصم نقاطاً لطالب أو لمجموعة كاملة.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form onSubmit={submit} className="card p-6 space-y-4 lg:col-span-1 self-start">
          {isGlobal && (
            <div className="flex gap-2">
              <button type="button" className={`choice flex-1 ${mode === 'individual' ? 'is-active' : ''}`} onClick={() => setMode('individual')}>طالب</button>
              <button type="button" className={`choice flex-1 ${mode === 'group' ? 'is-active' : ''}`} onClick={() => setMode('group')}>مجموعة</button>
            </div>
          )}


            {mode === 'individual' ? (
              <div className="relative font-sans" ref={searchContainerRef}>
                <label className="label">الطالب</label>
                <div className="relative">
                  <input
                    type="text"
                    className="field w-full pl-8 pr-3"
                    placeholder="ابحث عن طالب بالاسم أو العضوية..."
                    value={studentQuery}
                    onChange={(e) => {
                      setStudentQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (!e.target.value) {
                        setStudentId('');
                      }
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                  />
                  {studentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentId('');
                        setStudentQuery('');
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900 font-bold p-0.5 flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg max-h-60 overflow-y-auto scroll-soft">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-sm text-ink-400 text-center">لا يوجد طلاب يطابقون البحث</div>
                    ) : (
                      filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setStudentId(String(s.id));
                            setStudentQuery(`${s.studentName} (#${s.membershipNo})`);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-right px-3 py-2 text-sm hover:bg-cream-50 transition-colors flex items-center justify-between border-b border-ink-50 last:border-0 ${
                            studentId === String(s.id) ? 'bg-brand/5 text-brand-600 font-semibold' : 'text-ink-900'
                          }`}
                        >
                          <span className="font-semibold">{s.studentName}</span>
                          <span className="text-xs text-ink-400 font-mono">#{s.membershipNo}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="label">المجموعة / الأسرة</label>
                <select className="field" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">اختر المجموعة</option>
                  {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">النوع</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`choice choice-add flex-1 transition-all ${
                    sign === 1
                      ? 'is-active font-bold'
                      : 'text-green-600 border-green-200 bg-white hover:bg-green-50'
                  }`}
                  onClick={() => setSign(1)}
                >
                  + إضافة
                </button>
                <button
                  type="button"
                  className={`choice choice-deduct flex-1 transition-all ${
                    sign === -1
                      ? 'is-active font-bold'
                      : 'text-red-600 border-red-200 bg-white hover:bg-red-50'
                  }`}
                  onClick={() => setSign(-1)}
                >
                  − خصم
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">عدد النقاط</label>
                <input className="field" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label className="label">التصنيف</label>
                <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">السبب</label>
              <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تميّز في النشاط" />
            </div>

            <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : 'رصد النقاط'}</button>
          </form>



        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-ink-200 pb-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`choice py-1.5 px-4 text-sm flex items-center gap-1.5 ${activeTab === 'leaderboard' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('leaderboard')}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                  <path d="M12 2a6 6 0 0 1 6 6v7a6 6 0 0 1-12 0V8a6 6 0 0 1 6-6Z" />
                </svg>
                <span>ترتيب الصدارة</span>
              </button>
              <button
                type="button"
                className={`choice py-1.5 px-4 text-sm flex items-center gap-1.5 ${activeTab === 'history' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>سجل رصد النقاط</span>
              </button>
            </div>
            
            {activeTab === 'leaderboard' && (
              <input
                type="text"
                placeholder="ابحث عن اسم طالب..."
                className="field py-1 px-3 text-xs sm:w-48"
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
              />
            )}
          </div>

          {loading ? (
            <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
          ) : activeTab === 'leaderboard' ? (
            filteredLeaderboard.length === 0 ? (
              <p className="text-center py-10 text-ink-400 text-sm">لا يوجد طلاب تطابق خيارات البحث.</p>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto scroll-soft">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>الترتيب</th>
                        <th>الطالب</th>
                        <th>رقم العضوية</th>
                        <th>الأسرة / المجموعة</th>
                        <th>إجمالي النقاط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeaderboard.map((item) => {
                        const rank = leaderboard.findIndex((x) => x.id === item.id) + 1;
                        let rankBadge;
                        if (rank === 1) rankBadge = <span className="w-6 h-6 rounded-full bg-amber-400 text-ink-900 border border-amber-500 font-bold text-xs flex items-center justify-center shadow-sm" title="المركز الأول">١</span>;
                        else if (rank === 2) rankBadge = <span className="w-6 h-6 rounded-full bg-slate-300 text-ink-900 border border-slate-400 font-bold text-xs flex items-center justify-center shadow-sm" title="المركز الثاني">٢</span>;
                        else if (rank === 3) rankBadge = <span className="w-6 h-6 rounded-full bg-amber-600 text-white border border-amber-700 font-bold text-xs flex items-center justify-center shadow-sm" title="المركز الثالث">٣</span>;
                        else rankBadge = <span className="text-ink-400 font-mono">#{rank}</span>;

                        return (
                          <tr key={item.id}>
                            <td>{rankBadge}</td>
                            <td className="font-semibold text-ink-900">{item.studentName}</td>
                            <td className="font-mono text-ink-500 text-sm">#{item.membershipNo}</td>
                            <td className="text-ink-600 text-sm">{item.groupName}</td>
                            <td>
                              <span className={`pill ${item.totalPoints >= 0 ? 'pill-green' : 'pill-red'} font-bold`}>
                                {item.totalPoints} نقطة
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="lg:hidden divide-y divide-ink-200">
                  {filteredLeaderboard.map((item) => {
                    const rank = leaderboard.findIndex((x) => x.id === item.id) + 1;
                    let rankBadge;
                    if (rank === 1) rankBadge = <span className="w-6 h-6 rounded-full bg-amber-400 text-ink-900 border border-amber-500 font-bold text-xs flex items-center justify-center shadow-sm mx-auto" title="المركز الأول">١</span>;
                    else if (rank === 2) rankBadge = <span className="w-6 h-6 rounded-full bg-slate-300 text-ink-900 border border-slate-400 font-bold text-xs flex items-center justify-center shadow-sm mx-auto" title="المركز الثاني">٢</span>;
                    else if (rank === 3) rankBadge = <span className="w-6 h-6 rounded-full bg-amber-600 text-white border border-amber-700 font-bold text-xs flex items-center justify-center shadow-sm mx-auto" title="المركز الثالث">٣</span>;
                    else rankBadge = <span className="text-ink-400 font-mono text-xs">#{rank}</span>;

                    return (
                      <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-8 text-center">{rankBadge}</div>
                          <div className="min-w-0">
                            <div className="font-semibold text-ink-900 truncate">{item.studentName}</div>
                            <div className="text-xs text-ink-400 mt-0.5">العضوية: #{item.membershipNo} · الأسرة: {item.groupName}</div>
                          </div>
                        </div>
                        <span className={`pill shrink-0 ${item.totalPoints >= 0 ? 'pill-green' : 'pill-red'} font-bold`}>
                          {item.totalPoints} ن
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )
          ) : points.length === 0 ? (
            <p className="text-center py-10 text-ink-400 text-sm">لا توجد نقاط مرصودة بعد.</p>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto scroll-soft">
                <table className="tbl">
                  <thead>
                    <tr><th>الطالب</th><th>النقاط</th><th>التصنيف</th><th>السبب</th><th>بواسطة</th></tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{nameOf(p.registrationId)}</td>
                        <td>
                          <span className={`pill ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                            {p.delta >= 0 ? `+${p.delta}` : p.delta}
                          </span>
                        </td>
                        <td className="text-ink-500 text-sm">{catLabel(p.category)}</td>
                        <td className="text-ink-700 text-sm">{p.reason}</td>
                        <td className="text-ink-400 text-sm">{p.recordedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="lg:hidden divide-y divide-ink-200">
                {points.map((p) => (
                  <li key={p.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink-900 truncate">{nameOf(p.registrationId)}</div>
                      <div className="text-sm text-ink-700 mt-0.5">{p.reason}</div>
                      <div className="text-xs text-ink-400 mt-0.5">{catLabel(p.category)} · {p.recordedBy || '—'}</div>
                    </div>
                    <span className={`pill shrink-0 ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                      {p.delta >= 0 ? `+${p.delta}` : p.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
