'use client';

import { useEffect, useState } from 'react';
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

const ALL_LINKS = [
  { id: 'students', href: '/supervisor/students', label: 'إدارة الطلاب', perm: 'students' },
  { id: 'attendance', href: '/supervisor/attendance', label: 'تسجيل الحضور', perm: 'attendance' },
  { id: 'points', href: '/supervisor/points', label: 'رصد النقاط والجوائز', perm: 'points' },
  { id: 'tasks', href: '/supervisor/tasks', label: 'إدارة المهام', perm: 'tasks' },
  { id: 'schedule', href: '/supervisor/schedule', label: 'جدول البرامج', perm: 'schedule' },
  { id: 'groups', href: '/supervisor/groups', label: 'إدارة المجموعات والأسر', perm: 'groups' },
  { id: 'payments', href: '/supervisor/payments', label: 'مراجعة المدفوعات', perm: 'payments' },
  { id: 'invoices', href: '/supervisor/invoices', label: 'إضافة وإدارة الفواتير', perm: 'invoices' },
  { id: 'finance', href: '/supervisor/finance', label: 'التقارير المالية', perm: 'finance' },
  { id: 'announcements', href: '/supervisor/announcements', label: 'نشر إعلان جديد', perm: 'announcements' },
  { id: 'supervisors', href: '/supervisor/supervisors', label: 'إدارة الحسابات والصلاحيات', perm: 'supervisors' }
];

