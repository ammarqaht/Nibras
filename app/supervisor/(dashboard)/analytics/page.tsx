'use client';

import { useEffect, useRef, useState } from 'react';
import { useSupervisor } from '@/components/SupervisorShell';

// ─── types ────────────────────────────────────────────────────────────────────
type DayRow  = { date: string; label: string; present: number; absent: number; late: number; rate: number };
type Student = { id: number; name: string; stage: string; grade: string; membershipNo: number };
type Analytics = {
  updatedAt: string;
  registration: {
    total: number; approved: number; pending: number; rejected: number;
    paid: number; exempted: number; pendingPayment: number; unpaid: number;
    withCondition: number; unassigned: number;
    byStage: Record<string, { total: number; grades: Record<string, number> }>;
    topNeighborhoods: { name: string; count: number }[];
    conditionList: (Student & { condition: string })[];
  };
  finance: {
    fee: number; studentRevenue: number; otherRevenueTotal: number;
    otherRevenueList: { title: string; amount: number; date: string }[];
    totalRevenue: number; invoiceTotalSpent: number; generalExpenseTotal: number;
    totalExpenses: number; netBalance: number;
    byDepartment: { key: string; label: string; total: number; count: number }[];
    byCategory:   { key: string; label: string; total: number; count: number }[];
    pendingInvoicesCount: number;
  };
  attendance: {
    today: DayRow; last14Overall: DayRow[];
    last14ByStage: Record<string, DayRow[]>;
    stageAvg7: { stage: string; avg: number }[];
    consecutiveAbsentStudents: (Student & { maxStreak: number; lastStreak: string })[];
  };
  studentPoints: {
    totalPoints: number;
    top5PerStage: Record<string, (Student & { points: number })[]>;
    stagePointsAvg: { stage: string; avg: number; total: number }[];
    top5MostPresent: (Student & { presentDays: number })[];
  };
  groups: {
    total: number;
    byStage: Record<string, { id: number; name: string; stage: string; studentCount: number; points: number }[]>;
  };
  tasks: {
    total: number; active: number; expired: number;
    submissions: { total: number; pending: number; approved: number; rejected: number };
    top5Submitters: (Student & { submissionCount: number })[];
    taskStats: { id: string; title: string; track: string; total: number; approved: number; completionRate: number }[];
  };
  schedule: {
    total: number; thisWeek: number;
    byCommittee: { label: string; count: number }[];
    byWeek:      { label: string; count: number }[];
  };
};

// ─── constants ────────────────────────────────────────────────────────────────
const SAR = (n: number) => n.toLocaleString('ar-SA') + ' ر.س';
const PCT = (n: number) => `${n}%`;
const STAGES = ['ابتدائي', 'متوسط', 'ثانوي'] as const;
const STAGE_COLOR: Record<string, string> = { 'ابتدائي': '#12B3D5', 'متوسط': '#103F91', 'ثانوي': '#E52E25' };

