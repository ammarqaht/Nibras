'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  stage: string;
  paymentStatus: string;
  paymentType: string;
  paymentReceipt: string | null;
  registrationStatus: string;
  hasCondition: boolean;
  createdAt: string;
};

type AttendanceRec = { registrationId: number; date: string; status: string };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRec[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sr, ar, annR, invR] = await Promise.all([
          fetch('/api/supervisor/students', { cache: 'no-store' }),
          fetch(`/api/supervisor/attendance?date=${todayStr()}`, { cache: 'no-store' }),
          fetch('/api/supervisor/announcements', { cache: 'no-store' }),
          fetch('/api/supervisor/invoices', { cache: 'no-store' })
        ]);
        const sj = await sr.json().catch(() => ({ students: [] }));
        const aj = await ar.json().catch(() => ({ attendance: [] }));
        const annJ = await annR.json().catch(() => ({ announcements: [] }));
        const invJ = await invR.json().catch(() => ({ invoices: [] }));
        
        setStudents(sj.students ?? []);
        setAttendance(aj.attendance ?? []);
        setAnnouncements(annJ.announcements ?? []);
        setInvoices(invJ.invoices ?? []);
      } catch (e) {
        console.error('Error fetching dashboard data', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = students.length;
  const approved = students.filter((s) => s.registrationStatus === 'approved' && s.paymentStatus === 'paid').length;
  const pendingReg = students.filter((s) => s.registrationStatus === 'pending').length;
  const paid = students.filter((s) => s.paymentStatus === 'paid').length;
  const pendingReview = students.filter(
    (s) => s.paymentStatus !== 'paid' && s.paymentType === 'now' && !!s.paymentReceipt
  ).length;
  const conditions = students.filter((s) => s.hasCondition).length;
  const presentToday = attendance.filter((a) => a.status === 'present').length;
  const activeBase = approved || total;
  const attendanceRate = activeBase ? Math.round((presentToday / activeBase) * 100) : 0;

  const recent = [...students]
    .filter((s) => s.registrationStatus === 'approved' && s.paymentStatus === 'paid')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);

  const roles = user?.role ? user.role.split(',').map((r) => r.trim()) : [];
  const isAdmin = roles.includes('admin');
  const isGeneral = roles.includes('general_supervisor');
  const isFinance = roles.includes('finance') || roles.includes('finance_supervisor');
  const isMedia = roles.includes('media_supervisor');

  // Build active quick links dynamically
  const quickLinks = [
    { href: '/supervisor/students', label: 'إدارة الطلاب', show: true },
    { href: '/supervisor/invoices', label: 'إضافة وإدارة الفواتير', show: true }, // all supervisors can manage invoices
    { href: '/supervisor/announcements', label: 'نشر إعلان جديد', show: isAdmin || isGeneral || roles.includes('media_supervisor') },
    { href: '/supervisor/payments', label: 'مراجعة المدفوعات', show: isAdmin || roles.includes('finance') || roles.includes('finance_supervisor') },
    { href: '/supervisor/finance', label: 'التقارير المالية', show: isAdmin || roles.includes('finance') || roles.includes('finance_supervisor') },
    { href: '/supervisor/attendance', label: 'تسجيل الحضور', show: isAdmin || isGeneral || roles.includes('attendance_supervisor') },
    { href: '/supervisor/points', label: 'رصد النقاط والجوائز', show: isAdmin || isGeneral || roles.includes('social_supervisor') || roles.includes('cultural_supervisor') },
    { href: '/supervisor/groups', label: 'إدارة المجموعات والأسرة', show: isAdmin || isGeneral || roles.includes('groups_supervisor') },
    { href: '/supervisor/supervisors', label: 'إدارة الحسابات والصلاحيات', show: isAdmin }
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
          <div className="w-14 h-14 rounded-full bg-cream-100 border border-ink-200 flex items-center justify-center text-brand-700 text-2xl font-bold shadow-inner">
            {user?.name.charAt(0) || 'م'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900 mb-1">أهلاً بك، {user?.name}</h2>
            <p className="text-sm text-ink-500 flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-brand/10 text-brand text-[10px]">👤</span>
              الدور الحالي: <span className="font-semibold text-brand">{getRoleLabel(user?.role || '')}</span>
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-400 text-sm">جارٍ تحميل البيانات…</div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick Links Section - Dynamic based on roles */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-ink-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              الوصول السريع والمهام
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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

          {/* Role-Specific Metrics & Logs */}
          
          {/* A. ADMIN & GENERAL SUPERVISOR Dashboard */}
          {(isAdmin || isGeneral) && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Stat label="إجمالي المسجلين" value={total} tone="orange" />
                <Stat label="الطلاب المقبولون" value={approved} tone="green" />
                <Stat label="المدفوعات المؤكدة" value={paid} tone="blue" />
                <Stat label="نسبة حضور اليوم" value={`${attendanceRate}%`} tone="cyan" hint={`${presentToday} حاضر من ${activeBase}`} />
                <Stat label="بانتظار مراجعة الدفع" value={pendingReview} tone="yellow" hint="إيصالات تحويل بانتظار التأكيد" />
                <Stat label="حالات صحية حرجة" value={conditions} tone="red" hint="🚨 طلاب لديهم حساسية / أمراض مزمنة" />
              </div>

              {pendingReg > 0 && (
                <div className="card p-4 flex items-center justify-between gap-4 flex-wrap bg-yellow-50/30 border-yellow-200">
                  <span className="text-sm text-ink-700">
                    لديك <span className="font-bold text-yellow-700">{pendingReg}</span> طلب تسجيل قيد المراجعة والقبول.
                  </span>
                  <Link href="/supervisor/students" className="btn btn-secondary text-sm">
                    مراجعة الطلاب المعلقين
                  </Link>
                </div>
              )}

              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-ink-900">أحدث التسجيلات المعتمدة</h2>
                  <Link href="/supervisor/students" className="text-sm font-semibold text-brand hover:underline">
                    عرض الكل ←
                  </Link>
                </div>
                {recent.length === 0 ? (
                  <p className="text-center py-8 text-ink-400 text-sm">لا توجد تسجيلات بعد.</p>
                ) : (
                  <div className="overflow-x-auto scroll-soft">
                    <table className="tbl text-right" dir="rtl">
                      <thead>
                        <tr>
                          <th>الطالب</th>
                          <th>رقم العضوية</th>
                          <th>المرحلة</th>
                          <th>حالة الدفع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((s) => (
                          <tr key={s.id}>
                            <td className="font-medium">
                              {s.studentName}
                              {s.hasCondition && <span title="حالة صحية" className="mr-1 text-red-500">🚨</span>}
                            </td>
                            <td className="font-mono text-ink-500">#{s.membershipNo}</td>
                            <td className="text-ink-500">{s.stage}</td>
                            <td>
                              <span className={`pill ${s.paymentStatus === 'paid' ? 'pill-green' : 'pill-red'}`}>
                                {s.paymentStatus === 'paid' ? 'مدفوع' : 'لم يدفع'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* B. MEDIA SUPERVISOR Dashboard Sections (if not admin) */}
          {!isAdmin && !isGeneral && isMedia && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  آخر الإعلانات المنشورة في النادي
                </h2>
                <Link href="/supervisor/announcements" className="text-sm font-semibold text-brand hover:underline">
                  إدارة الإعلانات ←
                </Link>
              </div>
              {announcements.length === 0 ? (
                <p className="text-center py-8 text-ink-400 text-sm">لا توجد إعلانات منشورة بعد.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {announcements.slice(0, 4).map((ann) => (
                    <div key={ann.id} className="p-4 rounded-xl border border-ink-150 bg-cream-50/20 hover:shadow-sm transition-all flex gap-3 items-center">
                      {ann.imageUrl ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-ink-100">
                          <img src={ann.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand text-lg flex items-center justify-center flex-shrink-0">
                          📢
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-ink-900 text-sm truncate mb-0.5">{ann.title}</h4>
                        <p className="text-xs text-ink-500 line-clamp-1">{ann.body}</p>
                        <span className="text-[9px] text-ink-400 mt-1 block">{new Date(ann.createdAt).toLocaleDateString('ar')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* C. FINANCE SUPERVISOR Dashboard Sections (if not admin) */}
          {!isAdmin && !isGeneral && isFinance && (
            <>
              {/* Financial mini stats */}
              <div className="grid grid-cols-2 gap-4">
                <Stat label="المدفوعات المؤكدة" value={paid} tone="green" />
                <Stat label="بانتظار مراجعة الدفع" value={pendingReview} tone="yellow" hint="إيصالات تحويل بانتظار المراجعة" />
              </div>

              {/* Recent Invoices filed by them */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-ink-900">أحدث الفواتير المدخلة</h2>
                  <Link href="/supervisor/invoices" className="text-sm font-semibold text-brand hover:underline">
                    إدارة الفواتير ←
                  </Link>
                </div>
                {invoices.length === 0 ? (
                  <p className="text-center py-8 text-ink-400 text-sm">لا توجد فواتير مدخلة بعد.</p>
                ) : (
                  <div className="overflow-x-auto scroll-soft">
                    <table className="tbl text-right" dir="rtl">
                      <thead>
                        <tr>
                          <th>الفاتورة</th>
                          <th>المبلغ</th>
                          <th>الجهة/القسم</th>
                          <th>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 5).map((inv) => (
                          <tr key={inv.id}>
                            <td className="font-medium">{inv.title}</td>
                            <td className="font-mono text-brand font-bold">{inv.total} {inv.currency}</td>
                            <td className="text-ink-500 text-xs">{inv.department}</td>
                            <td>
                              <span className={`pill ${
                                inv.status === 'approved' ? 'pill-green' :
                                inv.status === 'rejected' ? 'pill-red' : 'pill-yellow'
                              }`}>
                                {inv.status === 'approved' ? 'معتمدة' :
                                 inv.status === 'rejected' ? 'مرفوضة' : 'قيد المراجعة'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* D. Other regular supervisors (who aren't Admin, Media, or Finance) */}
          {!isAdmin && !isGeneral && !isFinance && !isMedia && invoices.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-bold text-ink-900 mb-4">فواتيرك الأخيرة</h2>
              <div className="overflow-x-auto scroll-soft">
                <table className="tbl text-right" dir="rtl">
                  <thead>
                    <tr>
                      <th>الفاتورة</th>
                      <th>المبلغ</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 4).map((inv) => (
                      <tr key={inv.id}>
                        <td className="font-medium">{inv.title}</td>
                        <td className="font-mono text-ink-700">{inv.total} {inv.currency}</td>
                        <td>
                          <span className={`pill ${
                            inv.status === 'approved' ? 'pill-green' :
                            inv.status === 'rejected' ? 'pill-red' : 'pill-yellow'
                          }`}>
                            {inv.status === 'approved' ? 'معتمدة' :
                             inv.status === 'rejected' ? 'مرفوضة' : 'تحت المراجعة'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  orange: 'var(--accent)',
  green: '#1B7A43',
  blue: 'var(--blue)',
  cyan: 'var(--cyan)',
  yellow: '#C68A00',
  red: 'var(--red)'
};

function Stat({
  label,
  value,
  tone,
  hint
}: {
  label: string;
  value: number | string;
  tone: keyof typeof TONES;
  hint?: string;
}) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1 h-full" style={{ background: TONES[tone] }} />
      <div className="text-sm text-ink-500 mb-2">{label}</div>
      <div className="text-3xl font-bold text-ink-900 tabular-nums" style={{ color: TONES[tone] }}>
        {value}
      </div>
      {hint && <div className="text-xs text-ink-400 mt-2 leading-relaxed">{hint}</div>}
    </div>
  );
}