export default function DashboardHome() {
  const { user } = useSupervisor();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>([]);

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
  const isGlobal = roles.some((r) =>
    ['admin', 'finance', 'finance_supervisor', 'media_supervisor', 'cultural_supervisor', 'social_supervisor', 'general_supervisor', 'attendance_supervisor'].includes(r)
  );
  const perms = user?.permissions || [];
  
  const hasPerm = (p: string) => perms.includes('*') || perms.includes(p);

  const allowedLinks = ALL_LINKS.filter(link => hasPerm(link.perm));

  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem('nibras_quick_links');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          // Filter to make sure they still have permissions for saved ids
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
    // Default to all allowed links
    setSelectedLinkIds(allowedLinks.map(l => l.id));
  }, [user]);

  // Show only links that are both allowed by permissions AND selected by the user
  const quickLinks = allowedLinks.filter(link => selectedLinkIds.includes(link.id));

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
              <span className="flex items-center justify-center w-5 h-5 rounded bg-brand/10 text-brand">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
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
          {allowedLinks.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  الوصول السريع
                </h2>
                <button
                  onClick={() => {
                    setTempSelected(selectedLinkIds);
                    setCustomizing(true);
                  }}
                  className="btn btn-secondary py-1 px-2.5 text-xs flex items-center justify-center"
                  title="تخصيص الروابط"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              </div>

              {quickLinks.length === 0 ? (
                <p className="text-center py-6 text-ink-400 text-sm">
                  لم تقم باختيار أي روابط للوصول السريع بعد. اضغط على زر "تخصيص الروابط" أعلاه لاختيار الروابط المناسبة لك.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between p-3 rounded-xl border border-ink-150 bg-white hover:bg-cream-50/50 hover:border-brand-300 hover:shadow-sm transition-all text-sm font-semibold text-ink-800"
                    >
                      <span>{link.label}</span>
                      <svg className="w-4 h-4 text-brand-600 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Overviews grid */}
          {!isGlobal ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 1. Students of the Family */}
              <div className="card p-5 lg:col-span-2 flex flex-col h-[380px]">
                <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2 border-b border-ink-100 pb-2">
                  <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  <span>طلاب الأسرة / المجموعة ({stats?.myStudents?.length || 0})</span>
                </h3>
                <div className="flex-1 overflow-y-auto scroll-soft min-h-0 text-right">
                  {(!stats?.myStudents || stats.myStudents.length === 0) ? (
                    <p className="text-center py-16 text-ink-400 text-sm">لا يوجد طلاب مسجلين في أسرتك حالياً.</p>
                  ) : (
                    <table className="tbl text-sm">
                      <thead>
                        <tr>
                          <th className="text-right">الاسم</th>
                          <th className="text-right">المرحلة والصف</th>
                          <th className="text-right">رقم العضوية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.myStudents.map((s: any) => (
                          <tr key={s.id}>
                            <td className="font-semibold text-ink-900">{s.studentName}</td>
                            <td className="text-ink-600">{s.stage} — {s.grade}</td>
                            <td className="font-mono text-ink-500">#{s.membershipNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              
              {/* Stack of Attendance and Tasks */}
              <div className="space-y-6 lg:col-span-1">
                {/* 2. Attendance Overview */}
                <div className="card p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-1 h-full bg-cyan-500" />
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2 border-b border-ink-100 pb-2">
                    <svg className="w-5 h-5 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>حضور طلاب الأسرة اليوم</span>
                  </h3>
                  <div className="flex-1 grid grid-cols-2 gap-3 text-sm mt-2">
                    <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100 flex flex-col justify-center">
                      <div className="text-2xl font-bold text-cyan-600">
                        {stats?.attendance?.activeBase > 0 
                          ? `${Math.round((stats.attendance.presentToday / stats.attendance.activeBase) * 100)}%`
                          : '0%'}
                      </div>
                      <div className="text-[10px] text-ink-500 mt-1">نسبة حضور اليوم</div>
                    </div>
                    <div className="grid grid-rows-2 gap-2">
                      <div className="bg-green-50 rounded p-1.5 text-center text-green-700 text-xs font-bold border border-green-100">
                        حاضر: {stats?.attendance?.presentToday || 0}
                      </div>
                      <div className="bg-red-50 rounded p-1.5 text-center text-red-700 text-xs font-bold border border-red-100">
                        غائب: {stats?.attendance?.absentToday || 0}
                      </div>
                    </div>
                  </div>
                  <Link href="/supervisor/attendance" className="btn btn-secondary mt-4 text-xs justify-center flex items-center gap-1">
                    <span>سجل الحضور الآن</span>
                    <svg className="w-3.5 h-3.5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                </div>

                {/* 3. Tasks Overview */}
                <div className="card p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-1 h-full bg-purple-500" />
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2 border-b border-ink-100 pb-2">
                    <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                    <span>المهام والأنشطة</span>
                  </h3>
                  <div className="flex-1 grid grid-cols-2 gap-3 text-sm mt-2">
                    <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100">
                      <div className="text-2xl font-bold text-purple-600">{stats?.tasks?.active || 0}</div>
                      <div className="text-[10px] text-ink-500 mt-1">مهمة نشطة للمجموعة</div>
                    </div>
                    <div className="bg-cream-50 rounded-lg p-3 text-center border border-ink-100">
                      <div className="text-2xl font-bold text-orange-500">{stats?.tasks?.pendingReview || 0}</div>
                      <div className="text-[10px] text-ink-500 mt-1">تسليمات بانتظار التقييم</div>
                    </div>
                  </div>
                  <Link href="/supervisor/tasks" className="btn btn-secondary mt-4 text-xs justify-center flex items-center gap-1">
                    <span>عرض المهام والتقييم</span>
                    <svg className="w-3.5 h-3.5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* 1. Students Overview */}
              {hasPerm('students') && stats?.students && (
                <div className="card p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    نظرة سريعة: الطلاب
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
                    <svg className="w-5 h-5 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    نظرة سريعة: الحضور
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
                  <Link href="/supervisor/attendance" className="btn btn-secondary mt-3 text-xs justify-center flex items-center gap-1">
                    <span>سجل الحضور الآن</span>
                    <svg className="w-3.5 h-3.5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                </div>
              )}

              {/* 3. Points Overview */}
              {hasPerm('points') && stats?.points && (
                <div className="card p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-1 h-full bg-yellow-500" />
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    نظرة سريعة: النقاط
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
                    <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                    نظرة سريعة: المهام
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
                    <Link href="/supervisor/tasks" className="btn btn-secondary mt-3 text-xs justify-center flex items-center gap-1">
                      <span>قيم تسليمات الطلاب</span>
                      <svg className="w-3.5 h-3.5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  )}
                </div>
              )}

              {/* 5. Schedule Overview */}
              {hasPerm('schedule') && stats?.schedule && (
                <div className="card p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-1 h-full bg-pink-500" />
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    نظرة سريعة: الجدول
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
                    <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="M6 12h.01M18 12h.01" />
                    </svg>
                    نظرة سريعة: المدفوعات
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
                    <Link href="/supervisor/payments" className="btn btn-secondary mt-3 text-xs justify-center flex items-center gap-1 border-orange-250 bg-orange-50 text-orange-700 hover:bg-orange-100">
                      <span>مراجعة إيصالات التحويل</span>
                      <svg className="w-3.5 h-3.5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  )}
                </div>
              )}

              {/* 7. Invoices Overview */}
              {hasPerm('invoices') && stats?.invoices && (
                <div className="card p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500" />
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
                      <path d="M16 8H8M16 12H8M13 16H8" />
                    </svg>
                    نظرة سريعة: الفواتير
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
                    <svg className="w-5 h-5 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    نظرة سريعة: الإعلانات
                  </h3>
                  <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                    <div className="text-center">
                      <span className="text-3xl font-bold text-teal-600">{stats.announcements.total}</span>
                      <span className="text-sm text-ink-500 block">إعلان منشور حالياً</span>
                    </div>
                    <Link href="/supervisor/announcements" className="btn btn-secondary text-xs flex items-center gap-1">
                      <span>إدارة الإعلانات</span>
                      <svg className="w-3.5 h-3.5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}

              {/* 9. Groups Overview */}
              {hasPerm('groups') && stats?.groups && (
                <div className="card p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-1 h-full bg-orange-500" />
                  <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    نظرة سريعة: الأسر والمجموعات
                  </h3>
                  <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                    <div className="text-center">
                      <span className="text-3xl font-bold text-orange-600">{stats.groups.total}</span>
                      <span className="text-sm text-ink-500 block">مجموعة / أسرة مسجلة</span>
                    </div>
                    <Link href="/supervisor/groups" className="btn btn-secondary text-xs flex items-center gap-1">
                      <span>استعرض الأسر</span>
                      <svg className="w-3.5 h-3.5 transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}

          </div>
        )}
      </div>
    )}

      {customizing && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-[999]" onClick={() => setCustomizing(false)}>
          <div className="modal-panel w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-line bg-cream-50/50">
              <h3 className="font-bold text-lg text-ink-900 flex items-center gap-2">
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
    </div>
  );
}
