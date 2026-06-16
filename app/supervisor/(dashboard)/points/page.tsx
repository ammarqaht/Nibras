'use client';

import { useState, useEffect, useCallback } from 'react';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  groupId: number | null;
};

type Group = {
  id: number;
  name: string;
  stage: string;
};

type PointRecord = {
  id: number;
  registrationId: number;
  delta: number;
  reason: string;
  category: string;
  recordedBy: string | null;
  createdAt: string;
};

type LeaderboardRow = {
  studentId: number;
  membershipNo: number;
  studentName: string;
  groupName: string;
  totalPoints: number;
};

export default function PointsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pointsLog, setPointsLog] = useState<PointRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Allocator state
  const [allocationTarget, setAllocationTarget] = useState<'student' | 'group'>('student');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [pointsDelta, setPointsDelta] = useState('10'); // default +10
  const [pointsReason, setPointsReason] = useState('');
  const [pointsCategory, setPointsCategory] = useState('participation');
  const [submitting, setSubmitting] = useState(false);
  const [allocatorMsg, setAllocatorMsg] = useState<{ text: string; success: boolean } | null>(null);

  // Leaderboard filters
  const [filterGroupId, setFilterGroupId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch groups
      const groupsRes = await fetch('/api/supervisor/groups');
      const groupsData = await groupsRes.json();
      setGroups(groupsData.groups || []);

      // 2. Fetch all students
      const studentsRes = await fetch('/api/supervisor/students');
      const studentsData = await studentsRes.json();
      setStudents(studentsData.students || []);

      // 3. Fetch points logs
      const pointsRes = await fetch('/api/supervisor/points');
      const pointsData = await pointsRes.json();
      setPointsLog(pointsData.points || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute leaderboard rows dynamically from students + pointsLog
  const getLeaderboard = (): LeaderboardRow[] => {
    const map: Record<number, number> = {};
    
    // Initialize all students with 0 points
    students.forEach(s => {
      map[s.id] = 0;
    });

    // Accumulate point records
    pointsLog.forEach(p => {
      if (map[p.registrationId] !== undefined) {
        map[p.registrationId] += p.delta;
      }
    });

    // Map to rows
    let rows: LeaderboardRow[] = students.map(s => {
      const g = groups.find(item => item.id === s.groupId);
      return {
        studentId: s.id,
        membershipNo: s.membershipNo,
        studentName: s.studentName,
        groupName: g ? g.name : 'غير مصنف',
        totalPoints: map[s.id] || 0
      };
    });

    // Apply group filter if selected
    if (filterGroupId) {
      const gId = parseInt(filterGroupId, 10);
      const studentIdsInGroup = new Set(students.filter(s => s.groupId === gId).map(s => s.id));
      rows = rows.filter(r => studentIdsInGroup.has(r.studentId));
    }

    // Sort by points descending
    return rows.sort((a, b) => b.totalPoints - a.totalPoints);
  };

  const handleAllocatePoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allocationTarget === 'student' && !selectedStudentId) return;
    if (allocationTarget === 'group' && !selectedGroupId) return;
    if (!pointsReason.trim()) return;

    setSubmitting(true);
    setAllocatorMsg(null);
    try {
      const payload: any = {
        delta: parseInt(pointsDelta, 10),
        reason: pointsReason,
        category: pointsCategory
      };

      if (allocationTarget === 'student') {
        payload.registrationId = selectedStudentId;
      } else {
        payload.groupId = selectedGroupId;
      }

      const res = await fetch('/api/supervisor/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        if (data.bulk) {
          setPointsLog(prev => [...data.pointRecords, ...prev]);
          setAllocatorMsg({ text: `تم رصد النقاط بنجاح لجميع طلاب الأسرة! 🏆 (+${pointsDelta} لكل طالب)`, success: true });
          setSelectedGroupId('');
        } else {
          setPointsLog(prev => [data.pointRecord, ...prev]);
          setAllocatorMsg({ text: 'تم تخصيص النقاط بنجاح! 🏆', success: true });
          setSelectedStudentId('');
        }
        // Clear common fields
        setPointsReason('');
        setPointsCategory('participation');
      } else {
        setAllocatorMsg({ text: data.error || 'فشل تخصيص النقاط ❌', success: false });
      }
    } catch (err) {
      setAllocatorMsg({ text: 'حدث خطأ في الاتصال ❌', success: false });
    } finally {
      setSubmitting(false);
    }
  };

  const categoryMapAr: Record<string, string> = {
    behavior: 'سلوك وانضباط',
    participation: 'تفاعل ومشاركة',
    activity: 'نشاط ومسابقة',
    other: 'أخرى'
  };

  const leaderboard = getLeaderboard();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">لوحة النقاط والتميز</h1>
        <p className="text-ink-500 mt-2">إدارة نظام التنافس والتميز اليومي للطلاب، رصد النقاط، واستعراض قائمة المتصدرين.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Leaderboard & Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leaderboard Card */}
          <div className="card bg-white p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-display text-xl text-ink-900">قائمة المتصدرين (الترتيب)</h3>
              <select
                value={filterGroupId}
                onChange={e => setFilterGroupId(e.target.value)}
                className="input text-xs py-1.5 px-3 min-w-[10rem]"
              >
                <option value="">كل المجموعات</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="py-12 text-center text-ink-500 text-sm">جاري تحميل لوحة الصدارة…</div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center text-ink-400 text-sm">لا يوجد طلاب لعرضهم.</div>
            ) : (
              <div className="overflow-x-auto border border-ink-100 rounded-2xl">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="bg-cream-50/70 border-b border-ink-200/60 text-ink-500 text-xs font-bold">
                      <th className="p-3.5 pr-6 w-16 text-center">الترتيب</th>
                      <th className="p-3.5">اسم الطالب</th>
                      <th className="p-3.5">المجموعة</th>
                      <th className="p-3.5 pl-6 text-left">مجموع النقاط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {leaderboard.map((row, index) => {
                      const rank = index + 1;
                      return (
                        <tr key={row.studentId} className="hover:bg-cream-50/20">
                          <td className="p-3.5 pr-6 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rank === 1 ? 'bg-yellow-100 text-yellow-800' : rank === 2 ? 'bg-slate-100 text-slate-800' : rank === 3 ? 'bg-amber-100 text-amber-800' : 'text-ink-400'}`}>
                              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-ink-900">{row.studentName}</td>
                          <td className="p-3.5 text-ink-500">{row.groupName}</td>
                          <td className="p-3.5 pl-6 text-left font-display font-bold text-lg text-brand">
                            {row.totalPoints > 0 ? `+${row.totalPoints}` : row.totalPoints}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Points Transaction Logs */}
          <div className="card bg-white p-6 space-y-6">
            <h3 className="font-display text-xl text-ink-900">سجل المعاملات الأخير</h3>
            {loading ? (
              <div className="py-12 text-center text-ink-500 text-sm">جاري تحميل سجل العمليات…</div>
            ) : pointsLog.length === 0 ? (
              <div className="py-12 text-center text-ink-400 text-sm">لا توجد سجلات نقاط مسجلة بعد.</div>
            ) : (
              <div className="divide-y divide-ink-100 max-h-[30rem] overflow-y-auto pr-1">
                {pointsLog.map((log) => {
                  const student = students.find(s => s.id === log.registrationId);
                  return (
                    <div key={log.id} className="py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                      <div>
                        <div className="font-semibold text-sm text-ink-900">
                          {student ? student.studentName : 'طالب غير معروف'}
                        </div>
                        <div className="text-xs text-ink-500 mt-1 flex flex-wrap gap-2 items-center">
                          <span className="bg-cream-100/70 text-ink-600 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                            {categoryMapAr[log.category] || log.category}
                          </span>
                          <span>•</span>
                          <span>السبب: {log.reason}</span>
                          <span>•</span>
                          <span>بواسطة: {log.recordedBy || 'النظام'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-display font-bold text-md block ${log.delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {log.delta >= 0 ? `+${log.delta}` : log.delta}
                        </span>
                        <span className="text-[10px] text-ink-400 block mt-1">
                          {new Date(log.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Points Allocator Form */}
        <div className="space-y-6">
          <div className="card p-6 bg-white space-y-4">
            <h3 className="font-display text-xl text-ink-900">منح / خصم نقاط تميز</h3>
            <p className="text-xs text-ink-400">رصد النقاط لطالب منفرد أو لأسرة/مجموعة كاملة مرة واحدة.</p>

            {/* Allocation Target Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-cream-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setAllocationTarget('student'); setAllocatorMsg(null); }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${allocationTarget === 'student' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
              >
                👤 طالب واحد
              </button>
              <button
                type="button"
                onClick={() => { setAllocationTarget('group'); setAllocatorMsg(null); }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${allocationTarget === 'group' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
              >
                🛡️ أسرة كاملة
              </button>
            </div>

            {allocatorMsg && (
              <div className={`p-4 rounded-xl text-xs font-semibold text-center ${allocatorMsg.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {allocatorMsg.text}
              </div>
            )}

            <form onSubmit={handleAllocatePoints} className="space-y-4">
              {/* Target Selector */}
              {allocationTarget === 'student' ? (
                <div>
                  <label className="label mb-1 block">اختر الطالب</label>
                  <select
                    required
                    value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}
                    className="input w-full"
                    disabled={submitting}
                  >
                    <option value="">ابحث عن طالب...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.studentName} (#{s.membershipNo})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label mb-1 block">اختر الأسرة / المجموعة</label>
                  <select
                    required
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className="input w-full"
                    disabled={submitting}
                  >
                    <option value="">اختر الأسرة...</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.stage})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Delta value */}
              <div>
                <label className="label mb-1 block">مقدار النقاط</label>
                <select
                  value={pointsDelta}
                  onChange={e => setPointsDelta(e.target.value)}
                  className="input w-full font-display font-semibold"
                  disabled={submitting}
                >
                  <option value="5">إضافة 5 نقاط (+5)</option>
                  <option value="10">إضافة 10 نقاط (+10)</option>
                  <option value="20">إضافة 20 نقطة (+20)</option>
                  <option value="50">إضافة 50 نقطة (+50)</option>
                  <option value="-5">خصم 5 نقاط (-5)</option>
                  <option value="-10">خصم 10 نقاط (-10)</option>
                  <option value="-20">خصم 20 نقطة (-20)</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="label mb-1 block">تصنيف التميز</label>
                <select
                  value={pointsCategory}
                  onChange={e => setPointsCategory(e.target.value)}
                  className="input w-full font-semibold"
                  disabled={submitting}
                >
                  <option value="participation">تفاعل ومشاركة</option>
                  <option value="behavior">سلوك وانضباط</option>
                  <option value="activity">نشاط ومسابقة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="label mb-1 block">سبب المنح / الخصم</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الإجابة على السؤال الثقافي"
                  value={pointsReason}
                  onChange={e => setPointsReason(e.target.value)}
                  className="input w-full"
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full mt-4"
              >
                {submitting ? 'جاري الرصد…' : 'تسجيل وتحديث النقاط'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
