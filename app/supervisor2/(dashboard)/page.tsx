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

export default function DashboardHome() {
  const { user } = useSupervisor();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [sr, ar] = await Promise.all([
        fetch('/api/supervisor/students', { cache: 'no-store' }),
        fetch(`/api/supervisor/attendance?date=${todayStr()}`, { cache: 'no-store' })
      ]);
      const sj = await sr.json().catch(() => ({ students: [] }));
      const aj = await ar.json().catch(() => ({ attendance: [] }));
      setStudents(sj.students ?? []);
      setAttendance(aj.attendance ?? []);
      setLoading(false);
    })();
  }, []);

  const total = students.length;
  const approved = students.filter((s) => s.registrationStatus === 'approved').length;
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
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">أهلاً، {user?.name ?? 'مشرف'}</h1>
        <p className="text-ink-500 text-sm">لمحة سريعة عن حالة التسجيل في نادي نبراس.</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-400 text-sm">جارٍ تحميل البيانات…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Stat label="إجمالي المسجلين" value={total} tone="orange" />
            <Stat label="الطلاب المقبولون" value={approved} tone="green" />
            <Stat label="المدفوعات المؤكدة" value={paid} tone="blue" />
            <Stat label="نسبة حضور اليوم" value={`${attendanceRate}%`} tone="cyan" hint={`${presentToday} حاضر من ${activeBase}`} />
            <Stat label="بانتظار مراجعة الدفع" value={pendingReview} tone="yellow" hint="إيصالات تحويل بانتظار التأكيد" />
            <Stat label="حالات صحية حرجة" value={conditions} tone="red" hint="🚨 طلاب لديهم حساسية / أمراض مزمنة" />
          </div>

          {pendingReg > 0 && (
            <div className="card p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm text-ink-700">
                لديك <span className="font-bold" style={{ color: 'var(--accent-deep)' }}>{pendingReg}</span> طلب
                تسجيل قيد المراجعة.
              </span>
              <Link href="/supervisor2/students?registrationStatus=pending" className="btn btn-secondary text-sm">
                مراجعة الطلبات
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink-900">أحدث التسجيلات</h2>
                <Link href="/supervisor2/students" className="text-sm font-semibold" style={{ color: 'var(--accent-deep)' }}>
                  عرض الكل ←
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="text-center py-8 text-ink-400 text-sm">لا توجد تسجيلات بعد.</p>
              ) : (
                <div className="overflow-x-auto scroll-soft">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>الطالب</th>
                        <th>العضوية</th>
                        <th>المرحلة</th>
                        <th>الدفع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((s) => (
                        <tr key={s.id}>
                          <td className="font-medium">
                            {s.studentName}
                            {s.hasCondition && <span title="حالة صحية" className="mr-1">🚨</span>}
                          </td>
                          <td dir="ltr" className="text-right font-mono text-ink-500">#{s.membershipNo}</td>
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

            <div className="card p-6">
              <h2 className="text-lg font-bold text-ink-900 mb-4">روابط سريعة</h2>
              <div className="flex flex-col gap-2.5">
                <Link href="/supervisor2/students" className="btn btn-secondary justify-start">إدارة الطلاب</Link>
                <Link href="/supervisor2/attendance" className="btn btn-secondary justify-start">تسجيل الحضور</Link>
                <Link href="/supervisor2/payments" className="btn btn-secondary justify-start">مراجعة المدفوعات</Link>
                <Link href="/supervisor2/points" className="btn btn-secondary justify-start">رصد النقاط</Link>
                <Link href="/supervisor2/announcements" className="btn btn-secondary justify-start">نشر إعلان</Link>
              </div>
            </div>
          </div>
        </>
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
