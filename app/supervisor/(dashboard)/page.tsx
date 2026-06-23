'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSupervisor } from '@/components/SupervisorShell';
import { pushToast } from '@/components/Toast';

const ROLE_MAP: Record<string, string> = {
  admin: 'مدير عام',
  finance: 'مسؤول المالية',
  attendance_supervisor: 'مشرف تحضير',
  social_supervisor: 'مشرف اجتماعية',
  cultural_supervisor: 'مشرف ثقافية',
  groups_supervisor: 'مشرف أسر',
  general_supervisor: 'مشرف عام',
  finance_supervisor: 'مسؤول المالية',
  media_supervisor: 'مشرف الإعلامية',
  scientific_supervisor: 'مشرف العلمية',
  sports_supervisor: 'مشرف الرياضية',
  administrative_supervisor: 'مشرف الإدارية'
};

const getRoleLabel = (roleStr: string) => {
  if (roleStr === 'admin') return 'مدير عام';
  if (roleStr === 'finance') return 'مسؤول المالية';
  return roleStr
    .split(',')
    .map((r) => ROLE_MAP[r.trim()] || r)
    .filter(Boolean)
    .join('، ') || 'مشرف';
};

const ALL_LINKS = [
  { id: 'students', href: '/supervisor/students', label: 'إدارة الطلاب', perm: 'students' },
  { id: 'attendance', href: '/supervisor/attendance', label: 'تسجيل الحضور', perm: 'attendance' },
  { id: 'points', href: '/supervisor/points', label: 'رصد النقاط والجوائز', perm: 'points' },
  { id: 'tasks', href: '/supervisor/tasks', label: 'إدارة المهام', perm: 'tasks' },
  { id: 'schedule', href: '/supervisor/schedule', label: 'جدول البرامج', perm: 'schedule' },
  { id: 'groups', href: '/supervisor/groups', label: 'إدارة المجموعات والأسر', perm: 'groups' },
  { id: 'payments', href: '/supervisor/payments', label: 'مراجعة المدفوعات', perm: 'payments' },
  { id: 'invoices', href: '/supervisor/invoices', label: 'إضافة وإدارة الفواتير', perm: 'invoices' },
  { id: 'finance', href: '/supervisor/finance', label: 'الالتقارير المالية', perm: 'finance' },
  { id: 'announcements', href: '/supervisor/announcements', label: 'نشر إعلان جديد', perm: 'announcements' },
  { id: 'supervisors', href: '/supervisor/supervisors', label: 'إدارة الحسابات والصلاحيات', perm: 'supervisors' }
];

const SCHEDULE_ROLES = [
  { key: 'social_supervisor', label: 'اللجنة الاجتماعية', color: 'border-red-500 text-red-700 bg-red-50' },
  { key: 'cultural_supervisor', label: 'اللجنة الثقافية', color: 'border-green-500 text-green-700 bg-green-50' },
  { key: 'media_supervisor', label: 'اللجنة الإعلامية', color: 'border-cyan-500 text-cyan-700 bg-cyan-50' },
  { key: 'groups_supervisor', label: 'لجنة الأسر', color: 'border-blue-500 text-blue-700 bg-blue-50' },
  { key: 'attendance_supervisor', label: 'لجنة التحضير', color: 'border-gray-500 text-gray-700 bg-gray-50' },
  { key: 'general_supervisor', label: 'الإدارة', color: 'border-slate-500 text-slate-700 bg-slate-50' },
  { key: 'scientific_supervisor', label: 'اللجنة العلمية', color: 'border-indigo-500 text-indigo-700 bg-indigo-50' },
  { key: 'sports_supervisor', label: 'اللجنة الرياضية', color: 'border-orange-500 text-orange-700 bg-orange-50' },
  { key: 'administrative_supervisor', label: 'اللجنة الإدارية', color: 'border-teal-500 text-teal-700 bg-teal-50' }
];

const DEFAULT_SLOTS = [
  { label: 'الفقرة الأولى (04:30 م - 05:30 م)', start: '16:30', end: '17:30' },
  { label: 'الفقرة الثانية (05:30 م - 06:30 م)', start: '17:30', end: '18:30' },
  { label: 'الفقرة الثالثة (07:30 م - 08:45 م)', start: '19:30', end: '20:45' }
];

// ─── helpers ─────────────────────────────────────────────────────────────────
function AttendanceRing({ percent, color = 'var(--accent)' }: { percent: number; color?: string }) {
  const r = 28, c = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="transparent" stroke="var(--bg-soft)" strokeWidth="4.5" />
        <circle cx="32" cy="32" r={r} fill="transparent" stroke={color} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-extrabold" style={{ color }}>{percent}%</span>
    </div>
  );
}

