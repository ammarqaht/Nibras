'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = {
  id: number; membershipNo: number; studentName: string;
  groupId: number | null; registrationStatus: string;
  paymentStatus: string; stage: string; grade: string;
};
type Group = { id: number; name: string; stage: string };
type Point = {
  id: number; registrationId: number; delta: number;
  reason: string; category: string; pointType: string;
  recordedBy: string | null; createdAt: string;
};

const STAGES = ['ابتدائي', 'متوسط', 'ثانوي'] as const;
type StageName = typeof STAGES[number];

const ADD_POINTS_ROLES = [
  'admin', 'cultural_supervisor', 'sports_supervisor',
  'scientific_supervisor', 'social_supervisor', 'stage_supervisor',
];

function calcSummary(pts: Point[]) {
  let individual = 0, collective = 0, deduction = 0;
  for (const p of pts) {
    const t = p.pointType ?? (
      p.reason.endsWith('(رصد جماعي للأسرة)') ? 'collective'
        : p.delta < 0 ? 'deduction' : 'individual'
    );
    if (t === 'individual') individual += p.delta;
    else if (t === 'collective') collective += p.delta;
    else deduction += p.delta;
  }
  const total = individual + collective;           // الاجمالي — basis for ranking
  const balance = Math.max(0, total + deduction);  // الرصيد — never below zero
  return { individual, collective, deduction, total, balance };
}

function RankBadge({ rank }: { rank: number }) {
  const base = 'w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow-sm';
  if (rank === 1) return <span className={`${base} bg-amber-400 text-ink-900 border border-amber-500`}>١</span>;
  if (rank === 2) return <span className={`${base} bg-slate-300 text-ink-900 border border-slate-400`}>٢</span>;
  if (rank === 3) return <span className={`${base} bg-amber-700 text-white border border-amber-800`}>٣</span>;
  return <span className="text-ink-400 font-mono text-xs">#{rank}</span>;
}

