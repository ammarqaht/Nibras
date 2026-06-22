'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

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
  hasCondition: boolean;
  conditionNote: string | null;
  paymentStatus: string;
  paymentType: string;
  paymentReceipt: string | null;
  registrationStatus: string;
};

type Tab = 'unpaid' | 'paid' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'paid', label: 'مدفوع' },
  { key: 'unpaid', label: 'غير مدفوع' }
];

function isReview(s: Student) {
  return s.paymentStatus !== 'paid' && s.paymentType === 'now' && !!s.paymentReceipt;
}

/* client-side image compression */
function compressImage(file: File, maxDim = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(e.target?.result as string);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PaymentsPage() {
  const { user } = useSupervisor();
  const allowed = user?.role === 'admin' || user?.role === 'finance';

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  async function load() {
    const r = await fetch('/api/supervisor/students', { cache: 'no-store' });
    setStudents((await r.json().catch(() => ({ students: [] }))).students ?? []);
    setLoading(false);
  }
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (tab === 'all') return true;
      if (tab === 'paid') return s.paymentStatus === 'paid';
      if (tab === 'unpaid') return s.paymentStatus !== 'paid';
      return true;
    });
  }, [students, tab]);

  async function confirm(id: number) {
    setBusyId(id);
    const r = await fetch('/api/supervisor/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, paymentStatus: 'paid' })
    });
    setBusyId(null);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل التأكيد');
    pushToast('success', 'تم تأكيد استلام الدفع');
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, paymentStatus: 'paid', registrationStatus: 'approved' } : s)));
    if (selectedStudent?.id === id) {
      setSelectedStudent((prev) => prev ? { ...prev, paymentStatus: 'paid', registrationStatus: 'approved' } : null);
    }
  }

  async function cancelConfirm(id: number) {
    if (!window.confirm('هل أنت متأكد من إلغاء تأكيد الدفع؟ ستتغير حالة الدفع إلى غير مدفوع وحالة التسجيل إلى قيد المراجعة.')) return;
    setBusyId(id);
    const r = await fetch('/api/supervisor/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, paymentStatus: 'unpaid' })
    });
    setBusyId(null);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل إلغاء التأكيد');
    pushToast('success', 'تم إلغاء تأكيد الدفع بنجاح');
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, paymentStatus: 'unpaid', registrationStatus: 'pending' } : s)));
    if (selectedStudent?.id === id) {
      setSelectedStudent((prev) => prev ? { ...prev, paymentStatus: 'unpaid', registrationStatus: 'pending' } : null);
    }
  }

  async function updateStudentReceipt(id: number, base64: string) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, paymentReceipt: base64, paymentType: 'now' } : s)));
    if (selectedStudent?.id === id) {
      setSelectedStudent((prev) => prev ? { ...prev, paymentReceipt: base64, paymentType: 'now' } : null);
    }
  }

  async function openReceipt(receipt: string) {
    try {
      const res = await fetch(receipt);
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch {
      window.open(receipt, '_blank');
    }
  }

  const reviewCount = students.filter(isReview).length;

  if (user && !allowed) {
    return <div className="card p-10 text-center text-ink-500">هذه الصفحة متاحة للمالية والمدير العام فقط.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">المدفوعات</h1>
        <p className="text-sm text-ink-500">مراجعة إيصالات التحويل وتأكيد استلام الرسوم.</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`choice text-sm ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'unpaid' && reviewCount > 0 && (
              <span className="font-bold text-amber-500 mr-1"> ({reviewCount} مراجعة 📑)</span>
            )}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-ink-400 text-sm">لا توجد سجلات في هذا التصنيف.</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto scroll-soft">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>العضوية</th>
                    <th>نوع الدفع</th>
                    <th>الإيصال</th>
                    <th>الحالة</th>
                    <th className="text-left pl-6">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">
                        {s.studentName}
                        {s.hasCondition && <span title="حالة صحية" className="mr-1">🚨</span>}
                      </td>
                      <td dir="ltr" className="text-right font-mono text-ink-500">#{s.membershipNo}</td>
                      <td><span className="pill pill-gray">{s.paymentType === 'now' ? 'فوري' : 'آجل'}</span></td>
                      <td>
                        {s.paymentReceipt ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.paymentReceipt}
                            alt="إيصال"
                            onClick={() => openReceipt(s.paymentReceipt!)}
                            className="w-12 h-12 object-cover rounded-md border border-ink-200 cursor-pointer"
                          />
                        ) : (
                          <span className="text-ink-300 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${s.paymentStatus === 'paid' ? 'pill-green' : isReview(s) ? 'pill-yellow' : 'pill-red'}`}>
                          {s.paymentStatus === 'paid' ? 'مدفوع' : isReview(s) ? 'بانتظار المراجعة' : 'لم يدفع'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 justify-end pl-6">
                          <button
                            onClick={() => setSelectedStudent(s)}
                            className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                          >
                            👁️ بيانات الطالب
                          </button>
                          {s.paymentStatus === 'paid' ? (
                            <button
                              onClick={() => cancelConfirm(s.id)}
                              disabled={busyId === s.id}
                              className="btn btn-danger py-1 px-3 text-xs flex items-center gap-1"
                            >
                              ❌ إلغاء التأكيد
                            </button>
                          ) : (
                            <button
                              onClick={() => confirm(s.id)}
                              disabled={busyId === s.id}
                              className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1"
                              style={{ background: '#1B7A43' }}
                            >
                              ✅ تأكيد الدفع
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden space-y-4 p-4 bg-cream-50/50">
              {filtered.map((s) => (
                <div key={s.id} className="card p-4 flex flex-col gap-3 shadow-sm border border-line bg-white rounded-xl">
                  {/* Header Row */}
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink-900 text-base truncate">
                        {s.studentName}
                        {s.hasCondition && <span title="حالة صحية" className="mr-1">🚨</span>}
                      </h3>
                      <span dir="ltr" className="font-mono text-xs text-ink-400">#{s.membershipNo}</span>
                    </div>
                    <span className={`pill ${s.paymentStatus === 'paid' ? 'pill-green' : isReview(s) ? 'pill-yellow' : 'pill-red'}`}>
                      {s.paymentStatus === 'paid' ? 'مدفوع' : isReview(s) ? 'بانتظار المراجعة' : 'لم يدفع'}
                    </span>
                  </div>

                  {/* Info Row / Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-y border-line py-3 my-1">
                    <div>
                      <span className="text-ink-400 block mb-1">نوع الدفع</span>
                      <span className="pill pill-gray font-medium">{s.paymentType === 'now' ? 'فوري' : 'آجل'}</span>
                    </div>
                    <div>
                      <span className="text-ink-400 block mb-1">إيصال السداد</span>
                      {s.paymentReceipt ? (
                        <div className="flex items-center gap-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.paymentReceipt}
                            alt="إيصال"
                            onClick={() => openReceipt(s.paymentReceipt!)}
                            className="w-8 h-8 object-cover rounded border border-ink-200 cursor-pointer"
                          />
                          <button 
                            onClick={() => openReceipt(s.paymentReceipt!)}
                            className="text-blue hover:underline text-[10px]"
                          >
                            عرض الإيصال
                          </button>
                        </div>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setSelectedStudent(s)}
                      className="btn btn-secondary py-2 px-3 text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      👁️ بيانات الطالب
                    </button>
                    {s.paymentStatus === 'paid' ? (
                      <button
                        onClick={() => cancelConfirm(s.id)}
                        disabled={busyId === s.id}
                        className="btn btn-danger py-2 px-3 text-xs flex-1 flex items-center justify-center gap-1"
                      >
                        ❌ إلغاء التأكيد
                      </button>
                    ) : (
                      <button
                        onClick={() => confirm(s.id)}
                        disabled={busyId === s.id}
                        className="btn text-white border-transparent py-2 px-3 text-xs flex-1 flex items-center justify-center gap-1"
                        style={{ background: '#1B7A43' }}
                      >
                        ✅ تأكيد الدفع
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedStudent && (
        <StudentDetailsModal
          student={selectedStudent}
          busyId={busyId}
          onClose={() => setSelectedStudent(null)}
          onConfirm={confirm}
          onCancelConfirm={cancelConfirm}
          onUpdateStudentReceipt={updateStudentReceipt}
        />
      )}
    </div>
  );
}

function StudentDetailsModal({
  student,
  busyId,
  onClose,
  onConfirm,
  onCancelConfirm,
  onUpdateStudentReceipt
}: {
  student: Student;
  busyId: number | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
  onCancelConfirm: (id: number) => void;
  onUpdateStudentReceipt: (id: number, base64: string) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const formattedGuardianPhone = student.guardianPhone.startsWith('05')
    ? '966' + student.guardianPhone.slice(1)
    : student.guardianPhone.startsWith('+')
    ? student.guardianPhone.slice(1)
    : student.guardianPhone;
  const guardianWhatsappUrl = `https://wa.me/${formattedGuardianPhone}`;

  const formattedStudentPhone = student.studentPhone
    ? student.studentPhone.startsWith('05')
      ? '966' + student.studentPhone.slice(1)
      : student.studentPhone.startsWith('+')
      ? student.studentPhone.slice(1)
      : student.studentPhone
    : null;
  const studentWhatsappUrl = formattedStudentPhone ? `https://wa.me/${formattedStudentPhone}` : null;

  async function openReceipt(receipt: string) {
    try {
      const res = await fetch(receipt);
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch {
      window.open(receipt, '_blank');
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      return pushToast('error', 'حجم الملف يجب ألا يتجاوز 20 ميجابايت');
    }

    try {
      setUploadingReceipt(true);
      const base64 = await compressImage(file, 1200, 0.7);
      
      const r = await fetch('/api/supervisor/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: student.id, paymentReceipt: base64, paymentType: 'now' })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'فشل رفع الإيصال');
      pushToast('success', 'تم حفظ صورة الإيصال بنجاح');
      await onUpdateStudentReceipt(student.id, base64);
    } catch (err: any) {
      pushToast('error', err.message || 'حدث خطأ أثناء رفع صورة الإيصال');
    } finally {
      setUploadingReceipt(false);
    }
  }

  return (
    <div className="modal-backdrop flex items-center justify-center p-4 z-[999]" onClick={onClose}>
      <div className="modal-panel w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-line bg-cream-50/50">
          <div>
            <h3 className="font-bold text-lg text-ink-900">{student.studentName}</h3>
            <span dir="ltr" className="text-xs font-mono text-ink-500">#{student.membershipNo}</span>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl font-bold leading-none p-1">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm scroll-soft flex-1">
          {/* Status Indicators */}
          <div className="flex gap-2 flex-wrap">
            <span className={`pill ${student.paymentStatus === 'paid' ? 'pill-green' : isReview(student) ? 'pill-yellow' : 'pill-red'}`}>
              {student.paymentStatus === 'paid' ? 'مدفوع' : isReview(student) ? 'بانتظار المراجعة' : 'لم يدفع'}
            </span>
            <span className="pill pill-gray text-xs font-semibold">
              {student.paymentType === 'now' ? 'فوري' : 'آجل'}
            </span>
          </div>

          {/* Student Info Grid */}
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <span className="text-ink-500 text-xs block mb-1">رقم الهوية</span>
              <span dir="ltr" className="font-mono text-ink-900 font-semibold">{student.nationalId}</span>
            </div>
            <div>
              <span className="text-ink-500 text-xs block mb-1">المرحلة والصف</span>
              <span className="text-ink-900 font-semibold">{student.stage} — {student.grade}</span>
            </div>
            <div>
              <span className="text-ink-500 text-xs block mb-1">الحي السكني</span>
              <span className="text-ink-900 font-semibold">{student.neighborhood}</span>
            </div>
            <div>
              <span className="text-ink-500 text-xs block mb-1">حالة التسجيل</span>
              <span className={`pill ${student.registrationStatus === 'approved' ? 'pill-green' : student.registrationStatus === 'rejected' ? 'pill-red' : student.registrationStatus === 'pending' ? 'pill-yellow' : 'pill-gray'}`}>
                {student.registrationStatus === 'approved' ? 'مقبول' : student.registrationStatus === 'rejected' ? 'مرفوض' : student.registrationStatus === 'pending' ? 'قيد الانتظار' : 'غير محدد'}
              </span>
            </div>
          </div>

          {/* Condition Alert */}
          {student.hasCondition && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex gap-2 items-start">
              <span className="text-base">🚨</span>
              <div>
                <span className="font-bold block mb-0.5">حالة صحية خاصة:</span>
                <span>{student.conditionNote || 'لا توجد تفاصيل'}</span>
              </div>
            </div>
          )}

          {/* Contact Actions */}
          <div className="border-t border-line pt-4 space-y-3">
            <h4 className="font-bold text-xs text-ink-500">بيانات الاتصال والتواصل</h4>
            
            {/* Guardian contact */}
            <div className="flex items-center justify-between bg-cream-50 p-2.5 rounded-lg border border-line">
              <div>
                <span className="text-xs text-ink-500 block">ولي الأمر</span>
                <span dir="ltr" className="font-mono text-xs text-ink-800">{student.guardianPhone}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={`tel:${student.guardianPhone}`}
                  className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 rounded-md"
                >
                  📞 اتصال
                </a>
                <a
                  href={guardianWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn text-white py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-md"
                  style={{ background: '#128C7E' }}
                >
                  💬 واتساب
                </a>
              </div>
            </div>

            {/* Student contact */}
            {student.studentPhone && (
              <div className="flex items-center justify-between bg-cream-50 p-2.5 rounded-lg border border-line">
                <div>
                  <span className="text-xs text-ink-500 block">جوال الطالب</span>
                  <span dir="ltr" className="font-mono text-xs text-ink-800">{student.studentPhone}</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`tel:${student.studentPhone}`}
                    className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 rounded-md"
                  >
                    📞 اتصال
                  </a>
                  {studentWhatsappUrl && (
                    <a
                      href={studentWhatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-white py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-md"
                      style={{ background: '#128C7E' }}
                    >
                      💬 واتساب
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Receipt Section */}
          <div className="border-t border-line pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-500 text-xs">إيصال التحويل المرفق</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploadingReceipt}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingReceipt}
                className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 rounded-md"
              >
                {uploadingReceipt ? '⏳ جارٍ الرفع...' : student.paymentReceipt ? '📝 تغيير الإيصال' : '📤 إرفاق صورة الإيصال'}
              </button>
            </div>

            {student.paymentReceipt ? (
              <div className="flex items-start gap-3 bg-cream-50 p-3 rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={student.paymentReceipt}
                  alt="إيصال التحويل"
                  onClick={() => openReceipt(student.paymentReceipt!)}
                  className="w-16 h-16 object-cover rounded border border-ink-200 cursor-pointer"
                />
                <div className="flex flex-col gap-1.5 justify-center h-full">
                  <span className="text-xs text-ink-500">تم رفع الإيصال بنجاح</span>
                  <button
                    onClick={() => openReceipt(student.paymentReceipt!)}
                    className="btn btn-secondary py-1 px-3 text-xs self-start"
                  >
                    👁️ فتح الإيصال بكامل الحجم
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs">
                ⚠️ لم يقم الطالب بإرفاق إيصال التحويل بعد. يمكنك إرفاق صورة الإيصال يدوياً بالضغط على زر الرفع أعلاه.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line bg-cream-50/50 flex gap-2">
          {student.paymentStatus === 'paid' ? (
            <button
              onClick={() => onCancelConfirm(student.id)}
              disabled={busyId === student.id}
              className="btn btn-danger py-2 px-4 text-xs flex-1 flex justify-center items-center gap-1"
            >
              ❌ إلغاء تأكيد الدفع
            </button>
          ) : (
            <button
              onClick={() => onConfirm(student.id)}
              disabled={busyId === student.id}
              className="btn text-white border-transparent py-2 px-4 text-xs flex-1 flex justify-center items-center gap-1"
              style={{ background: '#1B7A43' }}
            >
              ✅ تأكيد استلام الدفع
            </button>
          )}
          <button
            onClick={onClose}
            className="btn btn-secondary py-2 px-4 text-xs flex-1"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
