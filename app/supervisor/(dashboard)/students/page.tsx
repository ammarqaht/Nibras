'use client';

import { useState, useEffect, useCallback } from 'react';
import { stages } from '@/content';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  nationalId: string;
  guardianPhone: string;
  studentPhone: string | null;
  stage: string;
  grade: string;
  neighborhood: string;
  locationLat: number | null;
  locationLng: number | null;
  hasCondition: boolean;
  conditionNote: string | null;
  createdAt: string;
  paymentStatus: string;
  groupId: number | null;
  registrationStatus: string;
};

type Group = {
  id: number;
  name: string;
  stage: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('');
  const [groupId, setGroupId] = useState('');

  // Selected student for modal / editing
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields in modal
  const [editName, setEditName] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editGuardianPhone, setEditGuardianPhone] = useState('');
  const [editStudentPhone, setEditStudentPhone] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editHasCondition, setEditHasCondition] = useState(false);
  const [editConditionNote, setEditConditionNote] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('unpaid');
  const [editRegistrationStatus, setEditRegistrationStatus] = useState('pending');
  const [editGroupId, setEditGroupId] = useState<string>('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        search,
        stage,
        neighborhood,
        paymentStatus,
        registrationStatus,
        groupId
      });
      const res = await fetch(`/api/supervisor/students?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error('Error fetching students', err);
    } finally {
      setLoading(false);
    }
  }, [search, stage, neighborhood, paymentStatus, registrationStatus, groupId]);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/supervisor/groups');
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Error fetching groups', err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const openStudentDetails = (s: Student) => {
    setSelectedStudent(s);
    setEditMode(false);
    
    // Set edit states
    setEditName(s.studentName);
    setEditNationalId(s.nationalId);
    setEditGuardianPhone(s.guardianPhone);
    setEditStudentPhone(s.studentPhone || '');
    setEditStage(s.stage);
    setEditGrade(s.grade);
    setEditNeighborhood(s.neighborhood);
    setEditHasCondition(s.hasCondition);
    setEditConditionNote(s.conditionNote || '');
    setEditPaymentStatus(s.paymentStatus);
    setEditRegistrationStatus(s.registrationStatus);
    setEditGroupId(s.groupId !== null ? s.groupId.toString() : '');
  };

  const handleSaveChanges = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const res = await fetch('/api/supervisor/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStudent.id,
          studentName: editName,
          nationalId: editNationalId,
          guardianPhone: editGuardianPhone,
          studentPhone: editStudentPhone || null,
          stage: editStage,
          grade: editGrade,
          neighborhood: editNeighborhood,
          hasCondition: editHasCondition,
          conditionNote: editHasCondition ? editConditionNote : null,
          paymentStatus: editPaymentStatus,
          groupId: editGroupId ? parseInt(editGroupId, 10) : null,
          registrationStatus: editRegistrationStatus
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Update local list
        setStudents(prev => prev.map(item => item.id === selectedStudent.id ? data.student : item));
        setSelectedStudent(data.student);
        setEditMode(false);
      } else {
        alert(data.error || 'فشل حفظ التعديلات');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في الشبكة');
    } finally {
      setSaving(false);
    }
  };

  const currentGradeOptions = stages.find(s => s.key === editStage)?.grades || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink-900">إدارة الطلاب</h1>
          <p className="text-ink-500 mt-2">عرض بيانات الطلاب المسجلين، تعديل حالاتهم، وتوزيعهم على المجموعات.</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card p-6 bg-white space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="sm:col-span-2">
            <label className="label mb-1.5 block">بحث بالاسم، الهوية، أو الجوال</label>
            <input
              type="text"
              placeholder="ابحث هنا..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="label mb-1.5 block">المرحلة</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="input w-full"
            >
              <option value="">كل المراحل</option>
              {stages.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Neighborhood */}
          <div>
            <label className="label mb-1.5 block">الحي السكني</label>
            <input
              type="text"
              placeholder="مثال: النخيل"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Registration Status */}
          <div>
            <label className="label mb-1.5 block">حالة التسجيل</label>
            <select
              value={registrationStatus}
              onChange={(e) => setRegistrationStatus(e.target.value)}
              className="input w-full"
            >
              <option value="">كل الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="approved">مقبول</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="label mb-1.5 block">حالة الدفع</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="input w-full"
            >
              <option value="">الكل</option>
              <option value="paid">تم الدفع</option>
              <option value="unpaid">لم يدفع</option>
            </select>
          </div>

          {/* Group */}
          <div>
            <label className="label mb-1.5 block">المجموعة</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="input w-full"
            >
              <option value="">كل المجموعات</option>
              <option value="none">غير مصنف</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.stage})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="card bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-ink-500 font-body">جاري تحميل بيانات الطلاب…</div>
        ) : students.length === 0 ? (
          <div className="py-20 text-center text-ink-500 font-body">لم يتم العثور على نتائج تطابق البحث.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-cream-50/70 border-b border-ink-200/60 text-ink-500 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4 pr-6">العضوية</th>
                  <th className="p-4">اسم الطالب</th>
                  <th className="p-4">المرحلة / الصف</th>
                  <th className="p-4">الحي</th>
                  <th className="p-4">المجموعة</th>
                  <th className="p-4">التسجيل</th>
                  <th className="p-4">الرسوم</th>
                  <th className="p-4 pl-6 text-left">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-sm">
                {students.map((s) => {
                  const studentGroup = groups.find(g => g.id === s.groupId);
                  return (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-cream-50/40 transition-colors duration-150 cursor-pointer ${s.hasCondition ? 'bg-red-50/20' : ''}`}
                      onClick={() => openStudentDetails(s)}
                    >
                      <td className="p-4 pr-6 font-display font-semibold text-ink-900">
                        #{s.membershipNo}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-ink-900 flex items-center gap-2">
                          {s.studentName}
                          {s.hasCondition && (
                            <span 
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold"
                              title={`حالة صحية: ${s.conditionNote}`}
                            >
                              🚨
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-ink-500">
                        {s.stage} — {s.grade}
                      </td>
                      <td className="p-4 text-ink-500">
                        {s.neighborhood}
                      </td>
                      <td className="p-4">
                        {studentGroup ? (
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-xs font-semibold">
                            {studentGroup.name}
                          </span>
                        ) : (
                          <span className="text-ink-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.registrationStatus === 'approved' ? 'bg-green-100 text-green-800' : s.registrationStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'انتظار'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {s.paymentStatus === 'paid' ? 'مدفوع' : 'لم يدفع'}
                        </span>
                      </td>
                      <td className="p-4 pl-6 text-left" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => openStudentDetails(s)}
                          className="btn btn-secondary btn-sm"
                        >
                          عرض
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Details & Edit Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto card shadow-xl p-6 sm:p-8 relative">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-ink-100 pb-4 mb-6">
              <div>
                <h2 className="font-display text-2xl text-ink-900">
                  {editMode ? 'تعديل بيانات الطالب' : 'تفاصيل ملف الطالب'}
                </h2>
                <p className="text-xs text-ink-400 mt-1">عضوية رقم #{selectedStudent.membershipNo}</p>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="w-8 h-8 rounded-full bg-cream-50 hover:bg-cream-100 text-ink-600 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Health Alert Alert Banner inside Modal */}
            {selectedStudent.hasCondition && !editMode && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
                <span className="text-xl shrink-0">🚨</span>
                <div>
                  <h4 className="font-bold text-sm">تنبيه حالة صحية أو حساسية:</h4>
                  <p className="text-xs mt-1 leading-relaxed">{selectedStudent.conditionNote}</p>
                </div>
              </div>
            )}

            {/* Edit / View fields */}
            {editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-1 block">الاسم الرباعي</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">رقم الهوية</label>
                    <input 
                      type="text" 
                      value={editNationalId}
                      onChange={e => setEditNationalId(e.target.value)}
                      className="input w-full ltr text-left"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-1 block">جوال ولي الأمر</label>
                    <input 
                      type="text" 
                      value={editGuardianPhone}
                      onChange={e => setEditGuardianPhone(e.target.value)}
                      className="input w-full ltr text-left"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">جوال الطالب (اختياري)</label>
                    <input 
                      type="text" 
                      value={editStudentPhone}
                      onChange={e => setEditStudentPhone(e.target.value)}
                      className="input w-full ltr text-left"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label mb-1 block">المرحلة</label>
                    <select 
                      value={editStage}
                      onChange={e => {
                        setEditStage(e.target.value);
                        setEditGrade('');
                      }}
                      className="input w-full"
                    >
                      {stages.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block">الصف</label>
                    <select 
                      value={editGrade}
                      onChange={e => setEditGrade(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">اختر الصف</option>
                      {currentGradeOptions.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block">الحي السكني</label>
                    <input 
                      type="text" 
                      value={editNeighborhood}
                      onChange={e => setEditNeighborhood(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                </div>

                {/* Health condition toggle */}
                <div className="p-4 rounded-2xl bg-cream-50/50 border border-ink-200/50 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={editHasCondition}
                      onChange={e => setEditHasCondition(e.target.checked)}
                      className="rounded text-brand w-5 h-5 focus:ring-brand"
                    />
                    <span className="font-semibold text-sm text-ink-900">يعاني الطالب من حساسية أو أمراض مزمنة؟</span>
                  </label>
                  {editHasCondition && (
                    <textarea 
                      placeholder="توضيح الحساسية أو المرض بالكامل..."
                      value={editConditionNote}
                      onChange={e => setEditConditionNote(e.target.value)}
                      className="input w-full h-20 resize-none"
                    />
                  )}
                </div>

                {/* Actions Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-ink-100">
                  <div>
                    <label className="label mb-1 block">المجموعة</label>
                    <select 
                      value={editGroupId}
                      onChange={e => setEditGroupId(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">غير مصنف</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.stage})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block">حالة القبول</label>
                    <select 
                      value={editRegistrationStatus}
                      onChange={e => setEditRegistrationStatus(e.target.value)}
                      className="input w-full"
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="approved">مقبول</option>
                      <option value="rejected">مرفوض</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block">حالة الدفع</label>
                    <select 
                      value={editPaymentStatus}
                      onChange={e => setEditPaymentStatus(e.target.value)}
                      className="input w-full"
                    >
                      <option value="unpaid">لم يدفع</option>
                      <option value="paid">تم الدفع</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* View Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div>
                    <span className="text-ink-400 block mb-0.5">الاسم الرباعي</span>
                    <span className="font-semibold text-ink-900">{selectedStudent.studentName}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">رقم الهوية الوطنية</span>
                    <span className="font-semibold text-ink-900 ltr">{selectedStudent.nationalId}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">المرحلة الدراسية والصف</span>
                    <span className="font-semibold text-ink-900">{selectedStudent.stage} — {selectedStudent.grade}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">الحي السكني</span>
                    <span className="font-semibold text-ink-900">{selectedStudent.neighborhood}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">رقم جوال ولي الأمر</span>
                    <span className="font-semibold text-ink-900 ltr">{selectedStudent.guardianPhone}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">رقم جوال الطالب</span>
                    <span className="font-semibold text-ink-900 ltr">{selectedStudent.studentPhone || 'لا يوجد'}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">تاريخ تقديم الطلب</span>
                    <span className="font-semibold text-ink-900">{new Date(selectedStudent.createdAt).toLocaleString('ar-SA')}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">المجموعة</span>
                    <span className="font-semibold text-ink-900">
                      {groups.find(g => g.id === selectedStudent.groupId)?.name || 'غير مصنف'}
                    </span>
                  </div>
                </div>

                {/* Map Coordinates block */}
                {selectedStudent.locationLat && selectedStudent.locationLng && (
                  <div className="p-4 rounded-2xl border border-ink-200/60 bg-cream-50/50">
                    <span className="text-ink-400 text-xs block mb-1.5">الموقع الجغرافي المسجل:</span>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-ink-800">
                        إحداثيات: {selectedStudent.locationLat.toFixed(5)}, {selectedStudent.locationLng.toFixed(5)}
                      </span>
                      <a 
                        href={`https://www.google.com/maps?q=${selectedStudent.locationLat},${selectedStudent.locationLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        عرض على الخريطة ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="mt-8 pt-4 border-t border-ink-100 flex items-center justify-end gap-3">
              {editMode ? (
                <>
                  <button 
                    onClick={() => setEditMode(false)}
                    className="btn btn-secondary"
                    disabled={saving}
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleSaveChanges}
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className="btn btn-secondary"
                  >
                    إغلاق
                  </button>
                  <button 
                    onClick={() => setEditMode(true)}
                    className="btn btn-primary"
                  >
                    تعديل البيانات
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
