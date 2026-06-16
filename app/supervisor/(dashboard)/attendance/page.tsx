'use client';

import { useState, useEffect, useCallback } from 'react';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  stage: string;
  grade: string;
  groupId: number | null;
};

type Group = {
  id: number;
  name: string;
  stage: string;
};

type AttendanceRecord = {
  id: number;
  registrationId: number;
  date: string;
  status: string;
  recordedBy: string | null;
};

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // States
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Manual Check-in
  const [manualMembershipNo, setManualMembershipNo] = useState('');
  const [checkInMessage, setCheckInMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  // Mock QR Simulator state
  const [showQrSim, setShowQrSim] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/supervisor/groups');
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups || []);
        if (data.groups && data.groups.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data.groups[0].id.toString());
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentsAndAttendance = useCallback(async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    try {
      // 1. Fetch group students
      const studentsRes = await fetch(`/api/supervisor/students?groupId=${selectedGroupId}`);
      const studentsData = await studentsRes.json();

      // 2. Fetch group attendance for date
      const attendanceRes = await fetch(`/api/supervisor/attendance?date=${selectedDate}&groupId=${selectedGroupId}`);
      const attendanceData = await attendanceRes.json();

      if (studentsRes.ok && attendanceRes.ok) {
        setStudents(studentsData.students || []);
        setAttendance(attendanceData.attendance || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, selectedDate]);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchStudentsAndAttendance();
  }, [fetchStudentsAndAttendance]);

  const handleStatusChange = async (studentId: number, status: string) => {
    try {
      const res = await fetch('/api/supervisor/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: studentId,
          date: selectedDate,
          status
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Update local attendance list
        setAttendance(prev => {
          const idx = prev.findIndex(r => r.registrationId === studentId);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = data.attendance;
            return updated;
          } else {
            return [...prev, data.attendance];
          }
        });
      } else {
        alert(data.error || 'فشل تسجيل الحضور');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualCheckIn = async (e?: React.FormEvent, mNo?: string) => {
    if (e) e.preventDefault();
    const numberToSubmit = mNo || manualMembershipNo;
    if (!numberToSubmit.trim()) return;

    setCheckingIn(true);
    setCheckInMessage(null);
    try {
      const res = await fetch('/api/supervisor/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipNo: numberToSubmit,
          date: selectedDate,
          status: 'present'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCheckInMessage({ text: 'تم تسجيل حضور الطالب بنجاح! ✅', success: true });
        setManualMembershipNo('');
        
        // Refresh logs if the checked-in student is in the currently viewed group
        fetchStudentsAndAttendance();
      } else {
        setCheckInMessage({ text: data.error || 'فشل تسجيل الحضور ❌', success: false });
      }
    } catch (err) {
      setCheckInMessage({ text: 'خطأ في الاتصال بالشبكة ❌', success: false });
    } finally {
      setCheckingIn(false);
    }
  };

  // Simulate scanning QR code
  const simulateQrScan = (membershipNo: number) => {
    setShowQrSim(false);
    handleManualCheckIn(undefined, membershipNo.toString());
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">التحضير اليومي</h1>
        <p className="text-ink-500 mt-2">تحضير الطلاب وتتبع حضورهم اليومي للمجموعات باستخدام مسح الـ QR أو الإدخال اليدوي.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Attendance Logging */}
        <div className="lg:col-span-2 space-y-6">
          {/* Controls Card */}
          <div className="card p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-1/2">
              <label className="label mb-1.5 block">اختر المجموعة</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="input w-full"
              >
                <option value="">اختر المجموعة...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.stage})</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-1/2">
              <label className="label mb-1.5 block">اختر التاريخ</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input w-full text-right"
              />
            </div>
          </div>

          {/* Attendance Roster Table */}
          <div className="card bg-white overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-ink-500 font-body">جاري تحميل القائمة…</div>
            ) : !selectedGroupId ? (
              <div className="py-20 text-center text-ink-500 font-body">الرجاء اختيار مجموعة لعرض الطلاب المسجلين فيها.</div>
            ) : students.length === 0 ? (
              <div className="py-20 text-center text-ink-500 font-body">لا يوجد طلاب مسجلون في هذه المجموعة حالياً.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-cream-50/70 border-b border-ink-200/60 text-ink-500 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4 pr-6">العضوية</th>
                      <th className="p-4">اسم الطالب</th>
                      <th className="p-4">التحضير اليومي</th>
                      <th className="p-4 pl-6 text-left">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 text-sm">
                    {students.map((s) => {
                      const record = attendance.find(r => r.registrationId === s.id);
                      const currentStatus = record?.status || '';

                      return (
                        <tr key={s.id} className="hover:bg-cream-50/20">
                          <td className="p-4 pr-6 font-display font-semibold text-ink-500">
                            #{s.membershipNo}
                          </td>
                          <td className="p-4 font-semibold text-ink-900">
                            {s.studentName}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleStatusChange(s.id, 'present')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentStatus === 'present' ? 'bg-green-500 text-white' : 'bg-cream-50 text-ink-600 hover:bg-cream-100'}`}
                              >
                                حاضر
                              </button>
                              <button
                                onClick={() => handleStatusChange(s.id, 'absent')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentStatus === 'absent' ? 'bg-red-500 text-white' : 'bg-cream-50 text-ink-600 hover:bg-cream-100'}`}
                              >
                                غائب
                              </button>
                              <button
                                onClick={() => handleStatusChange(s.id, 'late')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentStatus === 'late' ? 'bg-yellow-500 text-white' : 'bg-cream-50 text-ink-600 hover:bg-cream-100'}`}
                              >
                                متأخر
                              </button>
                            </div>
                          </td>
                          <td className="p-4 pl-6 text-left font-body text-xs font-bold">
                            {currentStatus === 'present' && <span className="text-green-600">حضر ✅</span>}
                            {currentStatus === 'absent' && <span className="text-red-500">غائب ❌</span>}
                            {currentStatus === 'late' && <span className="text-yellow-600">متأخر ⏳</span>}
                            {!currentStatus && <span className="text-ink-300">غير محضر</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Check-in panel (Manual + Mock QR) */}
        <div className="space-y-6">
          {/* Manual Input card */}
          <div className="card p-6 bg-white space-y-4">
            <h3 className="font-display text-xl text-ink-900">التحضير السريع</h3>
            <p className="text-xs text-ink-400">سجل حضور الطالب مباشرة بإدخال رقم العضوية الخاص به.</p>

            {checkInMessage && (
              <div className={`p-4 rounded-xl text-xs font-semibold text-center ${checkInMessage.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {checkInMessage.text}
              </div>
            )}

            <form onSubmit={handleManualCheckIn} className="space-y-3">
              <input
                type="text"
                required
                placeholder="رقم العضوية (مثال: 1005)"
                value={manualMembershipNo}
                onChange={e => setManualMembershipNo(e.target.value)}
                className="input w-full text-center ltr font-display font-semibold"
                disabled={checkingIn}
              />
              <button
                type="submit"
                disabled={checkingIn}
                className="btn btn-primary w-full"
              >
                {checkingIn ? 'جاري التحضير…' : 'تسجيل الحضور'}
              </button>
            </form>
          </div>

          {/* Mock QR Scanner Scanner Card */}
          <div className="card p-6 bg-white space-y-4 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-3xl">
              📷
            </div>
            <h3 className="font-display text-xl text-ink-900">مسح الـ QR للتحضير</h3>
            <p className="text-xs text-ink-400">قم بتشغيل الكاميرا لمسح كود الـ QR الخاص بعضوية الطالب وتأكيد حضوره.</p>
            
            <button
              onClick={() => setShowQrSim(true)}
              className="btn btn-secondary w-full"
            >
              تشغيل المحاكي (QR Scan)
            </button>
          </div>
        </div>
      </div>

      {/* Mock QR Simulator Modal */}
      {showQrSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl w-full max-w-md card shadow-xl p-6 relative text-center space-y-5">
            <div className="flex justify-between items-center border-b border-ink-100 pb-3">
              <h3 className="font-display text-xl text-ink-900">محاكي مسح رمز الـ QR</h3>
              <button 
                onClick={() => setShowQrSim(false)}
                className="text-ink-400 hover:text-ink-600 font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-ink-500">اختر طالباً لمحاكاة قيامه بمسح كود الـ QR الخاص بعضويته في جهاز التحضير:</p>

            <div className="max-h-60 overflow-y-auto border border-ink-100 rounded-2xl divide-y divide-ink-100 text-right">
              {students.length === 0 ? (
                <div className="p-6 text-center text-ink-400 text-xs">لا يوجد طلاب في المجموعة الحالية للمحاكاة.</div>
              ) : (
                students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => simulateQrScan(s.membershipNo)}
                    className="w-full p-3 text-sm hover:bg-cream-50/60 font-body flex items-center justify-between transition-colors"
                  >
                    <span className="font-semibold text-ink-900">{s.studentName}</span>
                    <span className="font-display text-xs text-ink-400 font-semibold">#{s.membershipNo}</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowQrSim(false)}
              className="btn btn-secondary w-full"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
