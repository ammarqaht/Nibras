'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  stage_supervisor: 'مشرف مرحلة'
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
  { key: 'sports_supervisor', label: 'اللجنة الرياضية', color: 'border-orange-500 text-orange-700 bg-orange-50' }
];

const DEFAULT_SLOTS = [
  { label: 'الفقرة الأولى (04:30 م - 05:30 م)', start: '16:30', end: '17:30' },
  { label: 'الفقرة الثانية (05:30 م - 06:30 م)', start: '17:30', end: '18:30' },
  { label: 'الفقرة الثالثة (07:30 م - 08:45 م)', start: '19:30', end: '20:45' }
];

// ─── Role Actions ─────────────────────────────────────────────────────────────
type ActionItem = { href: string; label: string; color: string; icon: React.ReactNode };

function ActionCard({ href, label, color, icon }: ActionItem) {
  return (
    <Link href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-transparent bg-white hover:border-current hover:shadow-sm transition-all text-center group"
      style={{ '--tw-text-opacity': 1 } as React.CSSProperties}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18', color }}>
        {icon}
      </div>
      <span className="text-xs font-bold text-ink-800 group-hover:text-ink-900 leading-tight">{label}</span>
    </Link>
  );
}

function RoleActions({ roles, hasPerm }: { roles: string[]; hasPerm: (p: string) => boolean }) {
  const isAdmin  = roles.includes('admin');
  const isFinance = roles.some(r => ['finance','finance_supervisor'].includes(r));
  const isAttendance = roles.includes('attendance_supervisor');
  const isGeneral = roles.includes('general_supervisor');
  const isGroups  = roles.includes('groups_supervisor');
  const isStage   = roles.includes('stage_supervisor');
  const isMedia   = roles.includes('media_supervisor');
  const isPoints  = roles.some(r => ['social_supervisor','cultural_supervisor','scientific_supervisor','sports_supervisor'].includes(r));

  const iconAttendance = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 9 2 2 4-4" /></svg>;
  const iconPoints     = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
  const iconSchedule   = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
  const iconStudents   = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.72m0 0-.003-.031a6.062 6.062 0 0 1 3.518-5.563 3 3 0 1 1 4.966 0 6.062 6.062 0 0 1 3.518 5.563" /></svg>;
  const iconFinance    = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>;
  const iconInvoice    = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>;
  const iconAnn        = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>;
  const iconGroups     = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
  const iconAnalytics  = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>;
  const iconTasks      = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" /></svg>;
  const iconPayments   = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>;
  const iconSupervisors = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>;

  let actions: ActionItem[] = [];

  if (isAdmin) {
    actions = [
      { href:'/supervisor/students',    label:'إدارة الطلاب',       color:'#22c55e', icon: iconStudents },
      { href:'/supervisor/attendance',  label:'تسجيل الحضور',       color:'#FF9F1C', icon: iconAttendance },
      { href:'/supervisor/schedule',    label:'الجدول الأسبوعي',    color:'#103F91', icon: iconSchedule },
      { href:'/supervisor/analytics',   label:'الإحصائيات',          color:'#12B3D5', icon: iconAnalytics },
      { href:'/supervisor/supervisors', label:'إدارة المشرفين',     color:'#8b5cf6', icon: iconSupervisors },
    ];
  } else if (isFinance) {
    actions = [
      { href:'/supervisor/payments', label:'مراجعة المدفوعات', color:'#ef4444', icon: iconPayments },
      { href:'/supervisor/invoices', label:'إضافة فاتورة',     color:'#f59e0b', icon: iconInvoice },
      { href:'/supervisor/finance',  label:'التقارير المالية', color:'#10b981', icon: iconFinance },
    ];
  } else if (isAttendance) {
    actions = [
      { href:'/supervisor/attendance', label:'تسجيل الحضور', color:'#FF9F1C', icon: iconAttendance },
      { href:'/supervisor/analytics',  label:'الإحصائيات',    color:'#12B3D5', icon: iconAnalytics },
    ];
  } else if (isGeneral) {
    actions = [
      { href:'/supervisor/attendance', label:'تسجيل الحضور',  color:'#FF9F1C', icon: iconAttendance },
      { href:'/supervisor/points',     label:'رصد النقاط',     color:'#f59e0b', icon: iconPoints },
      { href:'/supervisor/tasks',      label:'إدارة المهام',   color:'#8b5cf6', icon: iconTasks },
      { href:'/supervisor/schedule',   label:'الجدول',         color:'#103F91', icon: iconSchedule },
    ];
  } else if (isPoints) {
    actions = [
      { href:'/supervisor/points',   label:'رصد النقاط',  color:'#f59e0b', icon: iconPoints },
      { href:'/supervisor/schedule', label:'الجدول',      color:'#103F91', icon: iconSchedule },
      { href:'/supervisor/tasks',    label:'المهام',       color:'#8b5cf6', icon: iconTasks },
    ];
  } else if (isGroups) {
    actions = [
      { href:'/supervisor/groups',   label:'إدارة الأسر',  color:'#12B3D5', icon: iconGroups },
      { href:'/supervisor/points',   label:'رصد النقاط',   color:'#f59e0b', icon: iconPoints },
      { href:'/supervisor/schedule', label:'الجدول',       color:'#103F91', icon: iconSchedule },
    ];
  } else if (isStage) {
    actions = [
      { href:'/supervisor/groups',   label:'مجموعات المرحلة', color:'#12B3D5', icon: iconGroups },
      { href:'/supervisor/points',   label:'رصد النقاط',       color:'#f59e0b', icon: iconPoints },
      { href:'/supervisor/analytics', label:'الإحصائيات',      color:'#103F91', icon: iconAnalytics },
    ];
  } else if (isMedia) {
    actions = [
      { href:'/supervisor/announcements', label:'نشر إعلان',   color:'#12B3D5', icon: iconAnn },
      { href:'/supervisor/schedule',      label:'الجدول',       color:'#103F91', icon: iconSchedule },
      { href:'/supervisor/tasks',         label:'المهام',        color:'#8b5cf6', icon: iconTasks },
    ];
  } else {
    // fallback: any allowed links
    actions = hasPerm('attendance') ? [{ href:'/supervisor/attendance', label:'تسجيل الحضور', color:'#FF9F1C', icon: iconAttendance }] : [];
  }

  if (actions.length === 0) return null;

  return (
    <div className="card p-5">
      <h2 className="text-sm font-bold text-ink-900 mb-4 flex items-center gap-1.5">
        <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        إجراءات سريعة
      </h2>
      <div className={`grid gap-3 ${actions.length <= 3 ? 'grid-cols-3' : actions.length === 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
        {actions.map(a => <ActionCard key={a.href} {...a} />)}
      </div>
    </div>
  );
}

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

function AttStatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl py-2 px-1"
      style={{background:`${color}12`, border:`1px solid ${color}25`}}>
      <span className="text-sm font-bold" style={{color}}>{value}</span>
      <span className="text-[9px] text-ink-400">{label}</span>
    </div>
  );
}

function AttendanceGrid({ label, present, late, excused, absent, color = 'var(--accent)' }: {
  label: string; present: number; late: number; excused: number; absent: number; color?: string;
}) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1.5 h-full" style={{ backgroundColor: color }} />
      <div className="text-xs text-ink-500 font-bold mb-3">{label}</div>
      <div className="grid grid-cols-4 gap-1.5">
        <AttStatBox label="حاضر"  value={present}  color="#1B7A43"/>
        <AttStatBox label="متأخر" value={late}     color="#FF9F1C"/>
        <AttStatBox label="معتذر" value={excused}  color="#103F91"/>
        <AttStatBox label="غائب"  value={absent}   color="#E52E25"/>
      </div>
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
  const overallPresent  = stats?.attendanceOverall?.presentToday  ?? 0;
  const overallLate    = stats?.attendanceOverall?.lateToday     ?? 0;
  const overallExcused = stats?.attendanceOverall?.excusedToday  ?? 0;
  const overallAbsent  = stats?.attendanceOverall?.absentToday   ?? 0;

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
        <AttendanceGrid
          label="حضور اليوم"
          present={overallPresent} late={overallLate} excused={overallExcused} absent={overallAbsent}
        />
      </div>
    );
  }

  if (isGeneralRole) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 max-w-sm">
        <AttendanceGrid
          label="حضور اليوم"
          present={overallPresent} late={overallLate} excused={overallExcused} absent={overallAbsent}
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
        <AttendanceGrid
          label="حضور اليوم"
          present={overallPresent} late={overallLate} excused={overallExcused} absent={overallAbsent}
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
        <AttendanceGrid
          label="حضور اليوم"
          present={overallPresent} late={overallLate} excused={overallExcused} absent={overallAbsent}
        />
        <NextProgramCard program={stats?.nextCommitteeProgram ?? null} />
      </div>
    );
  }

  // Groups supervisor
  if (isGroupsRole) {
    const gs = stats?.groupStats;
    const myPresent = stats?.attendance?.presentToday ?? 0;
    const myLate    = stats?.attendance?.lateToday    ?? 0;
    const myAbsent  = stats?.attendance?.absentToday  ?? 0;
    const myExcused = stats?.attendance?.excusedToday ?? 0;
    const myTotal = myPresent + myLate + myAbsent + myExcused;
    const myPct = myTotal > 0 ? Math.round((myPresent + myLate) / myTotal * 100) : 0;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SmallCard accent="#22c55e"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.7199m0 0-.003-.031a6.062 6.062 0 0 1 3.518-5.563 3 3 0 1 1 4.966 0 6.062 6.062 0 0 1 3.518 5.563" /></svg>}
          label="طلاب الأسرة" value={stats?.myStudents?.length ?? 0} sub="إجمالي طلاب أسرتك"
        />
        <AttendanceGrid
          label="حضور الأسرة اليوم"
          present={myPresent} late={myLate} excused={myExcused} absent={myAbsent}
          color="#12B3D5"
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
    const sl = ss?.attendanceToday?.late    ?? 0;
    const se = ss?.attendanceToday?.excused ?? 0;
    const sa = ss?.attendanceToday?.absent  ?? 0;
    const st = sp + sl + se + sa;
    const spct = st > 0 ? Math.round((sp + sl) / st * 100) : 0;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SmallCard accent="#22c55e"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.7199m0 0-.003-.031a6.062 6.062 0 0 1 3.518-5.563 3 3 0 1 1 4.966 0 6.062 6.062 0 0 1 3.518 5.563" /></svg>}
          label={`طلاب مرحلة ${ss?.stageName ?? ''} المقبولين`} value={ss?.approvedCount ?? 0} sub="طالب مقبول في مرحلتك"
        />
        <AttendanceGrid
          label="حضور المرحلة اليوم"
          present={sp} late={sl} excused={se} absent={sa}
          color="#103F91"
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

// ─── Quick Nav ────────────────────────────────────────────────────────────────
const IcoAnalytics  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>;
const IcoSchedule   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const IcoAttendance = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 9 2 2 4-4" /></svg>;
const IcoPoints     = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
const IcoTasks      = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" /></svg>;
const IcoGroups     = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
const IcoPayments   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>;
const IcoInvoices   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>;
const IcoFinance    = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>;
const IcoAnn        = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>;
const IcoStudents   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.72m0 0-.003-.031a6.062 6.062 0 0 1 3.518-5.563 3 3 0 1 1 4.966 0 6.062 6.062 0 0 1 3.518 5.563" /></svg>;
const IcoSupervisors= () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>;

const NAV_ITEMS = [
  { id:'analytics',     href:'/supervisor/analytics',     label:'الإحصائيات',  Icon: IcoAnalytics,  always: true },
  { id:'schedule',      href:'/supervisor/schedule',      label:'الجدول',       Icon: IcoSchedule,   always: true },
  { id:'attendance',    href:'/supervisor/attendance',    label:'الحضور',       Icon: IcoAttendance, perm:'attendance' },
  { id:'points',        href:'/supervisor/points',        label:'النقاط',       Icon: IcoPoints,     perm:'points' },
  { id:'tasks',         href:'/supervisor/tasks',         label:'المهام',       Icon: IcoTasks,      perm:'tasks' },
  { id:'groups',        href:'/supervisor/groups',        label:'المجموعات',    Icon: IcoGroups,     perm:'groups' },
  { id:'payments',      href:'/supervisor/payments',      label:'المدفوعات',    Icon: IcoPayments,   perm:'payments' },
  { id:'invoices',      href:'/supervisor/invoices',      label:'الفواتير',     Icon: IcoInvoices,   perm:'invoices' },
  { id:'finance',       href:'/supervisor/finance',       label:'المالية',      Icon: IcoFinance,    perm:'finance' },
  { id:'announcements', href:'/supervisor/announcements', label:'الإعلانات',    Icon: IcoAnn,        perm:'announcements' },
  { id:'students',      href:'/supervisor/students',      label:'الطلاب',       Icon: IcoStudents,   adminOnly: true },
  { id:'supervisors',   href:'/supervisor/supervisors',   label:'المشرفون',     Icon: IcoSupervisors,adminOnly: true },
];

function QuickNav({ roles, hasPerm, isAdmin }: { roles: string[]; hasPerm: (p: string) => boolean; isAdmin: boolean }) {
  const allowed = NAV_ITEMS.filter(item => {
    if (item.always) return true;
    if (item.adminOnly) return isAdmin;
    if (item.perm) return hasPerm(item.perm);
    return false;
  });

  const storageKey = 'quicknav_hidden';
  const [hiddenIds, setHiddenIds] = React.useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [customizing, setCustomizing] = React.useState(false);

  const toggleHidden = (id: string) => {
    setHiddenIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const visible = allowed.filter(item => !hiddenIds.includes(item.id));
  if (allowed.length === 0) return null;

  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-ink-400 tracking-wide">الوصول السريع</p>
          <button
            onClick={() => setCustomizing(true)}
            className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-brand-600 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" /><circle cx="12" cy="12" r="3" />
            </svg>
            تخصيص
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {visible.map(item => (
            <Link key={item.id} href={item.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream-50 border border-ink-150 hover:bg-brand/5 hover:border-brand/30 hover:text-brand-700 transition-all text-xs font-semibold text-ink-700">
              <item.Icon />
              <span>{item.label}</span>
            </Link>
          ))}
          {visible.length === 0 && <p className="text-xs text-ink-400 py-1">كل الاختصارات مخفية — اضغط تخصيص لإظهارها</p>}
        </div>
      </div>

      {customizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden pop-in" dir="rtl">
            <div className="p-4 border-b border-ink-200 flex justify-between items-center bg-ink-50">
              <h3 className="font-bold text-ink-900 text-sm">تخصيص الوصول السريع</h3>
              <button onClick={() => setCustomizing(false)} className="text-ink-400 hover:text-ink-900 p-1 rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              <p className="text-[11px] text-ink-400 mb-3">حدّد الاختصارات التي تريد إخفاءها من الشريط:</p>
              {allowed.map(item => (
                <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream-50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-brand w-4 h-4"
                    checked={!hiddenIds.includes(item.id)}
                    onChange={() => toggleHidden(item.id)}
                  />
                  <item.Icon />
                  <span className="text-sm font-semibold text-ink-800">{item.label}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-ink-100">
              <button onClick={() => setCustomizing(false)} className="btn btn-primary w-full text-sm">تم</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardHome() {
  const { user } = useSupervisor();
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Schedule stage filter
  const [scheduleStage, setScheduleStage] = useState<string>('ابتدائي');

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

  // Leaderboard toggle (stage supervisors)
  const [leaderboardDisabled, setLeaderboardDisabled] = useState(false);
  const [leaderboardBusy, setLeaderboardBusy] = useState(false);

  const perms = user?.permissions || [];
  const hasPerm = (p: string) => perms.includes('*') || perms.includes(p);

  const roles = user?.role ? user.role.split(',').map((r) => r.trim()) : [];

  const canSeeStudentDetails = roles.some((r) =>
    ['admin', 'general_supervisor', 'finance', 'finance_supervisor'].includes(r)
  );

  const isAdmin = roles.includes('admin');
  const isFinanceRole = roles.some(r => ['finance', 'finance_supervisor'].includes(r));
  const isAttendanceRole = roles.includes('attendance_supervisor');
  const isPointsRole = roles.some(r => ['social_supervisor', 'cultural_supervisor', 'scientific_supervisor', 'sports_supervisor'].includes(r));
  const isGroupsRole = roles.includes('groups_supervisor');
  const isGeneralRole = roles.includes('general_supervisor');
  const isStageRole = roles.includes('stage_supervisor');
  const isMediaRole = roles.includes('media_supervisor');
  const canAddPoints = isPointsRole;

  const isGlobal = roles.some((r) =>
    ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
  );

  const canAddProgram = isAdmin || roles.some(r => ['social_supervisor', 'cultural_supervisor', 'scientific_supervisor', 'sports_supervisor'].includes(r));
  const canPublishAnnouncements = hasPerm('announcements');

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
    if (!isStageRole || !user?.stage) return;
    fetch('/api/supervisor/leaderboard-settings')
      .then(r => r.json())
      .then(d => {
        const stages: string[] = d.disabledStages || [];
        setLeaderboardDisabled(stages.includes(user.stage || ''));
      })
      .catch(() => {});
  }, [isStageRole, user?.stage]);

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
    const { presentToday, lateToday = 0, activeBase } = stats.attendanceOverall;
    return Math.round(((presentToday + lateToday) / Math.max(activeBase, 1)) * 100);
  }, [stats]);

  const groupAttendancePercent = useMemo(() => {
    if (!stats?.attendance) return 0;
    const { presentToday, lateToday = 0, activeBase } = stats.attendance;
    return Math.round(((presentToday + lateToday) / Math.max(activeBase, 1)) * 100);
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
          
          {/* Quick Nav — role-based shortcuts */}
          <QuickNav roles={roles} hasPerm={hasPerm} isAdmin={isAdmin} />

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

          {/* Leaderboard toggle — stage supervisors only */}
          {isStageRole && user?.stage && (
            <div className="card p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-ink-900 text-sm">ترتيب الطلاب في بوابة الطلاب</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {leaderboardDisabled
                    ? `الترتيب مخفي عن طلاب مرحلة ${user.stage} حالياً`
                    : `الترتيب ظاهر لطلاب مرحلة ${user.stage} حالياً`}
                </p>
              </div>
              <button
                disabled={leaderboardBusy}
                onClick={async () => {
                  setLeaderboardBusy(true);
                  try {
                    const r = await fetch('/api/supervisor/leaderboard-settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ stage: user.stage, disabled: !leaderboardDisabled }),
                    });
                    if (r.ok) setLeaderboardDisabled(!leaderboardDisabled);
                  } finally {
                    setLeaderboardBusy(false);
                  }
                }}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${leaderboardDisabled ? 'bg-ink-300' : 'bg-green-500'}`}
                style={{ width: '3.25rem' }}
                role="switch"
                aria-checked={!leaderboardDisabled}
              >
                <span
                  className="inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200"
                  style={{ transform: leaderboardDisabled ? 'translateX(0)' : 'translateX(1.25rem)' }}
                />
              </button>
            </div>
          )}

          {/* Main Content Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Right main column (Timeline + Announcements) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Today's Schedule Widget */}
              <div className="card p-5 flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between border-b border-ink-100 pb-3 mb-3">
                  <h3 className="font-bold text-ink-900 flex items-center gap-2 text-base">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>جدول برامج اليوم</span>
                  </h3>
                  {canAddProgram && (
                    <button
                      onClick={() => {
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

                {/* Stage filter tabs */}
                <div className="flex gap-1.5 mb-4">
                  {(['ابتدائي','متوسط','ثانوي'] as const).map(s => {
                    const colors: Record<string,string> = { 'ابتدائي':'#12B3D5','متوسط':'#103F91','ثانوي':'#E52E25' };
                    const active = scheduleStage === s;
                    return (
                      <button key={s} onClick={() => setScheduleStage(s)}
                        className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition"
                        style={active ? { backgroundColor: colors[s], color:'#fff' } : { backgroundColor:'#f5f5f3', color:'#666' }}>
                        {s}
                      </button>
                    );
                  })}
                </div>

                {/* Programs grouped by time slot */}
                {(() => {
                  const allProgs: any[] = stats?.schedule?.todayPrograms ?? [];
                  const filtered = allProgs.filter(p => {
                    const st = p.stage || 'الكل';
                    return st === 'الكل' || st.split(',').map((x:string)=>x.trim()).includes(scheduleStage);
                  });

                  const slots = [
                    { label: 'الفقرة الأولى', from: '00:00', to: '17:29' },
                    { label: 'الفقرة الثانية', from: '17:30', to: '19:29' },
                    { label: 'الفقرة الثالثة', from: '19:30', to: '23:59' },
                  ];

                  const hasAny = filtered.length > 0;
                  if (!hasAny) return (
                    <div className="flex flex-col items-center justify-center py-14 text-ink-400 text-sm gap-2 flex-1">
                      <svg className="w-12 h-12 text-ink-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                      </svg>
                      <span>لا توجد برامج لمرحلة {scheduleStage} اليوم.</span>
                    </div>
                  );

                  return (
                    <div className="flex-1 space-y-5">
                      {slots.map(slot => {
                        const progs = filtered.filter(p => p.startTime >= slot.from && p.startTime <= slot.to);
                        if (progs.length === 0) return null;
                        return (
                          <div key={slot.label}>
                            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
                              {slot.label}
                            </p>
                            <div className="space-y-2">
                              {progs.map((prog: any, idx: number) => {
                                const roleStyle = SCHEDULE_ROLES.find(r => r.key === prog.role);
                                const roleLbl = roleStyle?.label || 'غير محدد';
                                const badgeColor = roleStyle?.color || 'bg-gray-100 text-gray-800 border-gray-200';
                                return (
                                  <div key={prog.id || idx} className="bg-white border border-ink-150 p-3.5 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                      <h4 className="font-bold text-sm text-ink-900">{prog.title}</h4>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}>{roleLbl}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-ink-500 font-semibold">
                                      <svg className="w-3.5 h-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                      </svg>
                                      <span>{prog.startTime} - {prog.endTime}</span>
                                    </div>
                                    {prog.notes && <p className="text-[11px] text-ink-400 mt-2 bg-cream-50/50 p-2 rounded-lg border border-ink-100">{prog.notes}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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

              {/* Quick Points Allocator Widget — only for roles with points permission */}
              {canAddPoints && <div className="card p-5 flex flex-col">
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
              </div>}

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
