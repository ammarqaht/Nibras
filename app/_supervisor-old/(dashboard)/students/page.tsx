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
  mapLink: string | null;
  hasCondition: boolean;
  conditionNote: string | null;
  createdAt: string;
  paymentStatus: string;
  groupId: number | null;
  registrationStatus: string;
  paymentType: string;
  paymentReceipt: string | null;
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
  const [deleting, setDeleting] = useState(false);

  // Editable fields in modal
  const [editName, setEditName] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editGuardianPhone, setEditGuardianPhone] = useState('');
  const [editStudentPhone, setEditStudentPhone] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editMapLink, setEditMapLink] = useState('');
  const [editHasCondition, setEditHasCondition] = useState(false);
  const [editConditionNote, setEditConditionNote] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('unpaid');
  const [editRegistrationStatus, setEditRegistrationStatus] = useState('pending');
  const [editGroupId, setEditGroupId] = useState<string>('');

  // Add manual student states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNationalId, setAddNationalId] = useState('');
  const [addGuardianPhone, setAddGuardianPhone] = useState('');
  const [addStudentPhone, setAddStudentPhone] = useState('');
  const [addStage, setAddStage] = useState('ابتدائي');
  const [addGrade, setAddGrade] = useState('');
  const [addNeighborhood, setAddNeighborhood] = useState('');
  const [addMapLink, setAddMapLink] = useState('');
  const [addHasCondition, setAddHasCondition] = useState(false);
  const [addConditionNote, setAddConditionNote] = useState('');
  const [addPaymentStatus, setAddPaymentStatus] = useState('unpaid');
  const [addRegistrationStatus, setAddRegistrationStatus] = useState('approved');
  const [addGroupId, setAddGroupId] = useState('');
  const [adding, setAdding] = useState(false);

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    if (!confirm(`هل أنت متأكد من حذف الطالب ${selectedStudent.studentName} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/supervisor/students?id=${selectedStudent.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(prev => prev.filter(item => item.id !== selectedStudent.id));
        setSelectedStudent(null);
      } else {
        alert(data.error || 'فشل حذف الطالب');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في الشبكة');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyWhatsapp = () => {
    if (!selectedStudent) return;
    const groupName = groups.find(g => g.id === selectedStudent.groupId)?.name || 'غير مصنف';
    const text = `*بيانات تسجيل الطالب في نادي نبراس:*
اسم الطالب: ${selectedStudent.studentName}
رقم العضوية: #${selectedStudent.membershipNo}
المرحلة/الصف: ${selectedStudent.stage} — ${selectedStudent.grade}
الحي السكني: ${selectedStudent.neighborhood}
جوال ولي الأمر: ${selectedStudent.guardianPhone}
جوال الطالب: ${selectedStudent.studentPhone || 'لا يوجد'}
حالة التسجيل: ${selectedStudent.registrationStatus === 'approved' ? 'مقبول' : selectedStudent.registrationStatus === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
حالة الدفع: ${selectedStudent.paymentStatus === 'paid' ? 'مدفوع' : 'لم يدفع'}
رابط الموقع: ${selectedStudent.mapLink || (selectedStudent.locationLat && selectedStudent.locationLng ? `https://www.google.com/maps?q=${selectedStudent.locationLat},${selectedStudent.locationLng}` : 'غير متوفر')}`;

    navigator.clipboard.writeText(text);
    alert('تم نسخ البيانات المنسقة للواتساب بنجاح! ✅');
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;
    
    const headers = ['العضوية', 'اسم الطالب', 'الهوية', 'جوال ولي الأمر', 'جوال الطالب', 'المرحلة', 'الصف', 'الحي', 'المجموعة', 'حالة التسجيل', 'حالة الدفع', 'رابط الموقع'];
    
    const rows = students.map(s => {
      const groupName = groups.find(g => g.id === s.groupId)?.name || 'غير مصنف';
      const mapLinkStr = s.mapLink || (s.locationLat && s.locationLng ? `https://www.google.com/maps?q=${s.locationLat},${s.locationLng}` : '');
      return [
        s.membershipNo,
        s.studentName,
        s.nationalId,
        s.guardianPhone,
        s.studentPhone || '',
        s.stage,
        s.grade,
        s.neighborhood,
        groupName,
        s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'انتظار',
        s.paymentStatus === 'paid' ? 'مدفوع' : 'لم يدفع',
        mapLinkStr
      ];
    });
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nibras_students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addNationalId || !addGuardianPhone || !addStage || !addGrade || !addNeighborhood) {
      alert('يرجى إكمال جميع الحقول الإلزامية');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/supervisor/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: addName,
          nationalId: addNationalId,
          guardianPhone: addGuardianPhone,
          studentPhone: addStudentPhone || null,
          stage: addStage,
          grade: addGrade,
          neighborhood: addNeighborhood,
          mapLink: addMapLink || null,
          hasCondition: addHasCondition,
          conditionNote: addHasCondition ? addConditionNote : null,
          paymentStatus: addPaymentStatus,
          registrationStatus: addRegistrationStatus,
          groupId: addGroupId || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(prev => [data.student, ...prev]);
        setShowAddModal(false);
        // Reset states
        setAddName('');
        setAddNationalId('');
        setAddGuardianPhone('');
        setAddStudentPhone('');
        setAddStage('ابتدائي');
        setAddGrade('');
        setAddNeighborhood('');
        setAddMapLink('');
        setAddHasCondition(false);
        setAddConditionNote('');
        setAddPaymentStatus('unpaid');
        setAddRegistrationStatus('approved');
        setAddGroupId('');
      } else {
        alert(data.error || 'فشل إضافة الطالب');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في الشبكة');
    } finally {
      setAdding(false);
    }
  };

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
    setEditMapLink(s.mapLink || '');
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
          mapLink: editMapLink || null,
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

  const handleConfirmPayment = async () => {
    if (!selectedStudent) return;
    if (!confirm(`هل أنت متأكد من تأكيد استلام الدفع للطالب ${selectedStudent.studentName}؟`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/supervisor/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStudent.id,
          paymentStatus: 'paid'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(prev => prev.map(item => item.id === selectedStudent.id ? data.student : item));
        setSelectedStudent(data.student);
        alert('تم تأكيد الدفع بنجاح! ✅');
      } else {
        alert(data.error || 'فشل تأكيد الدفع');
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
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="btn btn-secondary flex items-center gap-2"
          >
            📥 تصدير البيانات (CSV)
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            ➕ إضافة طالب جديد
          </button>
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
                        {s.paymentStatus === 'paid' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            مدفوع
                          </span>
                        ) : s.paymentType === 'now' && s.paymentReceipt ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                            بانتظار المراجعة 📑
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            لم يدفع
                          </span>
                        )}
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

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="label mb-1 block">رابط خرائط قوقل ماب (إذا لم يتوفر إحداثيات)</label>
                    <input 
                      type="text" 
                      value={editMapLink}
                      onChange={e => setEditMapLink(e.target.value)}
                      className="input w-full ltr text-left font-mono text-xs"
                      placeholder="مثال: https://maps.google.com/..."
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
                    <div className="flex items-center gap-2 py-2">
                      {editPaymentStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: '#DEF7E5', color: '#1B7A43' }}>✓ مقبول</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: '#FEF3CD', color: '#856404' }}>⏳ قيد المراجعة</span>
                      )}
                      <span className="text-xs text-ink-400">(تلقائي)</span>
                    </div>
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
                  <div>
                    <span className="text-ink-400 block mb-0.5">نوع السداد</span>
                    <span className="font-semibold text-ink-900">
                      {selectedStudent.paymentType === 'now' ? 'دفع فوري (تحويل بنكي)' : 'دفع آجل'}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-400 block mb-0.5">حالة السداد</span>
                    <span className="font-semibold text-ink-950 flex items-center gap-1.5 font-bold">
                      {selectedStudent.paymentStatus === 'paid' ? (
                        <span className="text-green-600">تم الدفع ✅</span>
                      ) : (
                        <span className="text-red-500">لم يدفع ❌</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Map Coordinates or Google Maps Link block */}
                {(selectedStudent.locationLat && selectedStudent.locationLng) || selectedStudent.mapLink ? (
                  <div className="p-4 rounded-2xl border border-ink-200/60 bg-cream-50/50">
                    <span className="text-ink-400 text-xs block mb-1.5">الموقع الجغرافي المسجل:</span>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-ink-800">
                        {selectedStudent.locationLat && selectedStudent.locationLng ? (
                          <>إحداثيات: {selectedStudent.locationLat.toFixed(5)}, {selectedStudent.locationLng.toFixed(5)}</>
                        ) : (
                          <>رابط خرائط قوقل ماب المسجل</>
                        )}
                      </span>
                      <a 
                        href={selectedStudent.mapLink || `https://www.google.com/maps?q=${selectedStudent.locationLat},${selectedStudent.locationLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        عرض على الخريطة ↗
                      </a>
                    </div>
                  </div>
                ) : null}

                {/* Payment Receipt & Details block */}
                {selectedStudent.paymentType === 'now' && (
                  <div className="p-4 rounded-2xl border border-ink-200/60 bg-cream-50/50 space-y-4">
                    <span className="text-ink-400 text-xs block mb-1">تفاصيل الدفع وإيصال التحويل:</span>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-sm font-semibold text-ink-800 block">إيصال السداد المرفوع:</span>
                        {selectedStudent.paymentReceipt ? (
                          <span className="text-xs text-ink-500 block">انقر على الصورة للتكبير أو زر الفتح للمشاهدة بوضوح</span>
                        ) : (
                          <span className="text-xs text-red-500 font-semibold block">لم يتم رفع إيصال التحويل البنكي بعد</span>
                        )}
                      </div>
                      
                      {selectedStudent.paymentReceipt && (
                        <a 
                          href={selectedStudent.paymentReceipt} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm flex items-center gap-1.5"
                        >
                          👁️ فتح الإيصال في صفحة جديدة
                        </a>
                      )}
                    </div>

                    {selectedStudent.paymentReceipt && (
                      <div className="border border-ink-200 rounded-xl overflow-hidden max-w-xs bg-white shadow-sm">
                        <img 
                          src={selectedStudent.paymentReceipt} 
                          alt="إيصال السداد" 
                          className="w-full h-auto object-cover max-h-48 cursor-zoom-in hover:opacity-95 transition-opacity"
                          onClick={() => {
                            window.open(selectedStudent.paymentReceipt!, '_blank');
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Confirm Payment Button when unpaid */}
                {selectedStudent.paymentStatus !== 'paid' && (
                  <div className="p-4 rounded-2xl border border-yellow-200 bg-yellow-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-amber-800 font-semibold text-sm block">لم يتم تأكيد السداد بعد</span>
                      <span className="text-xs text-ink-500">يرجى مراجعة إيصال التحويل (إن وجد) وتأكيد استلام المبلغ بالضغط على الزر المقابل.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      className="btn text-white bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700 flex items-center gap-1.5 w-full sm:w-auto justify-center font-semibold"
                      disabled={saving}
                    >
                      {saving ? 'جاري الحفظ...' : '✅ تأكيد استلام الدفع'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="mt-8 pt-4 border-t border-ink-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {editMode ? (
                <div className="flex items-center justify-end gap-3 w-full">
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
                </div>
              ) : (
                <>
                  <div>
                    <button 
                      onClick={handleDeleteStudent}
                      className="btn btn-danger flex items-center gap-2"
                      disabled={deleting}
                    >
                      🗑️ {deleting ? 'جاري الحذف...' : 'حذف الطالب'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
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
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto card shadow-xl p-6 sm:p-8 relative">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-ink-100 pb-4 mb-6">
              <div>
                <h2 className="font-display text-2xl text-ink-900">إضافة طالب جديد يدوياً</h2>
                <p className="text-xs text-ink-400 mt-1">تعبئة بيانات الطالب ومستوى قبوله ونظام دفعه.</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-cream-50 hover:bg-cream-100 text-ink-600 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">الاسم الرباعي <span className="req">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    className="input w-full"
                    placeholder="محمد بن عبدالله بن علي العتيبي"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">رقم الهوية الوطنية / الإقامة <span className="req">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={addNationalId}
                    onChange={e => setAddNationalId(e.target.value)}
                    className="input w-full ltr text-left"
                    placeholder="1023456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">جوال ولي الأمر <span className="req">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={addGuardianPhone}
                    onChange={e => setAddGuardianPhone(e.target.value)}
                    className="input w-full ltr text-left"
                    placeholder="0500000000"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">جوال الطالب (اختياري)</label>
                  <input 
                    type="text" 
                    value={addStudentPhone}
                    onChange={e => setAddStudentPhone(e.target.value)}
                    className="input w-full ltr text-left"
                    placeholder="0500000000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label mb-1 block">المرحلة الدراسية <span className="req">*</span></label>
                  <select 
                    value={addStage}
                    onChange={e => {
                      setAddStage(e.target.value);
                      setAddGrade('');
                    }}
                    className="input w-full"
                  >
                    {stages.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">الصف الدراسي <span className="req">*</span></label>
                  <select 
                    value={addGrade}
                    onChange={e => setAddGrade(e.target.value)}
                    required
                    className="input w-full"
                  >
                    <option value="">اختر الصف</option>
                    {(stages.find(s => s.key === addStage)?.grades || []).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">الحي السكني <span className="req">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={addNeighborhood}
                    onChange={e => setAddNeighborhood(e.target.value)}
                    className="input w-full"
                    placeholder="مثال: الياسمين"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label mb-1 block">رابط خرائط قوقل ماب لموقع المنزل</label>
                  <input 
                    type="text" 
                    value={addMapLink}
                    onChange={e => setAddMapLink(e.target.value)}
                    className="input w-full ltr text-left font-mono text-xs"
                    placeholder="https://maps.app.goo.gl/..."
                  />
                </div>
              </div>

              {/* Health condition toggle */}
              <div className="p-4 rounded-2xl bg-cream-50/50 border border-ink-200/50 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={addHasCondition}
                    onChange={e => setAddHasCondition(e.target.checked)}
                    className="rounded text-brand w-5 h-5 focus:ring-brand"
                  />
                  <span className="font-semibold text-sm text-ink-900">هل يعاني الطالب من حالة صحية أو حساسية؟</span>
                </label>
                {addHasCondition && (
                  <textarea 
                    placeholder="اكتب تفاصيل الحالة الصحية أو الحساسية هنا بالتفصيل لضمان سلامته..."
                    value={addConditionNote}
                    onChange={e => setAddConditionNote(e.target.value)}
                    className="input w-full h-20 resize-none"
                    required
                  />
                )}
              </div>

              {/* Administrative options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-ink-100">
                <div>
                  <label className="label mb-1 block">المجموعة</label>
                  <select 
                    value={addGroupId}
                    onChange={e => setAddGroupId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">غير مصنف</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.stage})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">حالة التسجيل</label>
                  <select 
                    value={addRegistrationStatus}
                    onChange={e => setAddRegistrationStatus(e.target.value)}
                    className="input w-full"
                  >
                    <option value="approved">مقبول</option>
                    <option value="pending">قيد الانتظار</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">حالة الدفع</label>
                  <select 
                    value={addPaymentStatus}
                    onChange={e => setAddPaymentStatus(e.target.value)}
                    className="input w-full"
                  >
                    <option value="unpaid">لم يدفع</option>
                    <option value="paid">مدفوع</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-8 pt-4 border-t border-ink-100 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  disabled={adding}
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={adding}
                >
                  {adding ? 'جاري الإضافة...' : '➕ إضافة الطالب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