function SmallCard({ accent, icon, label, value, sub }: { accent: string; icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-5 flex items-center gap-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1.5 h-full" style={{ backgroundColor: accent }} />
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: accent + '22', color: accent }}>
        {icon}
      </div>
      <div className="space-y-0.5 min-w-0">
        <div className="text-[10px] text-ink-400 font-bold">{label}</div>
        <div className="text-xl font-bold text-ink-900">{value}</div>
        {sub && <div className="text-[10px] text-ink-500 font-semibold">{sub}</div>}
      </div>
    </div>
  );
}

function AttendanceCard({ label, present, absent, percent, color, sub }: { label: string; present: number; absent: number; percent: number; color: string; sub?: string }) {
  return (
    <div className="card p-5 flex items-center justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1.5 h-full" style={{ backgroundColor: color }} />
      <div className="space-y-1 min-w-0">
        <div className="text-xs text-ink-500 font-bold">{label}</div>
        <div className="text-xl font-bold text-ink-900">{present} <span className="text-sm text-ink-400 font-medium">حاضر</span></div>
        <div className="text-sm font-semibold text-red-500">{absent} <span className="text-xs text-ink-400 font-medium">معتذر</span></div>
        {sub && <div className="text-[10px] text-ink-400 font-semibold">{sub}</div>}
      </div>
      <AttendanceRing percent={percent} color={color} />
    </div>
  );
}

function NextProgramCard({ program }: { program: { title: string; date: string; startTime: string } | null }) {
  const formatDate = (d: string) => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dt = new Date(d);
    return `${days[dt.getDay()]} ${dt.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}`;
  };
  return (
    <div className="card p-5 flex items-center gap-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <div className="space-y-0.5 min-w-0">
        <div className="text-[10px] text-ink-400 font-bold">أقرب برنامج للجنتك</div>
        {program ? (
          <>
            <div className="text-sm font-bold text-ink-900 truncate">{program.title}</div>
            <div className="text-[10px] text-indigo-600 font-semibold">{formatDate(program.date)} · {program.startTime}</div>
          </>
        ) : (
          <div className="text-sm font-bold text-ink-400">لا يوجد برنامج قادم</div>
        )}
      </div>
    </div>
  );
}

