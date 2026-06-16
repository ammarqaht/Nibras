import { getStudents, getAttendance, getGroups } from '@/lib/services';

export const revalidate = 0; // Dynamic data loading

export default async function DashboardPage() {
  const students = await getStudents();
  const attendance = await getAttendance();
  const groups = await getGroups();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.date === todayStr);

  const totalStudents = students.length;
  const presentToday = todayAttendance.filter(a => a.status === 'present').length;
  const absentToday = todayAttendance.filter(a => a.status === 'absent').length;
  const lateToday = todayAttendance.filter(a => a.status === 'late').length;
  const notRecorded = totalStudents - todayAttendance.length;

  const paidStudents = students.filter(s => s.paymentStatus === 'paid').length;
  const unpaidStudents = totalStudents - paidStudents;
  const feesCollected = paidStudents * 300;
  const feesOutstanding = unpaidStudents * 300;

  // Distribution by stage
  const primaryCount = students.filter(s => s.stage === 'ابتدائي').length;
  const intermediateCount = students.filter(s => s.stage === 'متوسط').length;
  const secondaryCount = students.filter(s => s.stage === 'ثانوي').length;

  const primaryPct = totalStudents ? Math.round((primaryCount / totalStudents) * 100) : 0;
  const intermediatePct = totalStudents ? Math.round((intermediateCount / totalStudents) * 100) : 0;
  const secondaryPct = totalStudents ? Math.round((secondaryCount / totalStudents) * 100) : 0;

  // Recent registrations
  const recentStudents = students.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">الرئيسية</h1>
        <p className="text-ink-500 mt-2">إحصائيات نادي نبراس الصيفي لليوم الموافق {todayStr}</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Students */}
        <div className="card p-6 bg-white flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-ink-400 block mb-1">إجمالي الطلاب المسجلين</span>
            <span className="font-display text-4xl text-ink-900 block">{totalStudents}</span>
            <span className="text-xs text-ink-500 block mt-2">طالب مسجل</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            👥
          </div>
        </div>

        {/* Present Today */}
        <div className="card p-6 bg-white flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-ink-400 block mb-1">حضور اليوم</span>
            <span className="font-display text-4xl text-ink-900 block">{presentToday}</span>
            <span className="text-xs text-green-600 font-semibold block mt-2">
              {totalStudents ? Math.round((presentToday / totalStudents) * 100) : 0}% نسبة حضور اليوم
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-xl">
            ✅
          </div>
        </div>

        {/* Payments Collected */}
        <div className="card p-6 bg-white flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-ink-400 block mb-1">الرسوم المحصلة</span>
            <span className="font-display text-3xl text-ink-900 block">{feesCollected.toLocaleString()} ريال</span>
            <span className="text-xs text-ink-500 block mt-2">{paidStudents} طالباً قاموا بالدفع</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
            💰
          </div>
        </div>

        {/* Outstanding Fees */}
        <div className="card p-6 bg-white flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-red-500 block mb-1">الرسوم غير المحصلة</span>
            <span className="font-display text-3xl text-red-700 block">{feesOutstanding.toLocaleString()} ريال</span>
            <span className="text-xs text-ink-500 block mt-2">{unpaidStudents} طالباً لم يدفعوا بعد</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-xl">
            🚨
          </div>
        </div>
      </div>

      {/* Detailed charts / breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Breakdown Card */}
        <div className="card p-6 bg-white lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xl text-ink-900 mb-6">تفاصيل التحضير اليوم</h3>
            <div className="space-y-4">
              {/* Present */}
              <div>
                <div className="flex justify-between text-xs text-ink-600 mb-1">
                  <span>حاضر ({presentToday})</span>
                  <span>{totalStudents ? Math.round((presentToday / totalStudents) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full rounded-full" style={{ width: `${totalStudents ? (presentToday / totalStudents) * 100 : 0}%` }} />
                </div>
              </div>
              {/* Absent */}
              <div>
                <div className="flex justify-between text-xs text-ink-600 mb-1">
                  <span>غائب ({absentToday})</span>
                  <span>{totalStudents ? Math.round((absentToday / totalStudents) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full rounded-full" style={{ width: `${totalStudents ? (absentToday / totalStudents) * 100 : 0}%` }} />
                </div>
              </div>
              {/* Late */}
              <div>
                <div className="flex justify-between text-xs text-ink-600 mb-1">
                  <span>متأخر ({lateToday})</span>
                  <span>{totalStudents ? Math.round((lateToday / totalStudents) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${totalStudents ? (lateToday / totalStudents) * 100 : 0}%` }} />
                </div>
              </div>
              {/* Not Recorded */}
              <div>
                <div className="flex justify-between text-xs text-ink-600 mb-1">
                  <span>غير محضر ({notRecorded})</span>
                  <span>{totalStudents ? Math.round((notRecorded / totalStudents) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-ink-300 h-full rounded-full" style={{ width: `${totalStudents ? (notRecorded / totalStudents) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-ink-100 flex items-center justify-between text-xs text-ink-400">
            <span>تحديث فوري</span>
            <span>{todayStr}</span>
          </div>
        </div>

        {/* Stage distribution card */}
        <div className="card p-6 bg-white lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xl text-ink-900 mb-6">توزيع الطلاب حسب المراحل</h3>
            <div className="space-y-6">
              {/* Primary */}
              <div className="flex items-center justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-sm font-bold shrink-0">
                  ابتدائي
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-ink-500 mb-1">
                    <span>الابتدائي العليا</span>
                    <span>{primaryCount} طالب</span>
                  </div>
                  <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-orange-400 h-full rounded-full" style={{ width: `${primaryPct}%` }} />
                  </div>
                </div>
              </div>

              {/* Intermediate */}
              <div className="flex items-center justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                  متوسط
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-ink-500 mb-1">
                    <span>المرحلة المتوسطة</span>
                    <span>{intermediateCount} طالب</span>
                  </div>
                  <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-400 h-full rounded-full" style={{ width: `${intermediatePct}%` }} />
                  </div>
                </div>
              </div>

              {/* Secondary */}
              <div className="flex items-center justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-sm font-bold shrink-0">
                  ثانوي
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-ink-500 mb-1">
                    <span>المرحلة الثانوية</span>
                    <span>{secondaryCount} طالب</span>
                  </div>
                  <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${secondaryPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-ink-100 flex justify-between text-xs text-ink-400">
            <span>إجمالي المراحل الثلاث</span>
            <span>{totalStudents} طالب</span>
          </div>
        </div>

        {/* Recent registrations */}
        <div className="card p-6 bg-white lg:col-span-1">
          <h3 className="font-display text-xl text-ink-900 mb-6">آخر الطلاب المسجلين</h3>
          <div className="divide-y divide-ink-100">
            {recentStudents.length === 0 ? (
              <div className="py-8 text-center text-ink-400 text-sm font-body">لا يوجد طلاب مسجلين حالياً</div>
            ) : (
              recentStudents.map((s) => (
                <div key={s.id} className="py-3.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-body text-sm font-semibold text-ink-900 truncate">{s.studentName}</div>
                    <div className="text-xs text-ink-400 mt-0.5 truncate">
                      {s.stage} - {s.grade} • {s.neighborhood}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.registrationStatus === 'approved' ? 'bg-green-100 text-green-800' : s.registrationStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'انتظار'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
