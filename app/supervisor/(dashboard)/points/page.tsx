'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSupervisor } from '@/components/SupervisorShell';
import { pushToast } from '@/components/Toast';

type Student = {
  id: number; membershipNo: number; studentName: string;
  groupId: number | null; registrationStatus: string;
  paymentStatus: string; stage: string; grade: string;
};
type Group = { id: number; name: string; stage: string };
type Point = {
  id: number; registrationId: number; delta: number;
  reason: string; category: string; pointType: string;
  batchId?: string | null;
  recordedBy: string | null; createdAt: string;
};
type LogRow = {
  key: string; rec: Point; isGroup: boolean; count: number;
  groupName?: string; batchId?: string | null; createdAt: string;
};
type Cat = { key: string; label: string; fromIndividual?: boolean };

// Editable list of categories (add row / edit label / delete row) used inside
// the categories-management modal for each of the four buckets.
// When `withScopeToggle` is set (individual deduction categories only), each row
// also exposes a "خصم من الفردية" switch controlling whether a deduction using
// that category lowers the student's individual score as well as their balance.
function CategoryListEditor({
  title, tone, items, onChange, placeholder, keyPrefix, withScopeToggle,
}: {
  title: string; tone: 'add' | 'deduct'; items: Cat[];
  onChange: (next: Cat[]) => void; placeholder: string; keyPrefix: string;
  withScopeToggle?: boolean;
}) {
  const toneCls = tone === 'add' ? 'text-green-700' : 'text-red-700';
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h5 className={`font-semibold text-xs ${toneCls}`}>{title}</h5>
        <button
          type="button"
          onClick={() => onChange([...items, { key: `${keyPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: '' }])}
          className="btn btn-secondary py-1 px-2 text-[11px] flex items-center gap-1"
        >
          <span>➕ إضافة</span>
        </button>
      </div>
      <div className="space-y-2 border p-2.5 rounded-xl bg-cream-50/20 min-h-[70px] max-h-[240px] overflow-y-auto" style={{ borderColor: 'var(--line)' }}>
        {items.length === 0 ? (
          <p className="text-[11px] text-ink-400 text-center py-3">لا توجد تصنيفات، أضف تصنيفاً جديداً</p>
        ) : (
          items.map((cat, idx) => (
            <div key={cat.key} className="space-y-1.5 pb-1.5 border-b border-ink-50 last:border-0 last:pb-0">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="field text-xs py-2 px-3 flex-1"
                  placeholder={placeholder}
                  value={cat.label}
                  onChange={e => {
                    const copy = items.slice();
                    copy[idx] = { ...copy[idx], label: e.target.value };
                    onChange(copy);
                  }}
                />
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="حذف"
                >
                  🗑️
                </button>
              </div>
              {withScopeToggle && (
                <label className="flex items-center gap-2 cursor-pointer select-none pr-1">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-red-600"
                    checked={!!cat.fromIndividual}
                    onChange={e => {
                      const copy = items.slice();
                      copy[idx] = { ...copy[idx], fromIndividual: e.target.checked };
                      onChange(copy);
                    }}
                  />
                  <span className="text-[11px] text-ink-600">
                    الخصم من النقاط الفردية والرصيد
                    <span className="text-ink-400"> (غير مفعّل: من الرصيد فقط)</span>
                  </span>
                </label>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const STAGES = ['ابتدائي', 'متوسط', 'ثانوي'] as const;
type StageName = typeof STAGES[number];

const ADD_POINTS_ROLES = [
  'admin', 'cultural_supervisor', 'sports_supervisor',
  'scientific_supervisor', 'social_supervisor', 'stage_supervisor',
  'family_supervisor'
];

function calcSummary(pts: Point[]) {
  let individual = 0, collective = 0, deduction = 0;
  for (const p of pts) {
    // The record's pointType is authoritative: a negative 'individual' record is
    // a scoped deduction that lowers both the individual score and the balance.
    const t = p.pointType ?? (
      p.delta < 0 ? 'deduction'
        : p.reason.endsWith('(رصد جماعي للأسرة)') ? 'collective'
        : 'individual'
    );
    if (t === 'individual') individual += p.delta;
    else if (t === 'collective') collective += p.delta;
    else deduction += p.delta;
  }
  const total = individual + collective;           // الاجمالي
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
  const canAddPoints = roles.length > 0;
  const canDeletePoints = roles.includes('admin');
  const canToggleVisibility = roles.some(r => ['admin', 'stage_supervisor'].includes(r));

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<StageName>('ابتدائي');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [ledgerStudentId, setLedgerStudentId] = useState<number | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [visibleLogsCount, setVisibleLogsCount] = useState(10);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [pointsHidden, setPointsHidden] = useState(false);
  const [visBusy, setVisBusy] = useState(false);
  const [showVisModal, setShowVisModal] = useState(false);
  const [teaserMsg, setTeaserMsg] = useState('النقاط مخفية مؤقتاً… استمر في التميّز، وسيتم الكشف عنها قريباً! 🌟');
  const [teaserTitle, setTeaserTitle] = useState('النقاط مخفية مؤقتاً');
  const [mounted, setMounted] = useState(false);

  const [catsOpen, setCatsOpen] = useState(false);
  const [catsSaving, setCatsSaving] = useState(false);
  // Current saved categories, split by scope (student/group) and operation (add/deduct).
  const [studentAddCats, setStudentAddCats] = useState<Cat[]>([]);
  const [studentDeductCats, setStudentDeductCats] = useState<Cat[]>([]);
  const [groupAddCats, setGroupAddCats] = useState<Cat[]>([]);
  const [groupDeductCats, setGroupDeductCats] = useState<Cat[]>([]);
  // Draft copies edited inside the modal before saving.
  const [draftStudentAdd, setDraftStudentAdd] = useState<Cat[]>([]);
  const [draftStudentDeduct, setDraftStudentDeduct] = useState<Cat[]>([]);
  const [draftGroupAdd, setDraftGroupAdd] = useState<Cat[]>([]);
  const [draftGroupDeduct, setDraftGroupDeduct] = useState<Cat[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!canToggleVisibility) return;
    fetch('/api/supervisor/points-visibility')
      .then(r => r.json())
      .then(d => {
        setPointsHidden(!!d.hidden);
        if (d.message) setTeaserMsg(d.message);
        if (d.title) setTeaserTitle(d.title);
      })
      .catch(() => {});
  }, [canToggleVisibility]);

  async function togglePointsVisibility(hide: boolean, msg?: string, title?: string) {
    setVisBusy(true);
    try {
      const r = await fetch('/api/supervisor/points-visibility', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: hide, message: msg, title: title }),
      });
      if (r.ok) {
        setPointsHidden(hide);
        if (msg) setTeaserMsg(msg);
        if (title) setTeaserTitle(title);
      }
    } finally { setVisBusy(false); }
  }

  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  async function handleDeleteRow(row: LogRow) {
    const p = row.rec;
    const sign = p.delta >= 0 ? `+${p.delta}` : `${p.delta}`;
    const reasonText = p.reason.replace(' (رصد جماعي للأسرة)', '');
    const who = row.isGroup
      ? `المجموعة: ${row.groupName} (${row.count} طالب)`
      : `الطالب: ${students.find(s => s.id === p.registrationId)?.studentName ?? `#${p.registrationId}`}`;
    if (!confirm(
      `إلغاء هذه العملية نهائياً؟\n\n${who}\nالنقاط: ${sign}${row.isGroup ? ' لكل طالب' : ''}\nالسبب: ${reasonText}\n\nسيُحذف السجل ويُخصم من الاجمالي والرصيد معاً.`
    )) return;

    const url = row.isGroup && row.batchId
      ? `/api/supervisor/points?batchId=${encodeURIComponent(row.batchId)}`
      : `/api/supervisor/points?id=${p.id}`;

    setDeletingKey(row.key);
    try {
      const r = await fetch(url, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setPoints(prev =>
          row.isGroup && row.batchId
            ? prev.filter(x => x.batchId !== row.batchId)
            : prev.filter(x => x.id !== p.id)
        );
        pushToast('success', 'تم إلغاء العملية وحذف النقاط');
      } else {
        pushToast('error', d.error || 'تعذّر حذف السجل');
      }
    } catch {
      pushToast('error', 'حدث خطأ أثناء حذف السجل');
    } finally {
      setDeletingKey(null);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/supervisor/students?scope=all', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/points', { cache: 'no-store' }),
      fetch('/api/supervisor/points-categories', { cache: 'no-store' }),
    ]).then(async ([sr, gr, pr, cr]) => {
      const srj = await sr.json().catch(() => ({ students: [] }));
      const grj = await gr.json().catch(() => ({ groups: [] }));
      const prj = await pr.json().catch(() => ({ points: [] }));
      const crj = await cr.json().catch(() => ({}));
      if (Array.isArray(crj.studentAddCategories)) setStudentAddCats(crj.studentAddCategories);
      if (Array.isArray(crj.studentDeductCategories)) setStudentDeductCats(crj.studentDeductCategories);
      if (Array.isArray(crj.groupAddCategories)) setGroupAddCats(crj.groupAddCategories);
      if (Array.isArray(crj.groupDeductCategories)) setGroupDeductCats(crj.groupDeductCategories);
      const allSt: Student[] = srj.students ?? [];
      setStudents(allSt.filter(s =>
        (s.registrationStatus === 'approved' || s.paymentStatus === 'exempted') &&
        (s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' || s.paymentStatus === '')
      ));
      setGroups(grj.groups ?? []);
      const allPoints: Point[] = prj.points ?? [];
      setPoints(allPoints);
      setLoading(false);
    });
  }, []);

  const groupMap = useMemo(() => new Map(groups.map(g => [g.id, g.name])), [groups]);
  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  // key → Arabic label across all four category buckets, for the log/ledger.
  const catLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of [...studentAddCats, ...studentDeductCats, ...groupAddCats, ...groupDeductCats]) {
      if (c.key && c.label) m.set(c.key, c.label);
    }
    return m;
  }, [studentAddCats, studentDeductCats, groupAddCats, groupDeductCats]);

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
        // ترتيب الأوائل حسب النقاط الفردية فقط.
        rankScore: individual,
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

  // A single displayed log line. Group/collective registrations that share a
  // batchId are collapsed into one row shown by the group name.
  const stageLog = useMemo<LogRow[]>(() => {
    const inStage = points.filter(p => stageStudentIds.has(p.registrationId));

    // Collapse records that share a batchId into one group row.
    const batches = new Map<string, Point[]>();
    const singles: Point[] = [];
    for (const p of inStage) {
      if (p.batchId) {
        if (!batches.has(p.batchId)) batches.set(p.batchId, []);
        batches.get(p.batchId)!.push(p);
      } else {
        singles.push(p);
      }
    }

    const rows: LogRow[] = [];
    for (const p of singles) {
      rows.push({ key: `p${p.id}`, rec: p, isGroup: false, count: 1, createdAt: p.createdAt });
    }
    for (const [batchId, recs] of batches) {
      const rep = recs[0];
      const st = studentMap.get(rep.registrationId);
      const groupName = st?.groupId ? (groupMap.get(st.groupId) ?? 'مجموعة') : 'مجموعة';
      rows.push({
        key: `b${batchId}`, rec: rep, isGroup: true, count: recs.length,
        groupName, batchId, createdAt: rep.createdAt,
      });
    }

    const q = logSearch.trim().toLowerCase();
    return rows
      .filter(r => {
        if (!q) return true;
        if (r.isGroup) return (r.groupName ?? '').toLowerCase().includes(q);
        const st = studentMap.get(r.rec.registrationId);
        return st?.studentName.toLowerCase().includes(q) || String(st?.membershipNo).includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [points, stageStudentIds, logSearch, studentMap, groupMap]);

  const visibleLogs = useMemo(() => {
    return stageLog.slice(0, visibleLogsCount);
  }, [stageLog, visibleLogsCount]);

  const toggleExpand = (id: number) => setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3.5 border-b border-ink-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">لوحة النقاط</h1>
          <p className="text-sm text-ink-500">ترتيب الأوائل وسجل الرصد مقسم حسب المرحلة الدراسية.</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-ink-200/80 p-1 rounded-xl shadow-sm overflow-x-auto scroll-soft w-full md:w-auto shrink-0 select-none">
          {canAddPoints && (
            <Link href="/supervisor/points/add" className="btn btn-primary text-xs md:text-sm py-1.5 px-3 flex items-center gap-1.5 shrink-0 rounded-lg shadow-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              <span>رصد النقاط</span>
            </Link>
          )}
          {canToggleVisibility && (
            <button onClick={() => {
              if (pointsHidden) {
                togglePointsVisibility(false);
              } else {
                setShowVisModal(true);
              }
            }} disabled={visBusy}
              className="btn btn-ghost text-xs md:text-sm py-1.5 px-2.5 flex items-center gap-1.5 shrink-0 text-ink-700"
              title="إخفاء/إظهار النقاط في حسابات الطلاب">
              <span>{pointsHidden ? '👁️ إظهار النقاط' : '🙈 إخفاء النقاط'}</span>
            </button>
          )}
          {roles.includes('admin') && (
            <button onClick={() => {
              setDraftStudentAdd([...studentAddCats]);
              setDraftStudentDeduct([...studentDeductCats]);
              setDraftGroupAdd([...groupAddCats]);
              setDraftGroupDeduct([...groupDeductCats]);
              setCatsOpen(true);
            }} className="btn btn-ghost text-xs md:text-sm py-1.5 px-2.5 flex items-center gap-1.5 shrink-0 text-ink-700"
              title="تعديل تصنيفات النقاط الفردية والجماعية">
              <span>⚙️ تعديل التصنيفات</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2 mb-6">
        {STAGES.map(stage => (
          <button
            key={stage}
            type="button"
            onClick={() => { setActiveStage(stage); setLeaderSearch(''); setLogSearch(''); setVisibleLogsCount(10); }}
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
                        <tr
                          key={item.id}
                          onClick={() => setLedgerStudentId(item.id)}
                          className="cursor-pointer hover:bg-cream-50/60 transition-colors"
                          title="عرض سجل رصيد الطالب"
                        >
                          <td><RankBadge rank={idx + 1} /></td>
                          <td className="font-semibold text-ink-900 underline decoration-dotted decoration-ink-300 underline-offset-4">{item.studentName}</td>
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
                    <li
                      key={item.id}
                      className="px-4 py-3 cursor-pointer active:bg-cream-50/60"
                      onClick={() => setLedgerStudentId(item.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 flex items-center justify-center shrink-0">
                          <RankBadge rank={idx + 1} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-ink-900 truncate underline decoration-dotted decoration-ink-300 underline-offset-4">{item.studentName}</div>
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
                onChange={e => { setLogSearch(e.target.value); setVisibleLogsCount(10); }}
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
                        {canDeletePoints && <th className="text-center">إجراء</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLogs.map(row => {
                        const p = row.rec;
                        const st = studentMap.get(p.registrationId);
                        const typeLabel = p.delta < 0 ? (p.pointType === 'deduction' ? 'خصم من الرصيد' : 'خصم من الفردية') : (p.pointType === 'collective' ? 'جماعية' : 'فردية');
                        const typeCls = p.delta < 0 ? (p.pointType === 'deduction' ? 'pill-red bg-red-50 text-red-700 border-red-200' : 'pill-red') : (p.pointType === 'collective' ? 'pill-blue' : 'pill-green');
                        return (
                          <tr key={row.key}>
                            <td className="font-medium">
                              {row.isGroup
                                ? <span>{row.groupName} <span className="text-[10px] text-ink-400">({row.count} طالب)</span></span>
                                : (st?.studentName ?? `#${p.registrationId}`)}
                            </td>
                            <td className="font-mono text-xs text-ink-400">{row.isGroup ? '—' : (st?.membershipNo ? `#${st.membershipNo}` : '—')}</td>
                            <td className="text-ink-500 text-sm">{row.isGroup ? row.groupName : (st?.groupId ? (groupMap.get(st.groupId) ?? '—') : '—')}</td>
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
                              {mounted
                                ? new Date(p.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                : p.createdAt.split('T')[0]}
                            </td>
                            {canDeletePoints && (
                              <td className="text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(row)}
                                  disabled={deletingKey === row.key}
                                  title="إلغاء العملية وحذف النقاط"
                                  className="text-red-600 hover:text-red-700 disabled:opacity-40 text-xs font-semibold cursor-pointer"
                                >
                                  {deletingKey === row.key ? '...' : 'إلغاء'}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <ul className="lg:hidden divide-y divide-ink-100">
                  {visibleLogs.map(row => {
                    const p = row.rec;
                    const st = studentMap.get(p.registrationId);
                    const isExp = expandedIds.has(p.id);
                    const typeLabel = p.delta < 0 ? (p.pointType === 'deduction' ? 'خصم من الرصيد' : 'خصم من الفردية') : (p.pointType === 'collective' ? 'جماعية' : 'فردية');
                    return (
                      <li key={row.key} className="py-3 px-4">
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 text-right"
                          onClick={() => toggleExpand(p.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-ink-900 truncate">
                              {row.isGroup ? row.groupName : (st?.studentName ?? `#${p.registrationId}`)}
                            </div>
                            <div className="text-[11px] text-ink-400 mt-0.5">
                              {row.isGroup ? `${row.count} طالب` : `#${st?.membershipNo}`} · {typeLabel}
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
                            <div>الأسرة: {row.isGroup ? row.groupName : (st?.groupId ? (groupMap.get(st.groupId) ?? '—') : '—')}</div>
                            {row.isGroup && <div>النقاط: {p.delta >= 0 ? `+${p.delta}` : p.delta} لكل طالب</div>}
                            <div>السبب: {p.reason.replace(' (رصد جماعي للأسرة)', '')}</div>
                            <div>
                              بواسطة: {p.recordedBy || '—'} ·{' '}
                              {mounted
                                ? new Date(p.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                : p.createdAt.split('T')[0]}
                            </div>
                            {canDeletePoints && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(row)}
                                  disabled={deletingKey === row.key}
                                  className="text-red-600 hover:text-red-700 disabled:opacity-40 text-[11px] font-semibold cursor-pointer"
                                >
                                  {deletingKey === row.key ? 'جارٍ الحذف…' : 'إلغاء العملية وحذف النقاط'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {stageLog.length > visibleLogsCount && (
                  <div className="p-4 text-center border-t border-ink-100 bg-ink-50/50">
                    <button
                      type="button"
                      onClick={() => setVisibleLogsCount(prev => prev + 10)}
                      className="btn btn-secondary text-sm px-6 font-bold cursor-pointer"
                    >
                      عرض المزيد
                    </button>
                  </div>
                )}
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
              <div>
                <label className="label font-bold text-xs mb-1 block">عنوان الحجب</label>
                <input
                  type="text"
                  className="field text-xs py-2 px-3 w-full"
                  placeholder="مثال: النقاط مخفية مؤقتاً"
                  value={teaserTitle}
                  onChange={e => setTeaserTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label font-bold text-xs mb-1 block">الرسالة التشويقية والتحميسية للطلاب</label>
                <textarea
                  className="field min-h-[100px] text-xs resize-none"
                  placeholder="اكتب هنا الرسالة التي ستظهر للطلاب بدلاً من نقاطهم..."
                  value={teaserMsg}
                  onChange={e => setTeaserMsg(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-ink-400">سيتم تطبيق حجب النقاط مع هذا العنوان والرسالة والبلور على جميع الطلاب فور الحفظ.</p>
            </div>
            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
              <button
                onClick={() => {
                  togglePointsVisibility(true, teaserMsg, teaserTitle);
                  setShowVisModal(false);
                }}
                disabled={visBusy || !teaserMsg.trim() || !teaserTitle.trim()}
                className="btn btn-primary flex-1 text-xs text-white font-bold"
              >
                تفعيل الحجب التشويقي
              </button>
              <button onClick={() => setShowVisModal(false)} className="btn btn-secondary flex-1 text-xs font-semibold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {catsOpen && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setCatsOpen(false)}>
          <div className="modal-panel w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}>
              <h3 className="font-bold text-base text-ink-900">تعديل تصنيفات النقاط</h3>
              <button onClick={() => setCatsOpen(false)} className="btn btn-ghost p-1" aria-label="إغلاق">✕</button>
            </div>
            
            <p className="text-xs text-ink-500 -mt-1">
              تُستخدم هذه التصنيفات في صفحة رصد النقاط حسب اختيار المشرف: نوع النقاط (فردية / جماعية) وطبيعة العملية (إضافة / خصم).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Individual point categories */}
              <div className="space-y-3 border rounded-xl p-3.5" style={{ borderColor: 'var(--line)' }}>
                <h4 className="font-bold text-sm text-ink-800 flex items-center gap-1.5">
                  <span className="pill pill-green text-[10px]">فردية</span> تصنيفات النقاط الفردية
                </h4>
                <CategoryListEditor
                  title="تصنيفات الإضافة"
                  tone="add"
                  items={draftStudentAdd}
                  onChange={setDraftStudentAdd}
                  placeholder="اسم التصنيف (مثال: مشاركة)"
                  keyPrefix="cat_ind_add"
                />
                <CategoryListEditor
                  title="تصنيفات الخصم"
                  tone="deduct"
                  items={draftStudentDeduct}
                  onChange={setDraftStudentDeduct}
                  placeholder="اسم التصنيف (مثال: متجر)"
                  keyPrefix="cat_ind_ded"
                  withScopeToggle
                />
              </div>

              {/* Collective point categories */}
              <div className="space-y-3 border rounded-xl p-3.5" style={{ borderColor: 'var(--line)' }}>
                <h4 className="font-bold text-sm text-ink-800 flex items-center gap-1.5">
                  <span className="pill pill-blue text-[10px]">جماعية</span> تصنيفات النقاط الجماعية
                </h4>
                <CategoryListEditor
                  title="تصنيفات الإضافة"
                  tone="add"
                  items={draftGroupAdd}
                  onChange={setDraftGroupAdd}
                  placeholder="اسم التصنيف (مثال: مسابقة)"
                  keyPrefix="cat_grp_add"
                />
                <CategoryListEditor
                  title="تصنيفات الخصم"
                  tone="deduct"
                  items={draftGroupDeduct}
                  onChange={setDraftGroupDeduct}
                  placeholder="اسم التصنيف (مثال: مخالفة)"
                  keyPrefix="cat_grp_ded"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-3 border-t justify-end" style={{ borderColor: 'var(--line)' }}>
              <button
                type="button"
                onClick={async () => {
                  setCatsSaving(true);
                  const clean = (arr: Cat[]) => arr.filter(c => c.label.trim());
                  const sAdd = clean(draftStudentAdd), sDed = clean(draftStudentDeduct);
                  const gAdd = clean(draftGroupAdd), gDed = clean(draftGroupDeduct);
                  try {
                    const r = await fetch('/api/supervisor/points-categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        studentAddCategories: sAdd,
                        studentDeductCategories: sDed,
                        groupAddCategories: gAdd,
                        groupDeductCategories: gDed,
                      })
                    });
                    if (r.ok) {
                      setStudentAddCats(sAdd);
                      setStudentDeductCats(sDed);
                      setGroupAddCats(gAdd);
                      setGroupDeductCats(gDed);
                      pushToast('success', 'تم حفظ تصنيفات النقاط بنجاح');
                      setCatsOpen(false);
                    } else {
                      pushToast('error', 'فشل حفظ التصنيفات');
                    }
                  } catch (e) {
                    pushToast('error', 'حدث خطأ غير متوقع');
                  } finally {
                    setCatsSaving(false);
                  }
                }}
                disabled={catsSaving}
                className="btn btn-primary text-xs text-white font-bold px-6 py-2"
              >
                {catsSaving ? 'جارٍ الحفظ...' : 'حفظ التصنيفات'}
              </button>
              <button
                type="button"
                onClick={() => setCatsOpen(false)}
                className="btn btn-secondary text-xs font-semibold px-6 py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-student balance ledger (opened by clicking a name in the leaderboard) */}
      {ledgerStudentId !== null && (() => {
        const st = studentMap.get(ledgerStudentId);
        const recs = points
          .filter(p => p.registrationId === ledgerStudentId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const sum = calcSummary(recs);
        return (
          <div className="modal-backdrop flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setLedgerStudentId(null)}>
            <div className="modal-panel w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--line)' }}>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-ink-900 truncate">سجل رصيد الطالب</h3>
                  <p className="text-xs text-ink-500 truncate">
                    {st?.studentName ?? `#${ledgerStudentId}`}
                    {st?.membershipNo ? <span className="font-mono"> · #{st.membershipNo}</span> : null}
                    {st?.groupId ? ` · ${groupMap.get(st.groupId) ?? '—'}` : ''}
                  </p>
                </div>
                <button onClick={() => setLedgerStudentId(null)} className="btn btn-ghost p-1 shrink-0" aria-label="إغلاق">✕</button>
              </div>

              <div className="grid grid-cols-4 gap-2 p-3 border-b" style={{ borderColor: 'var(--line)' }}>
                {[
                  { label: 'فردية', val: sum.individual, cls: 'text-green-700' },
                  { label: 'جماعية', val: sum.collective, cls: 'text-blue-700' },
                  { label: 'الرصيد', val: sum.balance, cls: 'text-emerald-700' },
                  { label: 'الاجمالي', val: sum.total, cls: 'text-ink-900' },
                ].map(x => (
                  <div key={x.label} className="text-center bg-cream-50/40 rounded-lg py-2">
                    <div className={`text-lg font-bold tabular-nums ${x.cls}`} dir="ltr">{x.val}</div>
                    <div className="text-[10px] text-ink-400">{x.label}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-y-auto scroll-soft flex-1">
                {recs.length === 0 ? (
                  <p className="text-center py-10 text-ink-400 text-sm">لا توجد حركات على رصيد هذا الطالب.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {recs.map(p => {
                      const typeLabel = p.delta < 0
                        ? (p.pointType === 'deduction' ? 'خصم من الرصيد' : 'خصم من الفردية')
                        : (p.pointType === 'collective' ? 'جماعية' : 'فردية');
                      const typeCls = p.delta < 0
                        ? 'pill-red'
                        : (p.pointType === 'collective' ? 'pill-blue' : 'pill-green');
                      return (
                        <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className={`pill text-xs shrink-0 ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                            {p.delta >= 0 ? `+${p.delta}` : p.delta}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink-800 truncate">{p.reason.replace(' (رصد جماعي للأسرة)', '')}</p>
                            <p className="text-[11px] text-ink-400 mt-0.5">
                              {catLabelMap.get(p.category) || p.category}
                              {' · '}
                              <span className="whitespace-nowrap">
                                {mounted
                                  ? new Date(p.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                  : p.createdAt.split('T')[0]}
                              </span>
                              {p.recordedBy ? ` · ${p.recordedBy}` : ''}
                            </p>
                          </div>
                          <span className={`pill text-[10px] shrink-0 ${typeCls}`}>{typeLabel}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