export default function PointsBoardPage() {
  const { user } = useSupervisor();
  const roles = user?.role ? user.role.split(',').map(r => r.trim()) : [];
  const canAddPoints = roles.some(r => ADD_POINTS_ROLES.includes(r));
  const canToggleVisibility = roles.some(r => ['admin', 'stage_supervisor'].includes(r));

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<StageName>('ابتدائي');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [logSearch, setLogSearch] = useState('');
  const [leaderSearch, setLeaderSearch] = useState('');
  const [pointsHidden, setPointsHidden] = useState(false);
  const [visBusy, setVisBusy] = useState(false);
  const [showVisModal, setShowVisModal] = useState(false);
  const [teaserMsg, setTeaserMsg] = useState('النقاط مخفية مؤقتاً… استمر في التميّز، وسيتم الكشف عنها قريباً! 🌟');

  useEffect(() => {
    if (!canToggleVisibility) return;
    fetch('/api/supervisor/points-visibility')
      .then(r => r.json())
      .then(d => {
        setPointsHidden(!!d.hidden);
        if (d.message) setTeaserMsg(d.message);
      })
      .catch(() => {});
  }, [canToggleVisibility]);

  async function togglePointsVisibility(hide: boolean, msg?: string) {
    setVisBusy(true);
    try {
      const r = await fetch('/api/supervisor/points-visibility', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: hide, message: msg }),
      });
      if (r.ok) {
        setPointsHidden(hide);
        if (msg) setTeaserMsg(msg);
      }
    } finally { setVisBusy(false); }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/supervisor/students?scope=all', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/points', { cache: 'no-store' }),
    ]).then(async ([sr, gr, pr]) => {
      const srj = await sr.json().catch(() => ({ students: [] }));
      const grj = await gr.json().catch(() => ({ groups: [] }));
      const prj = await pr.json().catch(() => ({ points: [] }));
      const allSt: Student[] = srj.students ?? [];
      setStudents(allSt.filter(s =>
        s.registrationStatus === 'approved' &&
        (s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' || s.paymentStatus === '')
      ));
      setGroups(grj.groups ?? []);
      setPoints(prj.points ?? []);
      setLoading(false);
    });
  }, []);

  const groupMap = useMemo(() => new Map(groups.map(g => [g.id, g.name])), [groups]);
  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const studentSummaries = useMemo(() => {
    const byStudent = new Map<number, Point[]>();
    for (const p of points) {
      if (!byStudent.has(p.registrationId)) byStudent.set(p.registrationId, []);
      byStudent.get(p.registrationId)!.push(p);
    }
    return students.map(s => {
      const pts = byStudent.get(s.id) ?? [];
      const { individual, collective, deduction, total, balance } = calcSummary(pts);
      return {
        ...s, individual, collective, deduction, total, balance,
        rankScore: total,
        groupName: s.groupId ? (groupMap.get(s.groupId) ?? '—') : '—',
      };
    });
  }, [students, points, groupMap]);

  const leaderboard = useMemo(() => {
    const q = leaderSearch.trim();
    return [...studentSummaries]
      .filter(s => s.stage === activeStage && (!q || s.studentName.includes(q)))
      .sort((a, b) => b.rankScore - a.rankScore);
  }, [studentSummaries, activeStage, leaderSearch]);

  const stageStudentIds = useMemo(
    () => new Set(students.filter(s => s.stage === activeStage).map(s => s.id)),
    [students, activeStage]
  );

  const stageLog = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return [...points]
      .filter(p => {
        if (!stageStudentIds.has(p.registrationId)) return false;
        if (!q) return true;
        const st = studentMap.get(p.registrationId);
        return st?.studentName.toLowerCase().includes(q) || String(st?.membershipNo).includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [points, stageStudentIds, logSearch, studentMap]);

  const toggleExpand = (id: number) => setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">لوحة النقاط</h1>
          <p className="text-sm text-ink-500">ترتيب الأوائل وسجل الرصد مقسم حسب المرحلة الدراسية.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canToggleVisibility && (
            <button onClick={() => {
              if (pointsHidden) {
                togglePointsVisibility(false);
              } else {
                setShowVisModal(true);
              }
            }} disabled={visBusy}
              className="btn btn-secondary flex items-center gap-1.5 text-sm"
              title="إخفاء/إظهار النقاط في حسابات الطلاب">
              {pointsHidden ? '👁️ إظهار النقاط' : '🙈 إخفاء النقاط'}
            </button>
          )}
          {canAddPoints && (
            <Link href="/supervisor/points/add" className="btn btn-primary flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              رصد النقاط
            </Link>
          )}
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2 mb-6">
        {STAGES.map(stage => (
          <button
            key={stage}
            type="button"
            onClick={() => { setActiveStage(stage); setLeaderSearch(''); setLogSearch(''); }}
            className={`choice py-1.5 px-4 text-sm font-medium ${activeStage === stage ? 'is-active' : ''}`}
          >
            {stage}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
      ) : (
        <div className="space-y-6">
          {/* Leaderboard */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-ink-900">ترتيب الأوائل</h2>
                <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">
                  {studentSummaries.filter(s => s.stage === activeStage).length} طالب
                </span>
              </div>
              <input
                type="text"
                placeholder="بحث عن طالب..."
                className="field py-1.5 px-3 text-xs sm:w-44"
                value={leaderSearch}
                onChange={e => setLeaderSearch(e.target.value)}
              />
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-center py-10 text-ink-400 text-sm">لا يوجد طلاب.</p>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto scroll-soft">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>الترتيب</th>
                        <th>الطالب</th>
                        <th>العضوية</th>
                        <th>الأسرة</th>
                        <th>فردية</th>
                        <th>جماعية</th>
                        <th>الرصيد</th>
                        <th>الاجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((item, idx) => (
                        <tr key={item.id}>
                          <td><RankBadge rank={idx + 1} /></td>
                          <td className="font-semibold text-ink-900">{item.studentName}</td>
                          <td className="font-mono text-ink-400 text-xs">#{item.membershipNo}</td>
                          <td className="text-ink-500 text-sm">{item.groupName}</td>
                          <td><span className="pill pill-green text-xs">{item.individual}</span></td>
                          <td><span className="pill pill-blue text-xs">{item.collective}</span></td>
                          <td>
                            <span className={`pill text-xs ${item.balance > 0 ? 'pill-green' : item.balance === 0 ? 'pill-gray' : 'pill-red'}`}>
                              {item.balance}
                            </span>
                          </td>
                          <td>
                            <span className={`pill font-bold text-xs ${item.total >= 0 ? 'pill-green' : 'pill-red'}`}>
                              {item.total}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <ul className="lg:hidden divide-y divide-ink-100">
                  {leaderboard.map((item, idx) => (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 flex items-center justify-center shrink-0">
                          <RankBadge rank={idx + 1} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-ink-900 truncate">{item.studentName}</div>
                          <div className="text-[11px] text-ink-400 mt-0.5">#{item.membershipNo} · {item.groupName}</div>
                        </div>
                        <div className="flex gap-3 text-left shrink-0">
                          <div>
                            <div className={`text-sm font-bold ${item.balance > 0 ? 'text-green-600' : item.balance === 0 ? 'text-ink-400' : 'text-red-600'}`}>
                              {item.balance}
                            </div>
                            <div className="text-[10px] text-ink-400 text-center">رصيد</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-green-600">{item.total}</div>
                            <div className="text-[10px] text-ink-400 text-center">اجمالي</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1.5 text-[11px] text-ink-500 pr-10">
                        <span>فردية: <span className="text-green-600 font-semibold">{item.individual}</span></span>
                        <span>جماعية: <span className="text-blue-700 font-semibold">{item.collective}</span></span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Log */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="font-bold text-ink-900">سجل الرصد</h2>
              <input
                type="text"
                placeholder="بحث باسم أو رقم عضوية..."
                className="field py-1.5 px-3 text-xs sm:w-48"
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
              />
            </div>

            {stageLog.length === 0 ? (
              <p className="text-center py-10 text-ink-400 text-sm">لا توجد سجلات.</p>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto scroll-soft">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>الطالب</th>
                        <th>العضوية</th>
                        <th>الأسرة</th>
                        <th>النقاط</th>
                        <th>النوع</th>
                        <th>السبب</th>
                        <th>بواسطة</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageLog.map(p => {
                        const st = studentMap.get(p.registrationId);
                        const typeLabel = p.delta < 0 ? (p.pointType === 'deduction' ? 'خصم متجر' : 'خصم نهائي') : (p.pointType === 'collective' ? 'جماعية' : 'فردية');
                        const typeCls = p.delta < 0 ? (p.pointType === 'deduction' ? 'pill-red bg-red-50 text-red-700 border-red-200' : 'pill-red') : (p.pointType === 'collective' ? 'pill-blue' : 'pill-green');
                        return (
                          <tr key={p.id}>
                            <td className="font-medium">{st?.studentName ?? `#${p.registrationId}`}</td>
                            <td className="font-mono text-xs text-ink-400">{st?.membershipNo ? `#${st.membershipNo}` : '—'}</td>
                            <td className="text-ink-500 text-sm">{st?.groupId ? (groupMap.get(st.groupId) ?? '—') : '—'}</td>
                            <td>
                              <span className={`pill text-xs ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                                {p.delta >= 0 ? `+${p.delta}` : p.delta}
                              </span>
                            </td>
                            <td><span className={`pill text-xs ${typeCls}`}>{typeLabel}</span></td>
                            <td className="text-ink-700 text-sm max-w-[180px] truncate">
                              {p.reason.replace(' (رصد جماعي للأسرة)', '')}
                            </td>
                            <td className="text-ink-400 text-sm">{p.recordedBy || '—'}</td>
                            <td className="text-ink-400 text-xs whitespace-nowrap">
                              {new Date(p.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <ul className="lg:hidden divide-y divide-ink-100">
                  {stageLog.map(p => {
                    const st = studentMap.get(p.registrationId);
                    const isExp = expandedIds.has(p.id);
                    const typeLabel = p.delta < 0 ? (p.pointType === 'deduction' ? 'خصم متجر' : 'خصم نهائي') : (p.pointType === 'collective' ? 'جماعية' : 'فردية');
                    return (
                      <li key={p.id} className="py-3 px-4">
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 text-right"
                          onClick={() => toggleExpand(p.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-ink-900 truncate">
                              {st?.studentName ?? `#${p.registrationId}`}
                            </div>
                            <div className="text-[11px] text-ink-400 mt-0.5">
                              #{st?.membershipNo} · {typeLabel}
                            </div>
                          </div>
                          <span
                            className={`pill shrink-0 text-xs py-1 px-2.5 ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`}
                            dir="ltr"
                          >
                            {p.delta >= 0 ? `+${p.delta}` : p.delta}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 shrink-0 text-ink-400 transition-transform ${isExp ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {isExp && (
                          <div className="mt-2 text-[11px] text-ink-500 space-y-0.5 pr-1 border-r-2 border-ink-100">
                            <div>الأسرة: {st?.groupId ? (groupMap.get(st.groupId) ?? '—') : '—'}</div>
                            <div>السبب: {p.reason.replace(' (رصد جماعي للأسرة)', '')}</div>
                            <div>
                              بواسطة: {p.recordedBy || '—'} ·{' '}
                              {new Date(p.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {showVisModal && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowVisModal(false)}>
          <div className="modal-panel w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}>
              <h3 className="font-bold text-base text-ink-900">حجب النقاط عن الطلاب</h3>
              <button onClick={() => setShowVisModal(false)} className="btn btn-ghost p-1" aria-label="إغلاق">✕</button>
            </div>
            <div className="space-y-3">
              <label className="label font-bold text-xs">الرسالة التشويقية والتحميسية للطلاب</label>
              <textarea
                className="field min-h-[100px] text-xs resize-none"
                placeholder="اكتب هنا الرسالة التي ستظهر للطلاب بدلاً من نقاطهم..."
                value={teaserMsg}
                onChange={e => setTeaserMsg(e.target.value)}
              />
              <p className="text-[10px] text-ink-400">سيتم تطبيق حجب النقاط مع هذه الرسالة التشويقية والبلور على جميع الطلاب فور الحفظ.</p>
            </div>
            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
              <button
                onClick={() => {
                  togglePointsVisibility(true, teaserMsg);
                  setShowVisModal(false);
                }}
                disabled={visBusy || !teaserMsg.trim()}
                className="btn btn-primary flex-1 text-xs text-white font-bold"
              >
                تفعيل الحجب التشويقي
              </button>
              <button onClick={() => setShowVisModal(false)} className="btn btn-secondary flex-1 text-xs font-semibold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