function QuickInfoCards({ roles, isAdmin, isFinanceRole, isAttendanceRole, isPointsRole, isGroupsRole, isGeneralRole, isStageRole, isMediaRole, stats, attendancePercent, groupAttendancePercent }: {
  roles: string[]; isAdmin: boolean; isFinanceRole: boolean; isAttendanceRole: boolean; isPointsRole: boolean;
  isGroupsRole: boolean; isGeneralRole: boolean; isStageRole: boolean; isMediaRole: boolean;
  stats: any; attendancePercent: number; groupAttendancePercent: number;
}) {
  const overallPresent = stats?.attendanceOverall?.presentToday ?? 0;
  const overallAbsent = stats?.attendanceOverall?.absentToday ?? 0;

  // Admin / General supervisor
  if (isAdmin) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SmallCard
          accent="#22c55e"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.7199m0 0-.003-.031a6.062 6.062 0 0 1 3.518-5.563 3 3 0 1 1 4.966 0 6.062 6.062 0 0 1 3.518 5.563" /></svg>}
          label="الطلاب المقبولين"
          value={stats?.students?.approved ?? 0}
          sub={`من إجمالي ${stats?.students?.total ?? 0} مسجّل`}
        />
        <AttendanceCard
          label="حضور اليوم"
          present={overallPresent} absent={overallAbsent}
          percent={attendancePercent} color="var(--accent)"
        />
      </div>
    );
  }

  if (isGeneralRole) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 max-w-sm">
        <AttendanceCard
          label="حضور اليوم"
          present={overallPresent} absent={overallAbsent}
          percent={attendancePercent} color="var(--accent)"
        />
      </div>
    );
  }

  // Finance supervisor
  if (isFinanceRole) {
    const fs = stats?.financeStats;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SmallCard accent="#f59e0b"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>}
          label="فواتير معلّقة" value={stats?.invoices?.pendingReview ?? 0} sub="بانتظار الموافقة"
        />
        <SmallCard accent="#ef4444"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>}
          label="مدفوعات معلّقة" value={stats?.payments?.pendingReview ?? 0} sub="بانتظار المراجعة"
        />
        <SmallCard accent="#10b981"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
          label="صافي الرصيد" value={`${(fs?.netBalance ?? 0).toLocaleString('ar')} ر.س`} sub="إيرادات الطلاب − المصروفات"
        />
        <SmallCard accent="#8b5cf6"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>}
          label="مصاريف هذا الشهر" value={`${(fs?.thisMonthExpenses ?? 0).toLocaleString('ar')} ر.س`} sub="إجمالي الفواتير المعتمدة"
        />
      </div>
    );
  }

  // Attendance supervisor
  if (isAttendanceRole) {
    const as = stats?.attendanceStats;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AttendanceCard
          label="حضور اليوم" present={overallPresent} absent={overallAbsent}
          percent={attendancePercent} color="var(--accent)"
        />
        <SmallCard accent="#12B3D5"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" /></svg>}
          label="متوسط آخر 7 أيام" value={`${as?.avg7DayAttendance ?? 0}%`} sub="معدّل نسبة الحضور اليومية"
        />
        <SmallCard accent="#f97316"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>}
          label="غياب متكرر" value={as?.consecutiveAbsentCount ?? 0} sub="طالب غاب يومين متتاليين أو أكثر"
        />
      </div>
    );
  }

  // Points supervisors (social/cultural/scientific/sports)
  if (isPointsRole) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AttendanceCard
          label="حضور اليوم" present={overallPresent} absent={overallAbsent}
          percent={attendancePercent} color="var(--accent)"
        />
        <NextProgramCard program={stats?.nextCommitteeProgram ?? null} />
      </div>
    );
  }

  // Groups supervisor
  if (isGroupsRole) {
    const gs = stats?.groupStats;
    const myPresent = stats?.attendance?.presentToday ?? 0;
    const myAbsent = stats?.attendance?.absentToday ?? 0;
    const myTotal = myPresent + myAbsent;
    const myPct = myTotal > 0 ? Math.round(myPresent / myTotal * 100) : 0;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SmallCard accent="#22c55e"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.7199m0 0-.003-.031a6.062 6.062 0 0 1 3.518-5.563 3 3 0 1 1 4.966 0 6.062 6.062 0 0 1 3.518 5.563" /></svg>}
          label="طلاب الأسرة" value={stats?.myStudents?.length ?? 0} sub="إجمالي طلاب أسرتك"
        />
        <AttendanceCard
          label="حضور الأسرة اليوم" present={myPresent} absent={myAbsent}
          percent={myPct} color="#12B3D5"
        />
        <SmallCard accent="#f59e0b"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>}
          label="ترتيب الأسرة" value={gs?.myGroupRank != null ? `#${gs.myGroupRank}` : '—'} sub="بين جميع الأسر في النقاط"
        />
        <SmallCard accent="#8b5cf6"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
          label="نقاط الأسرة" value={gs?.myGroupPoints ?? 0} sub="إجمالي نقاط الأسرة"
        />
      </div>
    );
  }

  // Stage supervisor
  if (isStageRole) {
    const ss = stats?.stageStats;
    const sp = ss?.attendanceToday?.present ?? 0;
    const sa = ss?.attendanceToday?.absent ?? 0;
    const st = sp + sa;
    const spct = st > 0 ? Math.round(sp / st * 100) : 0;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SmallCard accent="#22c55e"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.7199m0 0-.003-.031a6.062 6.062 0 0 1 3.518-5.563 3 3 0 1 1 4.966 0 6.062 6.062 0 0 1 3.518 5.563" /></svg>}
          label={`طلاب مرحلة ${ss?.stageName ?? ''} المقبولين`} value={ss?.approvedCount ?? 0} sub="طالب مقبول في مرحلتك"
        />
        <AttendanceCard
          label="حضور المرحلة اليوم" present={sp} absent={sa}
          percent={spct} color="#103F91"
        />
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-400" />
          <div className="text-[10px] text-ink-400 font-bold mb-3">أوائل المرحلة</div>
          {ss?.top3?.length > 0 ? (
            <div className="space-y-2">
              {ss.top3.map((s: { name: string; points: number }, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-extrabold flex items-center justify-center border border-amber-200">{i + 1}</span>
                    <span className="text-xs font-semibold text-ink-800 truncate max-w-[110px]">{s.name}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-600">{s.points} نقطة</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-ink-400 text-center py-3">لا توجد نقاط بعد</div>
          )}
        </div>
      </div>
    );
  }

  // Media supervisor
  if (isMediaRole) {
    const lastAnn = stats?.announcements?.announcementsList?.[0];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SmallCard accent="#12B3D5"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>}
          label="إعلانات منشورة" value={stats?.announcements?.total ?? 0} sub="إجمالي الإعلانات"
        />
        <NextProgramCard program={stats?.nextCommitteeProgram ?? null} />
        <SmallCard accent="#8b5cf6"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" /></svg>}
          label="مهام نشطة" value={stats?.tasks?.active ?? 0} sub="مهمة نشطة حالياً"
        />
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-teal-500" />
          <div className="text-[10px] text-ink-400 font-bold mb-2">آخر إعلان</div>
          {lastAnn ? (
            <>
              <div className="text-xs font-bold text-ink-900 line-clamp-2 mb-1">{lastAnn.title}</div>
              <div className="text-[10px] text-ink-400">{new Date(lastAnn.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</div>
            </>
          ) : (
            <div className="text-xs text-ink-400 text-center py-3">لا توجد إعلانات</div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function DashboardHome() {
  const { user } = useSupervisor();
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Links states
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>([]);

  // Quick Points Widget states
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pointDelta, setPointDelta] = useState(5);
  const [pointReason, setPointReason] = useState('');
  const [pointCategory, setPointCategory] = useState('behavior');
  const [pointsBusy, setPointsBusy] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Add Program Modal states
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [programTitle, setProgramTitle] = useState('');
  const [programRole, setProgramRole] = useState('');
  const [programStages, setProgramStages] = useState<string[]>(['الكل']);
  const [programSlots, setProgramSlots] = useState<number[]>([0]);
  const [programNotes, setProgramNotes] = useState('');
  const [programBusy, setProgramBusy] = useState(false);

  // Announcement details modal
  const [selectedAnn, setSelectedAnn] = useState<any>(null);

  const perms = user?.permissions || [];
  const hasPerm = (p: string) => perms.includes('*') || perms.includes(p);

  const roles = user?.role ? user.role.split(',').map((r) => r.trim()) : [];

  const canSeeStudentDetails = roles.some((r) =>
    ['admin', 'general_supervisor', 'finance', 'finance_supervisor', 'administrative_supervisor'].includes(r)
  );

  const isAdmin = roles.includes('admin');
  const isFinanceRole = roles.some(r => ['finance', 'finance_supervisor'].includes(r));
  const isAttendanceRole = roles.includes('attendance_supervisor');
  const isPointsRole = roles.some(r => ['social_supervisor', 'cultural_supervisor', 'scientific_supervisor', 'sports_supervisor'].includes(r));
  const isGroupsRole = roles.includes('groups_supervisor');
  const isGeneralRole = roles.includes('general_supervisor');
  const isStageRole = roles.includes('stage_supervisor');
  const isMediaRole = roles.includes('media_supervisor');

  const allowedLinks = ALL_LINKS.filter(link => {
    if (link.id === 'students') {
      return canSeeStudentDetails;
    }
    return hasPerm(link.perm);
  });

  const isGlobal = roles.some((r) =>
    ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
  );
  
  const canManageSchedule = hasPerm('schedule');
  const canPublishAnnouncements = hasPerm('announcements');
  const canSeeTasks = hasPerm('tasks');

  async function loadData() {
    try {
      const [statsRes, studentsRes] = await Promise.all([
        fetch('/api/supervisor/dashboard/stats', { cache: 'no-store' }),
        fetch('/api/supervisor/students?scope=all', { cache: 'no-store' })
      ]);
      
      const statsJson = await statsRes.json();
      const studentsJson = await studentsRes.json();
      
      if (statsJson.stats) setStats(statsJson.stats);
      if (studentsJson.students) {
        // Only allow awarding points to approved students
        setStudents(studentsJson.students.filter((s: any) => s.registrationStatus === 'approved'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem('nibras_quick_links');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          const validIds = ids.filter(id => {
            const link = ALL_LINKS.find(l => l.id === id);
            return link && hasPerm(link.perm);
          });
          setSelectedLinkIds(validIds);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    setSelectedLinkIds(allowedLinks.map(l => l.id));
  }, [user]);

  // Click outside listener for student search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        if (studentId) {
          const selected = students.find((s) => String(s.id) === studentId);
          if (selected) {
            setStudentQuery(selected.studentName);
          }
        } else {
          setStudentQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [studentId, students]);

  const filteredStudents = useMemo(() => {
    if (!studentQuery.trim()) return [];
    const q = studentQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        String(s.membershipNo).includes(q)
    ).slice(0, 5);
  }, [students, studentQuery]);

  const quickLinks = allowedLinks.filter(link => selectedLinkIds.includes(link.id));

  // Handle Quick Points Submit
  async function handleQuickPointsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !pointReason.trim()) {
      return pushToast('error', 'الرجاء اختيار الطالب وتحديد السبب');
    }
    setPointsBusy(true);
    try {
      const r = await fetch('/api/supervisor/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: studentId,
          delta: pointDelta,
          reason: pointReason.trim(),
          category: pointCategory
        })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        pushToast('success', `تم رصد ${pointDelta} نقطة بنجاح!`);
        setPointReason('');
        setStudentId('');
        setStudentQuery('');
        // Reload stats
        const res = await fetch('/api/supervisor/dashboard/stats', { cache: 'no-store' });
        const data = await res.json();
        if (data.stats) setStats(data.stats);
      } else {
        pushToast('error', j.error ?? 'فشل رصد النقاط');
      }
    } catch {
      pushToast('error', 'حدث خطأ في الشبكة');
    } finally {
      setPointsBusy(false);
    }
  }

  // Handle Quick Add Program Submit
  async function handleQuickProgramSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!programTitle.trim() || !programRole || programSlots.length === 0) {
      return pushToast('error', 'الرجاء إكمال جميع الحقول واختيار فقرة واحدة على الأقل');
    }

    setProgramBusy(true);
    const minSlot = Math.min(...programSlots);
    const maxSlot = Math.max(...programSlots);
    const startTimeVal = DEFAULT_SLOTS[minSlot].start;
    const endTimeVal = DEFAULT_SLOTS[maxSlot].end;
    const stageStr = programStages.join(',');
    const todayDate = new Date().toISOString().split('T')[0];

    try {
      const r = await fetch('/api/supervisor/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: programTitle.trim(),
          date: todayDate,
          startTime: startTimeVal,
          endTime: endTimeVal,
          role: programRole,
          stage: stageStr,
          notes: programNotes.trim() || null
        })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        pushToast('success', 'تمت إضافة البرنامج لجدول اليوم بنجاح!');
        setIsAddProgramOpen(false);
        setProgramTitle('');
        setProgramNotes('');
        setProgramSlots([0]);
        // Reload stats
        const res = await fetch('/api/supervisor/dashboard/stats', { cache: 'no-store' });
        const data = await res.json();
        if (data.stats) setStats(data.stats);
      } else {
        pushToast('error', j.error ?? 'فشل إضافة البرنامج');
      }
    } catch {
      pushToast('error', 'حدث خطأ في الشبكة');
    } finally {
      setProgramBusy(false);
    }
  }

  const attendancePercent = useMemo(() => {
    if (!stats?.attendanceOverall) return 0;
    const { presentToday, activeBase } = stats.attendanceOverall;
    return Math.round((presentToday / Math.max(activeBase, 1)) * 100);
  }, [stats]);

  const groupAttendancePercent = useMemo(() => {
    if (!stats?.attendance) return 0;
    const { presentToday, activeBase } = stats.attendance;
    return Math.round((presentToday / Math.max(activeBase, 1)) * 100);
  }, [stats]);

  const welcomeBannerStyle = {
    background: 'linear-gradient(135deg, var(--accent) 0%, #d97706 100%)',
    color: '#fff'
  };

  return (
    <div className="font-sans text-right" dir="rtl">
      {/* 1. Header & Welcome Card */}

      <div className="card p-6 border-transparent relative overflow-hidden mb-6" style={welcomeBannerStyle}>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-2xl font-bold shadow-inner shrink-0">
            {user?.name.charAt(0) || 'م'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">أهلاً بك، {user?.name}</h2>
            <p className="text-sm text-white/90 flex items-center gap-1.5 flex-wrap">
              <span>الدور الحالي:</span>
              <span className="font-semibold px-2 py-0.5 bg-white/20 rounded-md text-xs">{getRoleLabel(user?.role || '')}</span>
            </p>
          </div>
        </div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-10 -left-5 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-400 text-sm">جارٍ تحميل الإحصائيات الذكية…</div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick Links Section */}
          {allowedLinks.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-ink-900 flex items-center gap-1.5 whitespace-nowrap">
                  <svg className="w-3.5 h-3.5 text-brand shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>الوصول السريع</span>
                </h2>
                <button
                  onClick={() => {
                    setTempSelected(selectedLinkIds);
                    setCustomizing(true);
                  }}
                  className="btn btn-secondary p-1 px-1.5 text-xs flex items-center justify-center gap-1"
                  title="تخصيص الروابط"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              </div>

              {quickLinks.length === 0 ? (
                <p className="text-center py-4 text-ink-400 text-sm">
                  لم تقم باختيار أي روابط للوصول السريع بعد. اضغط على زر "تخصيص" أعلاه لاختيار الروابط.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-ink-150 bg-white hover:bg-cream-50/50 hover:border-brand-300 hover:shadow-xs transition-all text-xs font-bold text-ink-800"
                    >
                      <span>{link.label}</span>
                      <svg className="w-3.5 h-3.5 text-brand transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Info Cards — role-specific */}
          <QuickInfoCards
            roles={roles}
            isAdmin={isAdmin}
            isFinanceRole={isFinanceRole}
            isAttendanceRole={isAttendanceRole}
            isPointsRole={isPointsRole}
            isGroupsRole={isGroupsRole}
            isGeneralRole={isGeneralRole}
            isStageRole={isStageRole}
            isMediaRole={isMediaRole}
            stats={stats}
            attendancePercent={attendancePercent}
            groupAttendancePercent={groupAttendancePercent}
          />

          {/* Main Content Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Right main column (Timeline + Announcements) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Today's Schedule Timeline Widget */}
              <div className="card p-5 flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between border-b border-ink-100 pb-3 mb-4">
                  <h3 className="font-bold text-ink-900 flex items-center gap-2 text-base">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>جدول برامج اليوم</span>
                  </h3>
                  {canManageSchedule && (
                    <button 
                      onClick={() => {
                        // Pre-populate role input from first available role of the user
                        const userRolesList = user?.role ? user.role.split(',').map(r => r.trim()) : [];
                        const matches = SCHEDULE_ROLES.filter(r => userRolesList.includes(r.key));
                        setProgramRole(matches.length > 0 ? matches[0].key : '');
                        setIsAddProgramOpen(true);
                      }}
                      className="btn btn-primary py-1 px-3 text-xs font-semibold flex items-center gap-1"
                      style={{ background: 'var(--accent)' }}
                    >
                      <span>+ إضافة برنامج</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  {!stats?.schedule?.todayPrograms || stats.schedule.todayPrograms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-ink-400 text-sm gap-2">
                      <svg className="w-12 h-12 text-ink-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                      </svg>
                      <span>لا توجد برامج مسجلة في جدول اليوم حتى الآن.</span>
                    </div>
                  ) : (
                    <div className="relative border-r border-ink-200 pr-5 mr-3 space-y-4 py-2">
                      {stats.schedule.todayPrograms.map((prog: any, idx: number) => {
                        const roleStyle = SCHEDULE_ROLES.find(r => r.key === prog.role);
                        const roleLbl = roleStyle?.label || 'غير محدد';
                        const badgeColor = roleStyle?.color || 'bg-gray-100 text-gray-800 border-gray-200';
                        return (
                          <div key={prog.id || idx} className="relative group">
                            {/* Dot on timeline */}
                            <div className="absolute -right-[25px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-white" />
                            
                            <div className="bg-white border border-ink-150 p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h4 className="font-bold text-sm text-ink-900">{prog.title}</h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                                  {roleLbl}
                                </span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500 font-semibold mb-1">
                                <div className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                  </svg>
                                  <span>{prog.startTime} - {prog.endTime}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 21c-2.243 0-4.307-.648-6.046-1.765a4.125 4.125 0 0 1 7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 21c-2.243 0-4.307-.648-6.046-1.765a4.125 4.125 0 0 1 7.533-2.493" />
                                  </svg>
                                  <span>المرحلة: <span className="font-bold text-ink-700">{prog.stage || 'الكل'}</span></span>
                                </div>
                              </div>
                              {prog.notes && (
                                <p className="text-[11px] text-ink-400 mt-2 bg-cream-50/50 p-2 rounded-lg border border-ink-100">
                                  {prog.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Announcements Feed Widget */}
              <div className="card p-5 flex flex-col">
                <div className="flex items-center justify-between border-b border-ink-100 pb-3 mb-4">
                  <h3 className="font-bold text-ink-900 flex items-center gap-2 text-base">
                    <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    </svg>
                    <span>الإعلانات والتعاميم</span>
                  </h3>
                  {canPublishAnnouncements && (
                    <Link 
                      href="/supervisor/announcements"
                      className="btn btn-primary py-1 px-3 text-xs font-semibold flex items-center gap-1"
                      style={{ background: 'var(--teal)' }}
                    >
                      <span>+ نشر إعلان</span>
                    </Link>
                  )}
                </div>

                <div className="space-y-3">
                  {!stats?.announcements?.announcementsList || stats.announcements.announcementsList.length === 0 ? (
                    <p className="text-center py-10 text-ink-400 text-sm">لا توجد إعلانات منشورة حالياً.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {stats.announcements.announcementsList.map((ann: any) => (
                        <div 
                          key={ann.id} 
                          onClick={() => setSelectedAnn(ann)}
                          className="bg-white border border-ink-150 p-4 rounded-xl flex flex-col justify-between hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer group"
                        >
                          <div className="space-y-1.5 mb-3">
                            <h4 className="font-bold text-xs text-ink-900 group-hover:text-teal-700 transition-colors line-clamp-1">{ann.title}</h4>
                            <p className="text-[11px] text-ink-500 line-clamp-2 leading-relaxed">{ann.body}</p>
                          </div>
                          
                          <div className="flex items-center justify-between text-[10px] text-ink-400 font-bold border-t border-ink-50 pt-2">
                            <span>{new Date(ann.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-teal-650 group-hover:underline flex items-center gap-0.5">
                              اقرأ المزيد 
                              <svg className="w-3 h-3 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Left sidebar column (Group students + Quick points) */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Group / Family Students list */}
              {!isGlobal && stats?.myStudents?.length > 0 && (
                <div className="card p-5 flex flex-col h-[350px]">
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2 border-b border-ink-100 pb-2 text-base">
                    <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    <span>طلاب الأسرة الخاصة بك ({stats?.myStudents?.length || 0})</span>
                  </h3>
                  <div className="flex-1 overflow-y-auto scroll-soft min-h-0 text-right space-y-2 pr-1">
                    {stats.myStudents.map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center p-2.5 rounded-lg border border-ink-100 bg-cream-50/20 text-xs">
                        <div className="font-semibold text-ink-900">{s.studentName}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-ink-500 font-mono">#{s.membershipNo}</span>
                          <span className="text-ink-400 bg-white border border-ink-200 px-1.5 py-0.5 rounded-sm">{s.grade}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Points Allocator Widget */}
              <div className="card p-5 flex flex-col">
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2 border-b border-ink-100 pb-2 text-base">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>رصد نقاط سريع للطلاب</span>
                </h3>
                
                <form onSubmit={handleQuickPointsSubmit} className="space-y-3.5">
                  <div className="relative" ref={searchContainerRef}>
                    <label className="label !text-[11px]">الطالب</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="field w-full pl-8 pr-3 text-xs"
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
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900 font-bold p-0.5"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {isDropdownOpen && (
                      <div className="absolute z-30 w-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg max-h-48 overflow-y-auto scroll-soft">
                        {filteredStudents.length === 0 ? (
                          <div className="p-3 text-[11px] text-ink-400 text-center">لا يوجد طلاب يطابقون البحث</div>
                        ) : (
                          filteredStudents.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setStudentId(String(s.id));
                                setStudentQuery(s.studentName);
                                setIsDropdownOpen(false);
                              }}
                              className={`w-full text-right px-3 py-2 text-xs hover:bg-cream-50 transition-colors flex items-center justify-between border-b border-ink-50 last:border-0 ${
                                studentId === String(s.id) ? 'bg-brand/5 text-brand font-semibold' : 'text-ink-900'
                              }`}
                            >
                              <span className="font-semibold">{s.studentName}</span>
                              <span className="text-[10px] text-ink-400 font-mono">#{s.membershipNo}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label !text-[11px]">عدد النقاط</label>
                      <input 
                        type="number"
                        className="field text-xs"
                        value={pointDelta}
                        onChange={(e) => setPointDelta(parseInt(e.target.value, 10) || 0)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label !text-[11px]">تصنيف النقاط</label>
                      <select 
                        className="field text-xs" 
                        value={pointCategory} 
                        onChange={(e) => setPointCategory(e.target.value)}
                      >
                        <option value="behavior">سلوك</option>
                        <option value="participation">مشاركة</option>
                        <option value="activity">نشاط</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label !text-[11px]">سبب رصد النقاط</label>
                    <input 
                      type="text"
                      className="field text-xs"
                      placeholder="مثال: الحضور المبكر لنشاط اللجنة"
                      value={pointReason}
                      onChange={(e) => setPointReason(e.target.value)}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={pointsBusy || !studentId}
                    className="btn btn-primary w-full py-2 text-xs justify-center font-bold"
                    style={{ background: 'var(--accent)' }}
                  >
                    {pointsBusy ? 'جارٍ الرصد...' : 'رصد النقاط الآن'}
                  </button>
                </form>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* TABS Customizer Modal */}
      {customizing && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-[999]" onClick={() => setCustomizing(false)}>
          <div className="modal-panel w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-line bg-cream-50/50">
              <h3 className="font-bold text-base text-ink-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                تخصيص الوصول السريع
              </h3>
              <button onClick={() => setCustomizing(false)} className="text-ink-400 hover:text-ink-900 text-2xl font-bold p-1 leading-none">×</button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-right">
              <p className="text-xs text-ink-500 mb-4">اختر الروابط التي ترغب في ظهورها بصفحة التحكم الرئيسية من قائمة صلاحياتك المتاحة:</p>
              
              {allowedLinks.map((link) => {
                const checked = tempSelected.includes(link.id);
                return (
                  <label 
                    key={link.id} 
                    className="flex items-center gap-3 p-3 rounded-xl border border-ink-150 bg-white hover:bg-cream-50/30 cursor-pointer transition-colors text-sm font-semibold text-ink-800"
                  >
                    <input 
                      type="checkbox" 
                      className="w-4.5 h-4.5 text-brand border-ink-300 rounded focus:ring-brand cursor-pointer"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTempSelected([...tempSelected, link.id]);
                        } else {
                          setTempSelected(tempSelected.filter(id => id !== link.id));
                        }
                      }}
                    />
                    <span>{link.label}</span>
                  </label>
                );
              })}
              {allowedLinks.length === 0 && (
                <div className="text-center py-6 text-ink-400 text-sm">لا توجد صلاحيات وصول سريعة متاحة لحسابك حالياً.</div>
              )}
            </div>

            <div className="p-4 border-t border-line bg-cream-50/50 flex gap-2">
              <button
                onClick={() => {
                  localStorage.setItem('nibras_quick_links', JSON.stringify(tempSelected));
                  setSelectedLinkIds(tempSelected);
                  setCustomizing(false);
                  pushToast('success', 'تم حفظ تخصيص الوصول السريع بنجاح');
                }}
                className="btn btn-primary py-2 px-4 text-xs flex-1 justify-center flex items-center"
              >
                حفظ التخصيص
              </button>
              <button
                onClick={() => setCustomizing(false)}
                className="btn btn-secondary py-2 px-4 text-xs flex-1 justify-center flex items-center"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Program Modal */}
      {isAddProgramOpen && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-[999]" onClick={() => setIsAddProgramOpen(false)}>
          <form 
            onSubmit={handleQuickProgramSubmit} 
            className="modal-panel w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-line bg-cream-50/50">
              <h3 className="font-bold text-base text-ink-900">إضافة برنامج لجدول اليوم</h3>
              <button type="button" onClick={() => setIsAddProgramOpen(false)} className="text-ink-400 hover:text-ink-900 text-2xl font-bold leading-none">×</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-right text-xs">
              <div>
                <label className="label">عنوان البرنامج / الفقرة <span className="req">*</span></label>
                <input 
                  type="text"
                  className="field text-sm"
                  placeholder="مثال: مسابقة ثقافية حركية"
                  value={programTitle}
                  onChange={(e) => setProgramTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">اللجنة المسؤولة عن البرنامج <span className="req">*</span></label>
                <select 
                  className="field text-sm"
                  value={programRole}
                  onChange={(e) => setProgramRole(e.target.value)}
                  required
                >
                  <option value="">اختر اللجنة</option>
                  {SCHEDULE_ROLES.filter(roleOption => {
                    const userRolesList = user?.role ? user.role.split(',').map(r => r.trim()) : [];
                    return user?.role === 'admin' || userRolesList.includes(roleOption.key);
                  }).map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">المراحل المستهدفة</label>
                <div className="flex gap-4 p-2 bg-cream-50 rounded-lg border border-ink-150">
                  {['الكل', 'ابتدائي', 'متوسط', 'ثانوي'].map(st => {
                    const checked = programStages.includes(st);
                    return (
                      <label key={st} className="flex items-center gap-1.5 cursor-pointer font-bold">
                        <input 
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (st === 'الكل') {
                              setProgramStages(['الكل']);
                            } else {
                              let next = programStages.filter(x => x !== 'الكل');
                              if (e.target.checked) {
                                next.push(st);
                              } else {
                                next = next.filter(x => x !== st);
                              }
                              setProgramStages(next.length === 0 ? ['الكل'] : next);
                            }
                          }}
                        />
                        <span>{st}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label">الفقرات الزمنية المحددة <span className="req">*</span></label>
                <div className="space-y-2 p-3 bg-cream-50 rounded-lg border border-ink-150">
                  {DEFAULT_SLOTS.map((slot, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer font-bold">
                      <input 
                        type="checkbox" 
                        checked={programSlots.includes(i)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProgramSlots([...programSlots, i]);
                          } else {
                            setProgramSlots(programSlots.filter(x => x !== i));
                          }
                        }}
                      />
                      <span>{slot.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">ملاحظات أو تفاصيل إضافية</label>
                <textarea 
                  className="field text-sm min-h-[70px]"
                  placeholder="مقر البرنامج، المواد المطلوبة، إلخ..."
                  value={programNotes}
                  onChange={(e) => setProgramNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 border-t border-line bg-cream-50/50 flex gap-2">
              <button 
                type="submit" 
                disabled={programBusy}
                className="btn btn-primary py-2 px-4 text-xs font-bold flex-1 justify-center"
                style={{ background: 'var(--accent)' }}
              >
                {programBusy ? 'جارٍ الحفظ...' : 'إضافة للجدول'}
              </button>
              <button 
                type="button" 
                onClick={() => setIsAddProgramOpen(false)}
                className="btn btn-secondary py-2 px-4 text-xs font-bold flex-1 justify-center"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcement Read More Modal */}
      {selectedAnn && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-[999]" onClick={() => setSelectedAnn(null)}>
          <div className="modal-panel w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-line bg-cream-50/50">
              <h3 className="font-bold text-base text-ink-900">{selectedAnn.title}</h3>
              <button type="button" onClick={() => setSelectedAnn(null)} className="text-ink-400 hover:text-ink-900 text-2xl font-bold leading-none">×</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-right text-xs scroll-soft">
              {selectedAnn.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-ink-150 mb-3 bg-black/5 max-h-[250px] flex items-center justify-center">
                  <img src={selectedAnn.imageUrl} alt="Announcement Attachment" className="max-w-full max-h-[250px] object-contain" />
                </div>
              )}
              <p className="text-sm text-ink-850 whitespace-pre-wrap leading-relaxed select-text">{selectedAnn.body}</p>
            </div>

            <div className="p-4 border-t border-line bg-cream-50/50 flex justify-between items-center text-[10px] text-ink-400 font-bold">
              <span>تم النشر في: {new Date(selectedAnn.createdAt).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <button 
                type="button" 
                onClick={() => setSelectedAnn(null)}
                className="btn btn-secondary py-1.5 px-4 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