// ─── primitives ───────────────────────────────────────────────────────────────
function Bar({ value, max, color, h = 6 }: { value: number; max: number; color: string; h?: number }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full overflow-hidden" style={{ height: h }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }} />
    </div>
  );
}
function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-sm text-gray-600 text-right" style={{ width: 130 }}>{label}</span>
      <Bar value={value} max={total} color={color} />
      <span className="w-8 text-sm font-bold text-gray-800 text-left shrink-0">{value}</span>
      <span className="w-9 text-xs text-gray-400 text-left shrink-0">{total > 0 ? Math.round(value / total * 100) : 0}%</span>
    </div>
  );
}
function Ring({ value, total, color, size = 72 }: { value: number; total: number; color: string; size?: number }) {
  const r = size * 0.38, circ = 2 * Math.PI * r;
  const pct = total > 0 ? value / total : 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0ef" strokeWidth={size*0.1} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.1}
        strokeDasharray={`${pct*circ} ${circ}`} strokeDashoffset={circ*0.25} strokeLinecap="round" />
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize={size*0.18} fontWeight="700" fill="#1A1A1A">{Math.round(pct*100)}%</text>
    </svg>
  );
}
function Kpi({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center">
      <div className="rounded-xl w-11 h-11 flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: color+'22' }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}
function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span className="text-2xl">{emoji}</span>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>{children}</div>;
}
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 shrink-0 text-right" style={{ width: 90 }}>{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.round((value/max)*100) : 0}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-6 text-left shrink-0">{value}</span>
    </div>
  );
}
function MedalBadge({ rank }: { rank: number }) {
  const cls = rank===1 ? 'bg-yellow-400 text-yellow-900' : rank===2 ? 'bg-gray-300 text-gray-700' : rank===3 ? 'bg-amber-600 text-amber-100' : 'bg-gray-100 text-gray-500';
  return <span className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${cls}`}>{rank}</span>;
}
function StageTabs({ active, onChange }: { active: string; onChange: (s: string) => void }) {
  return (
    <div className="flex gap-1 mb-4">
      {STAGES.map(s => (
        <button key={s} onClick={() => onChange(s)}
          className="flex-1 py-1.5 rounded-xl text-sm font-medium transition"
          style={active === s ? { backgroundColor: STAGE_COLOR[s], color: '#fff' } : { backgroundColor: '#f5f5f3', color: '#555' }}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Arabic day name ──────────────────────────────────────────────────────────
function getDayName(dateStr: string) {
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  return days[new Date(dateStr).getDay()];
}

// ─── Grouped attendance bar chart — 7 days, 3 bars per day ───────────────────
function GroupedAttendanceBars({
  overall, byStage,
}: {
  overall: DayRow[];
  byStage: Record<string, DayRow[]>;
}) {
  // use last 7 days only
  const last7Overall   = overall.slice(-7);
  const last7ByStage   = Object.fromEntries(
    Object.entries(byStage).map(([k, v]) => [k, v.slice(-7)])
  ) as Record<string, DayRow[]>;

  const maxVal = Math.max(
    ...last7Overall.map(d => d.present + d.absent),
    1
  );
  const chartH = 110;

  return (
    <div className="w-full" style={{ direction: 'ltr' }}>
      <div className="flex items-end gap-2">
        {last7Overall.map((day, di) => {
          const isToday = di === last7Overall.length - 1;
          const totalPresent = day.present;
          const stageRows = STAGES.map(s => last7ByStage[s]?.[di] ?? { present: 0, absent: 0 });

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center group relative">
              {/* total label */}
              <span className="mb-1 font-semibold" style={{ fontSize: 11, color: isToday ? '#103F91' : '#bbb', minHeight: 14, display:'block', textAlign:'center' }}>
                {totalPresent > 0 ? totalPresent : ''}
              </span>
              {/* tooltip */}
              <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20 text-center" style={{ direction:'rtl' }}>
                <div className="font-semibold mb-0.5">{getDayName(day.date)} — {day.label}</div>
                <div>حاضر {totalPresent} · غائب {day.absent}</div>
                {STAGES.map((s, si) => (
                  <div key={s} style={{ color: STAGE_COLOR[s] }}>{s}: {stageRows[si].present}</div>
                ))}
              </div>
              {/* 3 bars */}
              <div className="w-full flex items-end gap-0.5" style={{ height: chartH }}>
                {STAGES.map((stage, si) => {
                  const r = stageRows[si];
                  const h = r.present > 0 ? Math.max(Math.round((r.present / maxVal) * chartH), 4) : 0;
                  return (
                    <div key={stage} className="flex-1 rounded-t transition-all duration-500"
                      style={{ height: h, backgroundColor: isToday ? STAGE_COLOR[stage] : STAGE_COLOR[stage]+'88', alignSelf:'flex-end' }} />
                  );
                })}
              </div>
              {/* day name */}
              <span className="mt-1.5 block text-center w-full font-medium" style={{ fontSize: 10, color: isToday ? '#103F91' : '#999', fontWeight: isToday ? 700 : 500 }}>
                {getDayName(day.date)}
              </span>
              {/* date */}
              <span className="block text-center w-full" style={{ fontSize: 9, color: '#bbb' }}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SVG simple bar chart ─────────────────────────────────────────────────────
function BarChart({ data, color='#FF9F1C', height=90 }: { data:{label:string;count:number}[]; color?:string; height?:number }) {
  if (!data.length) return <p className="text-sm text-gray-400 py-4 text-center">لا توجد بيانات</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  const bw = 100 / data.length;
  return (
    <div style={{ direction:'ltr' }}>
      <svg viewBox={`0 0 100 ${height+22}`} className="w-full">
        {data.map((d, i) => {
          const bh = d.count > 0 ? Math.max((d.count/max)*height, 2) : 0;
          const x = i*bw + bw*0.15, w = bw*0.7, y = height - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={bh} rx="2" fill={color} opacity={0.85} />
              {d.count > 0 && <text x={x+w/2} y={y-2} textAnchor="middle" fontSize="4.5" fill="#555">{d.count}</text>}
              <text x={x+w/2} y={height+10} textAnchor="middle" fontSize="4" fill="#888" style={{ fontFamily:'Thmanyah Sans, sans-serif' }}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key==='Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────
const ALL_TABS = [
  { id:'registration', label:'التسجيل',   icon:'📋' },
  { id:'finance',      label:'المالية',    icon:'💰' },
  { id:'attendance',   label:'الحضور',    icon:'✅' },
  { id:'points',       label:'النقاط',    icon:'⭐' },
  { id:'groups',       label:'المجموعات', icon:'👥' },
  { id:'tasks',        label:'المهام',    icon:'📌' },
  { id:'schedule',     label:'البرامج',   icon:'📅' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user } = useSupervisor();
  const [data, setData]         = useState<Analytics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [refreshed, setRefreshed] = useState('');
  const [modal, setModal]       = useState<null|'conditions'|'consecutive'>(null);

  // per-section stage tabs
  const [ptStage,  setPtStage]  = useState<string>('ابتدائي');
  const [grpStage, setGrpStage] = useState<string>('ابتدائي');

  const sectionRefs = useRef<Record<string, HTMLElement|null>>({});

  // Role-based section visibility
  const roles = user?.role ? user.role.split(',').map(r => r.trim()) : [];
  const isPrivileged = roles.some(r => ['admin','general_supervisor','administrative_supervisor','finance','finance_supervisor'].includes(r));
  const canSeeFinance = roles.some(r =>
    ['admin','finance','finance_supervisor','administrative_supervisor'].includes(r)
  );

  const TABS = ALL_TABS.filter(t => {
    if (t.id === 'finance') return canSeeFinance;
    return true;
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/supervisor/analytics');
      if (res.ok) { setData(await res.json()); setRefreshed(new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})); }
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Set default tab to first visible tab once user is known
  useEffect(() => {
    if (user && TABS.length > 0 && !activeTab) setActiveTab(TABS[0].id);
  }, [user]);

  function scrollTo(id: string) {
    setActiveTab(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  if (loading || !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#FF9F1C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { registration:reg, finance:fin, attendance:att, studentPoints:pts, groups, tasks, schedule } = data;

  return (
    <div className="space-y-0 pb-20" dir="rtl">

      {/* ── sticky header + tab bar ── */}
      <div className="sticky top-0 z-30 bg-[#FAFAF7] pb-3 pt-1">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">الإحصائيات والتحليلات</h1>
            <p className="text-xs text-gray-400">آخر تحديث: {refreshed}</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 shadow-sm transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.93-3.36M20 15a9 9 0 01-14.93 3.36" /></svg>
            تحديث
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => scrollTo(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition font-medium ${activeTab===t.id ? 'bg-[#103F91] text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8 pt-4">

        {/* ══════════════════════════════════════════════════════════
            1. التسجيل
        ══════════════════════════════════════════════════════════ */}
        <section ref={el => { sectionRefs.current['registration'] = el; }}>
          <SectionTitle emoji="📋" title="إحصائيات التسجيل" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi label="إجمالي المسجّلين" value={reg.total} color="#103F91" icon="🎓" />
            <Kpi label="المقبولون" value={reg.approved} sub={`${reg.pending} قيد المراجعة`} color="#22c55e" icon="✅" />
            {isPrivileged && <Kpi label="الدفع المكتمل" value={reg.paid} sub={`${reg.exempted} معفى`} color="#FF9F1C" icon="💳" />}
            <Kpi label="بحالات صحية" value={reg.withCondition} sub={reg.withCondition>0 ? 'اضغط للتفاصيل' : undefined} color="#E52E25" icon="🏥" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">حالة التسجيل</p>
              <div className="space-y-3">
                <StatRow label="مقبولون"        value={reg.approved}       total={reg.total} color="#22c55e" />
                <StatRow label="قيد المراجعة"   value={reg.pending}        total={reg.total} color="#FF9F1C" />
                <StatRow label="مرفوضون"        value={reg.rejected}       total={reg.total} color="#E52E25" />
              </div>
            </Card>

            <Card>
              {isPrivileged && (
                <>
                  <p className="text-sm font-semibold text-gray-700 mb-3">حالة الدفع</p>
                  <div className="space-y-3 mb-4">
                    <StatRow label="مدفوع"            value={reg.paid}           total={reg.total} color="#22c55e" />
                    <StatRow label="معفى"             value={reg.exempted}       total={reg.total} color="#12B3D5" />
                    <StatRow label="بانتظار المراجعة" value={reg.pendingPayment} total={reg.total} color="#FF9F1C" />
                    <StatRow label="لم يدفع"          value={reg.unpaid}         total={reg.total} color="#E52E25" />
                  </div>
                </>
              )}
              <button onClick={() => setModal('conditions')} className="w-full rounded-xl p-3 text-center transition hover:opacity-80" style={{ backgroundColor:'#E52E2511' }}>
                <p className="text-lg font-bold text-red-600">{reg.withCondition}</p>
                <p className="text-xs text-red-400">حالات صحية — اضغط للتفاصيل ←</p>
              </button>
            </Card>

            {isPrivileged && (
              <Card>
                <p className="text-sm font-semibold text-gray-700 mb-3">أبرز الأحياء</p>
                <div className="space-y-2">
                  {reg.topNeighborhoods.map(n => (
                    <MiniBar key={n.name} label={n.name} value={n.count} max={reg.topNeighborhoods[0]?.count||1} color="#12B3D5" />
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* توزيع المراحل */}
          <Card className="mt-4">
            <p className="text-sm font-semibold text-gray-700 mb-4">تفاصيل المراحل الدراسية</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STAGES.map(stage => {
                const info = reg.byStage[stage] || { total:0, grades:{} };
                const color = STAGE_COLOR[stage];
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm" style={{ color }}>{stage}</span>
                      <span className="text-sm text-gray-600 font-semibold">{info.total} طالب</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full" style={{ width:`${reg.total>0?(info.total/reg.total)*100:0}%`, backgroundColor:color }} />
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(info.grades).map(([g, cnt]) => (
                        <div key={g} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 shrink-0" style={{ width:110 }}>{g}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width:`${info.total>0?(cnt/info.total)*100:0}%`, backgroundColor:color+'bb' }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-4 text-left shrink-0">{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2. المالية
        ══════════════════════════════════════════════════════════ */}
        {canSeeFinance && <section ref={el => { sectionRefs.current['finance'] = el; }}>
          <SectionTitle emoji="💰" title="المالية" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi label="الإيرادات الكلية"  value={SAR(fin.totalRevenue)}   color="#22c55e" icon="📈" />
            <Kpi label="إيرادات الطلاب"    value={SAR(fin.studentRevenue)} sub={`${reg.paid} × ${fin.fee} ر.س`} color="#103F91" icon="🎓" />
            <Kpi label="إيرادات إضافية"    value={SAR(fin.otherRevenueTotal)} color="#12B3D5" icon="➕" />
            <Kpi label="صافي الرصيد"       value={SAR(fin.netBalance)} color={fin.netBalance>=0?'#22c55e':'#E52E25'} icon={fin.netBalance>=0?'✅':'⚠️'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">المصروفات</p>
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">إجمالي الفواتير المعتمدة</span>
                <span className="font-bold text-gray-800">{SAR(fin.invoiceTotalSpent)}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">المصاريف العامة</span>
                <span className="font-bold text-gray-800">{SAR(fin.generalExpenseTotal)}</span>
              </div>
              <div className="rounded-xl py-3 px-4 flex items-center justify-between" style={{ backgroundColor:'#E52E2511' }}>
                <span className="font-semibold text-red-700">الإجمالي</span>
                <span className="text-lg font-bold text-red-700">{SAR(fin.totalExpenses)}</span>
              </div>
              {fin.pendingInvoicesCount > 0 && (
                <p className="text-xs text-amber-600 mt-2 text-center">{fin.pendingInvoicesCount} فاتورة بانتظار المراجعة</p>
              )}
            </Card>

            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">مصاريف اللجان</p>
              {fin.byDepartment.length===0
                ? <p className="text-sm text-gray-400 text-center py-4">لا توجد فواتير معتمدة</p>
                : <div className="space-y-2.5">
                    {fin.byDepartment.map(d => (
                      <div key={d.key} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 shrink-0" style={{ width:90 }}>{d.label}</span>
                        <Bar value={d.total} max={fin.byDepartment[0].total} color="#103F91" />
                        <span className="text-sm font-semibold text-gray-800 shrink-0">{SAR(d.total)}</span>
                      </div>
                    ))}
                  </div>
              }
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">تصنيف المصاريف</p>
              {fin.byCategory.length===0
                ? <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                : <div className="space-y-2.5">
                    {fin.byCategory.map(c => (
                      <div key={c.key} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 shrink-0" style={{ width:110 }}>{c.label}</span>
                        <Bar value={c.total} max={fin.byCategory[0].total} color="#FF9F1C" />
                        <span className="text-sm font-semibold text-gray-800 shrink-0">{SAR(c.total)}</span>
                      </div>
                    ))}
                  </div>
              }
            </Card>
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">الإيرادات الإضافية</p>
              {fin.otherRevenueList.length===0
                ? <p className="text-sm text-gray-400 text-center py-4">لا توجد إيرادات إضافية</p>
                : <div className="space-y-2">
                    {fin.otherRevenueList.slice(0,8).map((r,i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{r.title}</span>
                        <span className="text-sm font-semibold text-green-700">{SAR(r.amount)}</span>
                      </div>
                    ))}
                  </div>
              }
            </Card>
          </div>
        </section>}

        {/* ══════════════════════════════════════════════════════════
            3. الحضور
        ══════════════════════════════════════════════════════════ */}
        <section ref={el => { sectionRefs.current['attendance'] = el; }}>
          <SectionTitle emoji="✅" title="الحضور" />

          {/* كارد حضور اليوم */}
          {(() => {
            const todayTotal = (att.today?.present??0) + (att.today?.absent??0);
            return (
              <Card className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-4">حضور اليوم</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* نصف أيسر: الحلقة + الأرقام الإجمالية */}
                  <div className="flex flex-col items-center gap-3 border-l border-gray-100 pl-4">
                    <Ring value={att.today?.present??0} total={todayTotal||1} color="#22c55e" size={80} />
                    <div className="w-full space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">حاضر</span>
                        <span className="text-base font-bold text-green-600">{att.today?.present??0}</span>
                      </div>
                      <div className="h-px bg-gray-100" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">معتذر</span>
                        <span className="text-base font-bold text-amber-500">{att.today?.late??0}</span>
                      </div>
                      <div className="h-px bg-gray-100" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">غائب</span>
                        <span className="text-base font-bold text-red-500">{att.today?.absent??0}</span>
                      </div>
                    </div>
                  </div>
                  {/* نصف أيمن: تفصيل المراحل */}
                  <div className="flex flex-col justify-center gap-3">
                    {STAGES.map(stage => {
                      const row = att.last14ByStage[stage]?.slice(-1)[0];
                      const p = row?.present??0;
                      const a = row?.absent??0;
                      const total = p + a;
                      return (
                        <div key={stage}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLOR[stage] }} />
                              <span className="text-xs text-gray-600">{stage}</span>
                            </div>
                            <span className="text-sm font-bold" style={{ color: STAGE_COLOR[stage] }}>{p} / {total}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${total>0?Math.round(p/total*100):0}%`, backgroundColor: STAGE_COLOR[stage] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* Grouped bars — 3 stages per day — 7 days */}
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-sm font-semibold text-gray-700">الحضور — آخر 7 أيام</p>
              <div className="flex gap-3 text-xs text-gray-500">
                {STAGES.map(s => (
                  <span key={s} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor:STAGE_COLOR[s] }} />
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <GroupedAttendanceBars overall={att.last14Overall} byStage={att.last14ByStage} />
            {/* flat stat row replacing rings */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
              {(() => {
                const last7 = att.last14Overall.slice(-7);
                const tp = last7.reduce((s,d)=>s+d.present,0);
                const ta = last7.reduce((s,d)=>s+d.present+d.absent,0);
                return (
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">متوسط 7 أيام</p>
                    <p className="text-xl font-bold text-gray-800">{ta>0?Math.round(tp/ta*100):0}%</p>
                  </div>
                );
              })()}
              {att.stageAvg7.map(s => (
                <div key={s.stage} className="rounded-xl p-3 text-center" style={{ backgroundColor: STAGE_COLOR[s.stage]+'11' }}>
                  <p className="text-xs mb-1" style={{ color: STAGE_COLOR[s.stage] }}>{s.stage}</p>
                  <p className="text-xl font-bold" style={{ color: STAGE_COLOR[s.stage] }}>{s.avg}%</p>
                </div>
              ))}
            </div>
          </Card>

          {/* أكثر الطلاب حضوراً */}
          <Card className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">🎯 أكثر الطلاب حضوراً</p>
            {pts.top5MostPresent.length===0
              ? <p className="text-sm text-gray-400 text-center py-3">لا توجد بيانات</p>
              : <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {pts.top5MostPresent.map((s:any, i) => (
                    <div key={s.id} className="flex flex-col items-center gap-1 p-3 rounded-xl text-center" style={{ backgroundColor:STAGE_COLOR[s.stage]+'11' }}>
                      <MedalBadge rank={i+1} />
                      <p className="text-sm font-semibold text-gray-800 mt-1 text-center leading-tight">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.stage}</p>
                      <p className="text-lg font-bold" style={{ color:STAGE_COLOR[s.stage] }}>{s.presentDays}</p>
                      <p className="text-xs text-gray-400">يوم</p>
                    </div>
                  ))}
                </div>
            }
          </Card>

          {/* غياب متكرر */}
          <button onClick={() => setModal('consecutive')}
            className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="text-right">
                <p className="font-semibold text-amber-800">الطلاب ذوو الغياب المتكرر</p>
                <p className="text-xs text-amber-600">غائبون يومين متتاليين أو أكثر (آخر 30 يوم)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-amber-700">{att.consecutiveAbsentStudents.length}</span>
              <span className="text-amber-500">←</span>
            </div>
          </button>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4. نقاط الطلاب
        ══════════════════════════════════════════════════════════ */}
        <section ref={el => { sectionRefs.current['points'] = el; }}>
          <SectionTitle emoji="⭐" title="نقاط الطلاب" />

          {/* single tabbed card */}
          <Card>
            <StageTabs active={ptStage} onChange={setPtStage} />
            <div className="space-y-2">
              {(pts.top5PerStage[ptStage] || []).length===0
                ? <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                : (pts.top5PerStage[ptStage] || []).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <MedalBadge rank={i+1} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.grade}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bar value={s.points} max={(pts.top5PerStage[ptStage]||[])[0]?.points||1} color={STAGE_COLOR[ptStage]} h={5} />
                        <span className="text-base font-bold shrink-0" style={{ color:STAGE_COLOR[ptStage], minWidth:40, textAlign:'left' }}>{s.points}</span>
                      </div>
                    </div>
                  ))
              }
            </div>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5. المجموعات
        ══════════════════════════════════════════════════════════ */}
        <section ref={el => { sectionRefs.current['groups'] = el; }}>
          <SectionTitle emoji="👥" title="المجموعات والأسر" />

          <Card>
            <StageTabs active={grpStage} onChange={setGrpStage} />
            {(() => {
              const list = groups.byStage[grpStage] || [];
              const maxPts = list[0]?.points || 1;
              return list.length===0
                ? <p className="text-sm text-gray-400 text-center py-4">لا توجد مجموعات في هذه المرحلة</p>
                : <div className="space-y-3">
                    {list.map((g, i) => (
                      <div key={g.id} className="flex items-center gap-3">
                        <MedalBadge rank={i+1} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-800 truncate">{g.name}</span>
                            <span className="text-sm font-bold shrink-0 mr-2" style={{ color:STAGE_COLOR[grpStage] }}>{g.points.toLocaleString('ar-SA')} نقطة</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width:`${(g.points/maxPts)*100}%`, backgroundColor:STAGE_COLOR[grpStage] }} />
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{g.studentCount} طالب</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>;
            })()}
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6. المهام
        ══════════════════════════════════════════════════════════ */}
        <section ref={el => { sectionRefs.current['tasks'] = el; }}>
          <SectionTitle emoji="📌" title="المهام والتسليمات" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi label="إجمالي المهام"      value={tasks.total}               sub={`${tasks.active} نشطة`} color="#103F91" icon="📋" />
            <Kpi label="إجمالي التسليمات"   value={tasks.submissions.total}   color="#12B3D5" icon="📤" />
            <Kpi label="بانتظار المراجعة"   value={tasks.submissions.pending} color="#FF9F1C" icon="⏳" />
            <Kpi label="مقبولة"             value={tasks.submissions.approved} sub={`${tasks.submissions.rejected} مرفوضة`} color="#22c55e" icon="✅" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">نسبة إتمام المهام النشطة</p>
              {tasks.taskStats.length===0
                ? <p className="text-sm text-gray-400 text-center py-4">لا توجد مهام</p>
                : <div className="space-y-2.5">
                    {tasks.taskStats.map(t => (
                      <div key={t.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 truncate mb-1">{t.title} <span className="text-gray-400">— {t.track}</span></p>
                          <div className="flex items-center gap-2">
                            <Bar value={t.completionRate} max={100} color="#22c55e" />
                            <span className="text-xs font-semibold text-gray-700 shrink-0">{PCT(t.completionRate)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </Card>
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">🌟 أكثر الطلاب تسليماً</p>
              {tasks.top5Submitters.length===0
                ? <p className="text-sm text-gray-400 text-center py-4">لا توجد تسليمات</p>
                : <div className="space-y-3">
                    {tasks.top5Submitters.map((s:any, i) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <MedalBadge rank={i+1} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.stage} — {s.grade}</p>
                        </div>
                        <span className="text-sm font-bold text-[#103F91] shrink-0">{s.submissionCount} تسليم</span>
                      </div>
                    ))}
                  </div>
              }
            </Card>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            7. البرامج
        ══════════════════════════════════════════════════════════ */}
        <section ref={el => { sectionRefs.current['schedule'] = el; }}>
          <SectionTitle emoji="📅" title="البرامج والجدول" />

          <div className="grid grid-cols-2 gap-3 mb-5">
            <Kpi label="إجمالي البرامج" value={schedule.total}    color="#103F91" icon="📅" />
            <Kpi label="هذا الأسبوع"   value={schedule.thisWeek} color="#22c55e" icon="📆" />
          </div>

          <Card>
            <p className="text-sm font-semibold text-gray-700 mb-3">برامج كل لجنة</p>
            {schedule.byCommittee.length===0
              ? <p className="text-sm text-gray-400 text-center py-4">لا توجد برامج</p>
              : <div className="space-y-2.5">
                  {schedule.byCommittee.map(c => (
                    <div key={c.label} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 shrink-0" style={{ width:90 }}>{c.label}</span>
                      <Bar value={c.count} max={schedule.byCommittee[0].count} color="#103F91" />
                      <span className="text-sm font-bold text-gray-800 shrink-0 w-8 text-left">{c.count}</span>
                    </div>
                  ))}
                </div>
            }
          </Card>
        </section>

      </div>

      {/* ── Modals ── */}
      {modal==='conditions' && (
        <Modal title={`الحالات الصحية (${reg.conditionList.length})`} onClose={() => setModal(null)}>
          {reg.conditionList.length===0
            ? <p className="text-gray-400 text-center py-6">لا توجد حالات مسجّلة</p>
            : <div className="space-y-3">
                {reg.conditionList.map(s => (
                  <div key={s.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800">{s.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor:STAGE_COLOR[s.stage]+'22', color:STAGE_COLOR[s.stage] }}>{s.stage}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{s.grade} · عضوية #{s.membershipNo}</p>
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{s.condition}</p>
                  </div>
                ))}
              </div>
          }
        </Modal>
      )}

      {modal==='consecutive' && (
        <Modal title={`الغياب المتكرر (${att.consecutiveAbsentStudents.length})`} onClose={() => setModal(null)}>
          {att.consecutiveAbsentStudents.length===0
            ? <p className="text-gray-400 text-center py-6">لا يوجد طلاب بغياب متكرر 👍</p>
            : <div className="space-y-2">
                {att.consecutiveAbsentStudents.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <div>
                      <p className="font-semibold text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.stage} · {s.grade}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-amber-700">{s.maxStreak}</p>
                      <p className="text-xs text-amber-500">أيام متتالية</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </Modal>
      )}
    </div>
  );
}
