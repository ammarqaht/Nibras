'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { site } from '@/content';
import { useStudent } from './context';

type ScheduleItem = { id: string; title: string; startTime: string; endTime: string; role: string; notes?: string | null };
type AttendanceItem = { id: number; date: string; status: string };
type TaskPeek = {
  task: { id: string; title: string; description: string; maxPoints: number; dueDate: string; track: string | null };
  submission: { id: string; status: string; grade: number | null; feedback: string | null; fileUrl: string; submittedAt: string } | null;
};
type PointRec = { id: number; delta: number; reason: string; category: string; pointType: string; createdAt: string };
type FamilyPeek = { group: { id: number; name: string; stage: string } | null };

const CATEGORY_LABELS: Record<string, string> = {
  attendance: 'الحضور', tasks: 'المهام', social: 'اجتماعية', cultural: 'ثقافية',
  scientific: 'علمية', sports: 'رياضية', media: 'إعلامية', general: 'عام', behavior: 'سلوك',
};

const ROLE_LABELS: Record<string, string> = {
  social_supervisor: 'اجتماعية',
  cultural_supervisor: 'ثقافية',
  scientific_supervisor: 'علمية',
  sports_supervisor: 'رياضية',
  media_supervisor: 'إعلامية',
  general_supervisor: 'عام',
  stage_supervisor: 'مرحلة',
};

const ROLE_COLORS: Record<string, string> = {
  social_supervisor: '#E52E25',
  cultural_supervisor: '#22c55e',
  scientific_supervisor: '#103F91',
  sports_supervisor: '#FF9F1C',
  media_supervisor: '#12B3D5',
  general_supervisor: '#6B6B6B',
  stage_supervisor: '#7c3aed',
};

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (reduce || !Number.isFinite(target)) { setValue(target); return; }
    const start = performance.now();
    const from = 0;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);
  return value;
}

function StatTile({ label, value, accent, icon, onClick }: { label: string; value: number; accent: string; icon: React.ReactNode; onClick?: () => void }) {
  const v = useCountUp(value);
  return (
    <div
      className="stat-tile"
      style={{ ['--tile-accent' as any]: accent, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }) : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
          style={{ background: `${accent}1A`, color: accent }}
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>{label}</span>
      </div>
      <p className="font-display tabular-nums text-3xl font-bold leading-none" style={{ color: 'var(--ink)' }}>
        {v}
      </p>
      {onClick && <p className="text-[10px] mt-1 font-medium" style={{ color: accent }}>اضغط للتفاصيل ←</p>}
    </div>
  );
}

function formatMembership(n: number) {
  const s = String(n);
  // group every 4 digits for card-number feel: 1001 -> 1001, 10010 -> 1 0010
  if (s.length <= 4) return s;
  return s.replace(/(\d)(?=(\d{4})+$)/g, '$1 ');
}

