'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSupervisor } from '@/components/SupervisorShell';

const ROLE_MAP: Record<string, string> = {
  admin: 'مدير عام',
  finance: 'مسؤول المالية',
  attendance_supervisor: 'مشرف تحضير',
  social_supervisor: 'مشرف اجتماعية',
  cultural_supervisor: 'مشرف ثقافية',
  groups_supervisor: 'مشرف أسر',
  general_supervisor: 'مشرف عام',
  finance_supervisor: 'مسؤول المالية',
  media_supervisor: 'مسؤول الإعلامية'
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

export default function DashboardHome() {
  const { user } = useSupervisor();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supervisor/dashboard/stats', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const roles = user?.role ? user.role.split(',').map((r) => r.trim()) : [];
  const perms = user?.permissions || [];
  
  const hasPerm = (p: string) => perms.includes('*') || perms.includes(p);

  // Build active quick links dynamically
  const quickLinks = [
    { href: '/supervisor/students', label: 'إدارة الطلاب', show: hasPerm('students') },
    { href: '/supervisor/attendance', label: 'تسجيل الحضور', show: hasPerm('attendance') },
    { href: '/supervisor/points', label: 'رصد النقاط والجوائز', show: hasPerm('points') },
    { href: '/supervisor/tasks', label: 'إدارة المهام', show: hasPerm('tasks') },
    { href: '/supervisor/schedule', label: 'جدول البرامج', show: hasPerm('schedule') },
    { href: '/supervisor/groups', label: 'إدارة المجموعات والأسر', show: hasPerm('groups') },
    { href: '/supervisor/payments', label: 'مراجعة المدفوعات', show: hasPerm('payments') },
    { href: '/supervisor/invoices', label: 'إضافة وإدارة الفواتير', show: hasPerm('invoices') },
    { href: '/supervisor/finance', label: 'التقارير المالية', show: hasPerm('finance') },
    { href: '/supervisor/announcements', label: 'نشر إعلان جديد', show: hasPerm('announcements') },
    { href: '/supervisor/supervisors', label: 'إدارة الحسابات والصلاحيات', show: hasPerm('supervisors') }
  ].filter(link => link.show);

  return (
    <div className="font-sans text-right" dir="rtl">
      {/* 1. Header & Welcome Card */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">لوحة التحكم</h1>
        <p className="text-ink-500 text-sm">مرحباً بك في نظام إدارة نادي نبراس.</p>
      </div>

      <div className="card p-6 bg-gradient-to-l from-cream-100/40 to-brand-50/20 border border-ink-150 relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-1.5 h-full bg-brand" />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-cream-100 border border-ink-200 flex items-center justify-center text-brand-700 text-2xl font-bold shadow-inner shrink-0">
            {user?.name.charAt(0) || 'م'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900 mb-1">أهلاً بك، {user?.name}</h2>
            <p className="text-sm text-ink-500 flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-brand/10 text-brand text-[10px]">👤</span>
              الدور الحالي: <span className="font-semibold text-brand">{getRoleLabel(user?.role || '')}</span>
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-400 text-sm">جارٍ تحميل الإحصائيات الذكية…</div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick Links Section */}
          {quickLinks.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-bold text-ink-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                الوصول السريع
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-xl border border-ink-150 bg-white hover:bg-cream-50/50 hover:border-brand-300 hover:shadow-sm transition-all text-sm font-semibold text-ink-800"
                  >
                    <span>{link.label}</span>
                    <span className="text-brand-600">←</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Overviews grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* 1. Students Overview */}
            {hasPerm('students') && stats?.students && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>👥</span> نظرة سريعة: الطلاب
                </h3>
                <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100">
                    <div className="text-xl font-bold text-blue-600">{stats.students.total}</div>
                    <div className="text-xs text-ink-500">إجمالي المسجلين</div>
                  </div>
                  <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100">
                    <div className="text-xl font-bold text-green-600">{stats.students.approved}</div>
                    <div className="text-xs text-ink-500">طالب مقبول</div>
                  </div>
                </div>
                {stats.students.pending > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700 text-center font-semibold">
                    يوجد {stats.students.pending} طلب بانتظار المراجعة!
                  </div>
                )}
                {stats.students.conditions > 0 && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 text-center font-semibold">
                    يوجد {stats.students.conditions} حالة صحية مسجلة!
                  </div>
                )}
              </div>
            )}

            {/* 2. Attendance Overview */}
            {hasPerm('attendance') && stats?.attendance && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-cyan-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>📝</span> نظرة سريعة: الحضور
                </h3>
                <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100 flex flex-col justify-center">
                    <div className="text-xl font-bold text-cyan-600">
                      {Math.round((stats.attendance.presentToday / stats.attendance.activeBase) * 100)}%
                    </div>
                    <div className="text-xs text-ink-500">نسبة حضور اليوم</div>
                  </div>
                  <div className="grid grid-rows-2 gap-2">
                    <div className="bg-green-50 rounded p-1.5 text-center text-green-700 text-xs font-bold border border-green-100">
                      حاضر: {stats.attendance.presentToday}
                    </div>
                    <div className="bg-red-50 rounded p-1.5 text-center text-red-700 text-xs font-bold border border-red-100">
                      غائب: {stats.attendance.absentToday}
                    </div>
                  </div>
                </div>
                <Link href="/supervisor/attendance" className="btn btn-secondary mt-3 text-xs justify-center">
                  سجل الحضور الآن ←
                </Link>
              </div>
            )}

            {/* 3. Points Overview */}
            {hasPerm('points') && stats?.points && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-yellow-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>⭐</span> نظرة سريعة: النقاط
                </h3>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-cream-50 rounded-lg border border-ink-100">
                    <span className="text-sm text-ink-600 font-bold">نقاط اليوم:</span>
                    <span className="text-lg font-bold text-yellow-600">{stats.points.today}</span>
                  </div>
                  {stats.points.topGroup && (
                    <div className="p-3 bg-brand-50/30 rounded-lg border border-brand-100">
                      <div className="text-xs text-ink-500 mb-1">الأسرة المتصدرة 🥇</div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-brand-700">{stats.points.topGroup}</span>
                        <span className="text-xs font-bold bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full">{stats.points.topGroupPoints} نقطة</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Tasks Overview */}
            {hasPerm('tasks') && stats?.tasks && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-purple-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>🎯</span> نظرة سريعة: المهام
                </h3>
                <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100">
                    <div className="text-xl font-bold text-purple-600">{stats.tasks.active}</div>
                    <div className="text-xs text-ink-500">مهمة نشطة</div>
                  </div>
                  <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100">
                    <div className="text-xl font-bold text-orange-500">{stats.tasks.pendingReview}</div>
                    <div className="text-xs text-ink-500">بانتظار التقييم</div>
                  </div>
                </div>
                {stats.tasks.pendingReview > 0 && (
                  <Link href="/supervisor/tasks" className="btn btn-secondary mt-3 text-xs justify-center">
                    قيم تسليمات الطلاب ←
                  </Link>
                )}
              </div>
            )}

            {/* 5. Schedule Overview */}
            {hasPerm('schedule') && stats?.schedule && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-pink-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>📅</span> نظرة سريعة: الجدول
                </h3>
                <div className="flex-1 flex flex-col justify-center space-y-3">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-pink-600">{stats.schedule.todayCount}</span>
                    <span className="text-sm text-ink-500 block">برامج مجدولة لليوم</span>
                  </div>
                  {stats.schedule.nextProgramTitle ? (
                    <div className="p-2 bg-pink-50 border border-pink-100 rounded text-center text-xs">
                      <span className="text-pink-600 block mb-1">البرنامج القادم:</span>
                      <span className="font-bold text-pink-800">{stats.schedule.nextProgramTitle}</span>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-ink-400">لا توجد برامج قادمة اليوم</div>
                  )}
                </div>
              </div>
            )}

            {/* 6. Payments Overview */}
            {hasPerm('payments') && stats?.payments && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>💸</span> نظرة سريعة: المدفوعات
                </h3>
                <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-cream-50 rounded-lg p-2 text-center border border-ink-100 flex flex-col justify-center">
                    <div className="text-lg font-bold text-emerald-600">{stats.payments.paid}</div>
                    <div className="text-[10px] text-ink-500 font-bold">مدفوع ومؤكد</div>
                  </div>
                  <div className="bg-cream-50 rounded-lg p-2 text-center border border-ink-100 flex flex-col justify-center">
                    <div className="text-lg font-bold text-emerald-600">{stats.payments.exempted || 0}</div>
                    <div className="text-[10px] text-ink-500 font-bold">معفي من الرسوم</div>
                  </div>
                  <div className="bg-cream-50 rounded-lg p-2 text-center border border-ink-100 flex flex-col justify-center">
                    <div className="text-lg font-bold text-orange-500">{stats.payments.pendingReview}</div>
                    <div className="text-[10px] text-ink-500 font-bold">بانتظار المراجعة</div>
                  </div>
                </div>
                {stats.payments.pendingReview > 0 && (
                  <Link href="/supervisor/payments" className="btn btn-secondary mt-3 text-xs justify-center border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100">
                    مراجعة إيصالات التحويل ←
                  </Link>
                )}
              </div>
            )}

            {/* 7. Invoices Overview */}
            {hasPerm('invoices') && stats?.invoices && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>🧾</span> نظرة سريعة: الفواتير
                </h3>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-cream-50 rounded-lg border border-ink-100">
                    <span className="text-sm text-ink-600 font-bold">المصروفات المعتمدة:</span>
                    <span className="text-lg font-bold text-indigo-600 tabular-nums">{stats.invoices.totalSpent} ﷼</span>
                  </div>
                  {stats.invoices.pendingReview > 0 && (
                    <div className="p-2 bg-yellow-50 rounded text-xs text-yellow-700 text-center font-semibold">
                      يوجد {stats.invoices.pendingReview} فواتير بانتظار الاعتماد والمراجعة!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. Announcements Overview */}
            {hasPerm('announcements') && stats?.announcements && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-teal-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>📢</span> نظرة سريعة: الإعلانات
                </h3>
                <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-teal-600">{stats.announcements.total}</span>
                    <span className="text-sm text-ink-500 block">إعلان منشور حالياً</span>
                  </div>
                  <Link href="/supervisor/announcements" className="btn btn-secondary text-xs">
                    إدارة الإعلانات ←
                  </Link>
                </div>
              </div>
            )}

            {/* 9. Groups Overview */}
            {hasPerm('groups') && stats?.groups && (
              <div className="card p-5 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-1 h-full bg-orange-500" />
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                  <span>🏕️</span> نظرة سريعة: الأسر والمجموعات
                </h3>
                <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-orange-600">{stats.groups.total}</span>
                    <span className="text-sm text-ink-500 block">مجموعة / أسرة مسجلة</span>
                  </div>
                  <Link href="/supervisor/groups" className="btn btn-secondary text-xs">
                    استعرض الأسر ←
                  </Link>
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
