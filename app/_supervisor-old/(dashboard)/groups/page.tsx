'use client';

import { useState, useEffect, useCallback } from 'react';
import { stages } from '@/content';

type Group = {
  id: number;
  name: string;
  stage: string;
  createdAt: string;
};

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  stage: string;
  grade: string;
  groupId: number | null;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // New group form
  const [groupName, setGroupName] = useState('');
  const [groupStage, setGroupStage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Assign student to group
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignGroupId, setAssignGroupId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const groupsRes = await fetch('/api/supervisor/groups');
      const groupsData = await groupsRes.json();
      setGroups(groupsData.groups || []);

      const studentsRes = await fetch('/api/supervisor/students');
      const studentsData = await studentsRes.json();
      setStudents(studentsData.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !groupStage) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/supervisor/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, stage: groupStage })
      });
      const data = await res.json();
      if (res.ok) {
        setGroups(prev => [...prev, data.group]);
        setGroupName('');
        setGroupStage('');
      } else {
        alert(data.error || 'فشل إنشاء المجموعة');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentId) return;

    setAssigning(true);
    try {
      const gId = assignGroupId ? parseInt(assignGroupId, 10) : null;
      const res = await fetch('/api/supervisor/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parseInt(assignStudentId, 10),
          groupId: gId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(prev => prev.map(s => s.id === data.student.id ? data.student : s));
        setAssignStudentId('');
        setAssignGroupId('');
        alert('تم توزيع الطالب بنجاح! 🎉');
      } else {
        alert(data.error || 'فشل توزيع الطالب');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-ink-900">المجموعات والأسر</h1>
        <p className="text-ink-500 mt-2">إنشاء وإدارة المجموعات (الأسر) للطلاب وتوزيع المشتركين حسب مراحلهم الدراسية.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Groups Listing */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 bg-white space-y-6">
            <h3 className="font-display text-xl text-ink-900">المجموعات الحالية</h3>

            {loading ? (
              <div className="py-12 text-center text-ink-500 text-sm">جاري تحميل المجموعات…</div>
            ) : groups.length === 0 ? (
              <div className="py-12 text-center text-ink-400 text-sm">لا توجد مجموعات مسجلة بعد.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groups.map(g => {
                  const groupStudents = students.filter(s => s.groupId === g.id);
                  return (
                    <div key={g.id} className="p-5 rounded-2xl border border-ink-200/60 bg-cream-50/20 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-start gap-3">
                          <h4 className="font-semibold text-lg text-ink-900">{g.name}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                            {g.stage}
                          </span>
                        </div>
                        <p className="text-xs text-ink-500 mt-2">عدد الطلاب في هذه المجموعة: {groupStudents.length} طلاب</p>
                      </div>

                      {/* Small list of student names */}
                      <div className="border-t border-ink-100 pt-3 max-h-40 overflow-y-auto space-y-1">
                        {groupStudents.length === 0 ? (
                          <span className="text-[10px] text-ink-300 block">لا يوجد طلاب في هذه المجموعة بعد.</span>
                        ) : (
                          groupStudents.map(s => (
                            <div key={s.id} className="text-xs text-ink-600 font-body flex items-center justify-between">
                              <span>• {s.studentName}</span>
                              <span className="text-[10px] text-ink-400">#{s.membershipNo}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Add group & Assign student forms */}
        <div className="space-y-6">
          {/* Create Group Form */}
          <div className="card p-6 bg-white space-y-4">
            <h3 className="font-display text-xl text-ink-900">إنشاء مجموعة جديدة</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="label mb-1 block">اسم المجموعة (الأسرة)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أسرة الفرسان"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="input w-full"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="label mb-1 block">المرحلة الدراسية</label>
                <select
                  required
                  value={groupStage}
                  onChange={e => setGroupStage(e.target.value)}
                  className="input w-full"
                  disabled={submitting}
                >
                  <option value="">اختر المرحلة...</option>
                  {stages.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full mt-2"
              >
                {submitting ? 'جاري الإنشاء…' : 'إنشاء المجموعة'}
              </button>
            </form>
          </div>

          {/* Assign Student Form */}
          <div className="card p-6 bg-white space-y-4">
            <h3 className="font-display text-xl text-ink-900">توزيع الطلاب على المجموعات</h3>
            <form onSubmit={handleAssignStudent} className="space-y-4">
              <div>
                <label className="label mb-1 block">اختر الطالب</label>
                <select
                  required
                  value={assignStudentId}
                  onChange={e => setAssignStudentId(e.target.value)}
                  className="input w-full"
                  disabled={assigning}
                >
                  <option value="">ابحث عن طالب...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.studentName} ({s.stage} - {s.groupId ? 'مصنف' : 'غير مصنف'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label mb-1 block">المجموعة المستهدفة</label>
                <select
                  value={assignGroupId}
                  onChange={e => setAssignGroupId(e.target.value)}
                  className="input w-full"
                  disabled={assigning}
                >
                  <option value="">إزالة من المجموعة (غير مصنف)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.stage})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={assigning}
                className="btn btn-primary w-full mt-2"
              >
                {assigning ? 'جاري التوزيع…' : 'تأكيد التوزيع'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