export default function StudentHome() {
  const { user } = useStudent();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [tasks, setTasks] = useState<TaskPeek[]>([]);
  const [points, setPoints] = useState<PointRec[]>([]);
  const [family, setFamily] = useState<FamilyPeek | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loadingSched, setLoadingSched] = useState(true);
  const [loadingAtt, setLoadingAtt] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/student/schedule').then(r => r.json()).then(d => setSchedule(d.schedule || [])).finally(() => setLoadingSched(false));
    fetch('/api/student/attendance').then(r => r.json()).then(d => setAttendance(d.attendance || [])).finally(() => setLoadingAtt(false));
    fetch('/api/student/tasks').then(r => r.json()).then(d => setTasks(d.tasks || [])).finally(() => setLoadingTasks(false));
    fetch('/api/student/points').then(r => r.json()).then(d => setPoints(d.points || []));
    fetch('/api/student/family').then(r => r.json()).then(d => setFamily(d));
  }, []);

  // Toggle .is-in on .reveal children when in view (lightweight motion)
  useEffect(() => {
    if (!revealRef.current) return;
    const els = revealRef.current.querySelectorAll('.reveal');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const totalSessions = attendance.length;
  const attendancePct = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 0;

  // Individual points breakdown (attendance vs tasks vs other)
  const indivAttendance = points.filter(p => p.pointType === 'individual' && p.category === 'attendance').reduce((a, p) => a + p.delta, 0);
  const indivTasks = points.filter(p => p.pointType === 'individual' && p.category === 'tasks').reduce((a, p) => a + p.delta, 0);
  const indivOther = (user?.individual ?? 0) - indivAttendance - indivTasks;
  const ledger = [...points].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  // Active tasks not yet submitted, ordered by due date asc
  const activeNotSubmitted = tasks
    .filter(t => !t.submission)
    .sort((a, b) => +new Date(a.task.dueDate) - +new Date(b.task.dueDate))
    .slice(0, 3);

  const groupLabel = family?.group ? family.group.name : 'بدون أسرة';

  return (
    <div ref={revealRef} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 1. Membership card hero */}
      {user && (
        <section className="reveal-hero is-in">
          <div className="membership-card relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logos.icon} alt="" aria-hidden className="mc-watermark select-none" draggable={false} />

            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.18em] uppercase opacity-80 mb-2">بطاقة الطالب</p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
                  {user.name}
                </h1>
                <p className="text-sm opacity-85 mt-1">
                  {user.stage} <span className="opacity-50">·</span> {user.grade}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.logos.iconHorizontal} alt="" className="h-8 w-auto opacity-90 select-none" draggable={false} />
            </div>

            <div className="relative mt-7 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-widest opacity-70 mb-1">رقم العضوية</p>
                <p
                  dir="ltr"
                  className="font-mono tabular-nums text-xl sm:text-2xl font-bold"
                  style={{ letterSpacing: '0.18em' }}
                >
                  {formatMembership(user.membershipNo)}
                </p>
              </div>
              <div className="text-end">
                <p className="text-[11px] opacity-70 mb-1">الأسرة</p>
                <p className="text-sm font-bold">{groupLabel}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Points card — jewel tiles */}
      {user && (
        <section className="reveal">
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>النقاط</h2>
            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>تجمع حسب نوع النقطة</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="فردي"
              value={user.individual}
              accent="#FF9F1C"
              onClick={() => setShowBreakdown(true)}
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>}
            />
            <StatTile
              label="جماعي"
              value={user.collective}
              accent="#12B3D5"
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2 20a7 7 0 0 1 14 0M14 20a5 5 0 0 1 8-4"/></svg>}
            />
            <StatTile
              label="الرصيد"
              value={user.balance}
              accent="#1B7A43"
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 7h18v10H3z"/><path d="M3 11h18M7 15h3"/></svg>}
            />
            <StatTile
              label="الإجمالي"
              value={user.rankScore}
              accent="#103F91"
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 3l2.5 5.5L20 9.3l-4 4 1 5.7L12 16l-5 3 1-5.7-4-4 5.5-.8z"/></svg>}
            />
          </div>
        </section>
      )}

      {/* 3. Today's schedule timeline */}
      <section className="reveal">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>جدول اليوم</h2>
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="card p-4">
          {loadingSched ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
            </div>
          ) : schedule.length === 0 ? (
            <EmptyState emoji="🌤" line="لا يوجد برنامج محدد لليوم — استمتع بيومك." />
          ) : (
            <ol className="relative space-y-3">
              {schedule.map((item, idx) => {
                const color = ROLE_COLORS[item.role] || 'var(--ink-soft)';
                const label = ROLE_LABELS[item.role] || item.role;
                return (
                  <li key={item.id} className="flex gap-3 items-stretch">
                    <div className="relative flex flex-col items-center">
                      <span className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: color }} />
                      {idx < schedule.length - 1 && (
                        <span className="flex-1 w-px mt-1" style={{ background: 'var(--line)' }} />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{item.title}</p>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${color}14`, color }}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="tabular-nums text-xs mt-1" style={{ color: 'var(--ink-soft)' }} dir="ltr">
                        {item.startTime} – {item.endTime}
                      </p>
                      {item.notes && <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>{item.notes}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      {/* 4. Tasks peek */}
      <section className="reveal">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>المهام</h2>
          <Link href="/student/tasks" className="text-xs font-medium" style={{ color: 'var(--accent-deep)' }}>عرض الكل ←</Link>
        </div>
        {loadingTasks ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 70 }} />)}
          </div>
        ) : activeNotSubmitted.length === 0 ? (
          <div className="card p-5">
            <EmptyState emoji="✨" line="لا توجد مهام معلّقة — أحسنت!" />
          </div>
        ) : (
          <div className="space-y-2">
            {activeNotSubmitted.map(item => {
              const due = new Date(item.task.dueDate);
              return (
                <Link
                  key={item.task.id}
                  href="/student/tasks"
                  className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>{item.task.title}</p>
                      {item.task.track && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#FBF6EC', color: 'var(--accent-deep)' }}>
                          {item.task.track}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                      الموعد: <span dir="ltr">{due.toLocaleDateString('ar-SA')}</span> · {item.task.maxPoints} نقطة
                    </p>
                  </div>
                  <span className="pill pill-blue">لم يُسلَّم</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Balance ledger */}
      <section className="reveal">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>سجل الرصيد</h2>
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{ledger.length} حركة</span>
        </div>
        <div className="card p-0 overflow-hidden">
          {ledger.length === 0 ? (
            <div className="p-5"><EmptyState emoji="🧾" line="لا توجد حركات على رصيدك بعد." /></div>
          ) : (
            <ul className="divide-y" style={{ ['--tw-divide-color' as any]: 'var(--line)' }}>
              {ledger.slice(0, 15).map(p => {
                const positive = p.delta >= 0;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-10 h-9 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums shrink-0"
                      style={{ background: positive ? '#E7F6EC' : '#FDEAE6', color: positive ? '#1B7A43' : '#C42910' }}>
                      {positive ? '+' : ''}{p.delta}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{p.reason}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                        {CATEGORY_LABELS[p.category] || p.category} · <span dir="ltr">{new Date(p.createdAt).toLocaleDateString('ar-SA')}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 6. Attendance chips — subtle */}
      {!loadingAtt && totalSessions > 0 && (
        <section className="reveal">
          <div className="card p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-display text-base font-bold" style={{ color: 'var(--ink)' }}>الحضور</h3>
              <span className="tabular-nums text-xs font-medium" style={{ color: 'var(--ink-soft)' }}>{attendancePct}% التزام</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'حضر', count: presentCount, color: '#1B7A43', bg: '#E7F6EC' },
                { label: 'متأخر', count: lateCount, color: '#854D0E', bg: '#FEF9C3' },
                { label: 'غاب', count: absentCount, color: '#C42910', bg: '#FDEAE6' },
              ].map(item => (
                <div key={item.label} className="rounded-xl py-2 text-center" style={{ background: item.bg }}>
                  <p className="font-display tabular-nums text-xl font-bold" style={{ color: item.color }}>{item.count}</p>
                  <p className="text-[11px] font-medium" style={{ color: item.color }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Individual points breakdown */}
      {showBreakdown && user && (
        <div className="modal-backdrop flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={() => setShowBreakdown(false)}>
          <div className="modal-panel w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <h3 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>تفاصيل النقاط الفردية</h3>
              <button onClick={() => setShowBreakdown(false)} className="btn btn-ghost p-2" aria-label="إغلاق">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'نقاط الحضور', value: indivAttendance, color: '#1B7A43', bg: '#E7F6EC', icon: '🕌' },
                { label: 'نقاط المهام', value: indivTasks, color: '#FF9F1C', bg: '#FFF4E0', icon: '🎯' },
                ...(indivOther !== 0 ? [{ label: 'نقاط أخرى', value: indivOther, color: '#103F91', bg: '#EAF0FB', icon: '⭐' }] : []),
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 rounded-xl p-3" style={{ background: row.bg }}>
                  <span className="text-xl">{row.icon}</span>
                  <span className="flex-1 text-sm font-bold" style={{ color: row.color }}>{row.label}</span>
                  <span className="font-display tabular-nums text-xl font-bold" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>إجمالي الفردي</span>
                <span className="font-display tabular-nums text-2xl font-bold" style={{ color: 'var(--ink)' }}>{user.individual}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ emoji, line }: { emoji: string; line: string }) {
  return (
    <div className="text-center py-4">
      <p className="text-3xl mb-1.5">{emoji}</p>
      <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{line}</p>
    </div>
  );
}
