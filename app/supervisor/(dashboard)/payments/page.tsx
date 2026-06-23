'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { compressImage } from '@/lib/imageUtils';

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

type Tab = 'unpaid' | 'paid' | 'exempted' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'paid', label: 'مدفوع' },
  { key: 'exempted', label: 'معفي' },
  { key: 'unpaid', label: 'غير مدفوع' }
];

function isReview(s: Student) {
  return s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted' && s.paymentType === 'now' && !!s.paymentReceipt;
}


export default function PaymentsPage() {
  const { user } = useSupervisor();
  const allowed = user?.role === 'admin' || user?.role === 'finance';

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      if (tab === 'exempted') return s.paymentStatus === 'exempted';
      if (tab === 'unpaid') return s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted';
      return true;
    });
  }, [students, tab]);

  async function setExempted(id: number) {
    if (!window.confirm('هل أنت متأكد من إعفاء الطالب من الرسوم؟')) return;
    setBusyId(id);
    const r = await fetch('/api/supervisor/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, paymentStatus: 'exempted' })
    });
    setBusyId(null);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل إعفاء الطالب');
    pushToast('success', 'تم إعفاء الطالب من الرسوم');
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, paymentStatus: 'exempted', registrationStatus: 'approved' } : s)));
    if (selectedStudent?.id === id) {
      setSelectedStudent((prev) => prev ? { ...prev, paymentStatus: 'exempted', registrationStatus: 'approved' } : null);
    }
  }

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
              <span className="font-bold text-amber-500 mr-1 inline-flex items-center gap-1">
                <span>({reviewCount} مراجعة)</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
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
                    <th className="text-center pl-6">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">
                        {s.studentName}
                        {s.hasCondition && (
                          <span title="حالة صحية" className="mr-1 inline-flex items-center text-red-600">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          </span>
                        )}
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
                        <span className={`pill ${s.paymentStatus === 'paid' ? 'pill-green' : s.paymentStatus === 'exempted' ? 'pill-blue' : isReview(s) ? 'pill-yellow' : 'pill-red'}`}>
                          {s.paymentStatus === 'paid' ? 'مدفوع' : s.paymentStatus === 'exempted' ? 'معفي' : isReview(s) ? 'بانتظار المراجعة' : 'لم يدفع'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 justify-center pl-6">
                          <button
                            onClick={() => setSelectedStudent(s)}
                            className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>بيانات الطالب</span>
                          </button>
                          {s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' ? (
                            <button
                              onClick={() => cancelConfirm(s.id)}
                              disabled={busyId === s.id}
                              className="btn btn-danger py-1 px-3 text-xs flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                              <span>إلغاء الدفع</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => confirm(s.id)}
                                disabled={busyId === s.id}
                                className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1"
                                style={{ background: '#1B7A43' }}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>تأكيد الدفع</span>
                              </button>
                              <button
                                onClick={() => setExempted(s.id)}
                                disabled={busyId === s.id}
                                className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                              >
                                إعفاء
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden space-y-4 p-4 bg-cream-50/50 font-sans">
              {filtered.map((s) => {
                const isExpanded = !!expandedIds[s.id];
                return (
                  <div key={s.id} className="card p-4 flex flex-col gap-3 shadow-sm border border-line bg-white rounded-xl transition-all">
                    {/* Header Row (Always Visible) */}
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-ink-900 text-base">
                            {s.studentName}
                            {s.hasCondition && (
                              <span title="حالة صحية" className="mr-1 inline-flex items-center text-red-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                  <line x1="12" y1="9" x2="12" y2="13" />
                                  <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                              </span>
                            )}
                          </h3>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cream-100 text-ink-600">
                            {s.stage}
                          </span>
                        </div>
                        <span dir="ltr" className="font-mono text-xs text-ink-400">#{s.membershipNo}</span>
                      </div>
                      <span className={`pill shrink-0 ${s.paymentStatus === 'paid' ? 'pill-green' : s.paymentStatus === 'exempted' ? 'pill-blue' : isReview(s) ? 'pill-yellow' : 'pill-red'}`}>
                        {s.paymentStatus === 'paid' ? 'مدفوع' : s.paymentStatus === 'exempted' ? 'معفي' : isReview(s) ? 'بانتظار المراجعة' : 'لم يدفع'}
                      </span>
                    </div>

                    {/* Expandable Section */}
                    {isExpanded && (
                      <div className="space-y-3 pt-3 border-t border-line fade-in">
                        {/* Student Details Grid */}
                        <div className="grid grid-cols-2 gap-3 text-[11px] text-ink-600 bg-cream-50/30 p-2.5 rounded-lg border border-ink-100">
                          <div>
                            <span className="text-ink-400 block mb-0.5">الهوية الوطنية</span>
                            <span className="font-semibold">{s.nationalId || '—'}</span>
                          </div>
                          <div>
                            <span className="text-ink-400 block mb-0.5">ولي الأمر</span>
                            <span className="font-semibold" dir="ltr">{s.guardianPhone || '—'}</span>
                          </div>
                          <div>
                            <span className="text-ink-400 block mb-0.5">الحي السكني</span>
                            <span className="font-semibold">{s.neighborhood || '—'}</span>
                          </div>
                          <div>
                            <span className="text-ink-400 block mb-0.5">نوع الدفع</span>
                            <span className="pill pill-gray font-medium text-[9px] py-0.5 px-1.5">{s.paymentType === 'now' ? 'فوري' : 'آجل'}</span>
                          </div>
                        </div>

                        {/* Receipt Block (if paymentType is now) */}
                        {s.paymentType === 'now' && (
                          <div className="text-[11px] flex justify-between items-center bg-cream-50/50 p-2 rounded-lg border border-line">
                            <span className="text-ink-500 font-semibold">إيصال التحويل:</span>
                            {s.paymentReceipt ? (
                              <button
                                onClick={() => openReceipt(s.paymentReceipt!)}
                                className="btn btn-secondary py-1 px-2.5 text-[10px] inline-flex items-center gap-1 rounded-md"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                <span>عرض الإيصال</span>
                              </button>
                            ) : (
                              <span className="text-ink-300">—</span>
                            )}
                          </div>
                        )}

                        {/* Actions Row - Smaller buttons */}
                        <div className="flex gap-2 pt-1">
                          {s.paymentStatus === 'paid' || s.paymentStatus === 'exempted' ? (
                            <button
                              onClick={() => cancelConfirm(s.id)}
                              disabled={busyId === s.id}
                              className="btn btn-danger py-1.5 px-2.5 text-[11px] flex-1 flex items-center justify-center gap-1 rounded-lg"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                              <span>إلغاء التأكيد</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => confirm(s.id)}
                                disabled={busyId === s.id}
                                className="btn text-white border-transparent py-1.5 px-2.5 text-[11px] flex-1 flex items-center justify-center gap-1 rounded-lg"
                                style={{ background: '#1B7A43' }}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>تأكيد الدفع</span>
                              </button>
                              <button
                                onClick={() => setExempted(s.id)}
                                disabled={busyId === s.id}
                                className="btn btn-secondary py-1.5 px-2.5 text-[11px] flex-1 flex items-center justify-center gap-1 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg"
                              >
                                إعفاء
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedStudent(s)}
                            className="btn btn-secondary py-1.5 px-2.5 text-[11px] flex items-center justify-center rounded-lg"
                            title="بيانات الطالب الكاملة"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Toggle Button */}
                    <button
                      onClick={() => toggleExpand(s.id)}
                      className="btn btn-secondary py-1.5 px-3 text-xs w-full justify-center gap-1 mt-1 border-dashed"
                    >
                      {isExpanded ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                          <span>إخفاء التفاصيل</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          <span>عرض باقي التفاصيل</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
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
      const base64 = await compressImage(file, 200);
      
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
            <span className={`pill ${student.paymentStatus === 'paid' ? 'pill-green' : student.paymentStatus === 'exempted' ? 'pill-blue' : isReview(student) ? 'pill-yellow' : 'pill-red'}`}>
              {student.paymentStatus === 'paid' ? 'مدفوع' : student.paymentStatus === 'exempted' ? 'معفي' : isReview(student) ? 'بانتظار المراجعة' : 'لم يدفع'}
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
              <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
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
                  <svg className="w-3.5 h-3.5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>اتصال</span>
                </a>
                <a
                  href={guardianWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn text-white py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-md"
                  style={{ background: '#128C7E' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>واتساب</span>
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
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>اتصال</span>
                  </a>
                  {studentWhatsappUrl && (
                    <a
                      href={studentWhatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-white py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-md"
                      style={{ background: '#128C7E' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                      <span>واتساب</span>
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
                {uploadingReceipt ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
                    </svg>
                    <span>جارٍ الرفع...</span>
                  </>
                ) : student.paymentReceipt ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                    <span>تغيير الإيصال</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    <span>إرفاق صورة الإيصال</span>
                  </>
                )}
              </button>
            </div>

            {student.paymentReceipt ? (
              <div className="bg-cream-50 p-3 rounded-lg border border-line flex flex-col gap-2">
                <span className="text-xs text-ink-500 font-semibold">تم رفع الإيصال بنجاح</span>
                <button
                  onClick={() => openReceipt(student.paymentReceipt!)}
                  className="btn btn-secondary py-1.5 px-3 text-xs w-full justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>عرض الإيصال المرفق بكامل الحجم</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs flex items-start gap-1.5">
                <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>لم يقم الطالب بإرفاق إيصال التحويل بعد. يمكنك إرفاق صورة الإيصال يدوياً بالضغط على زر الرفع أعلاه.</span>
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
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              <span>إلغاء تأكيد الدفع</span>
            </button>
          ) : (
            <button
              onClick={() => onConfirm(student.id)}
              disabled={busyId === student.id}
              className="btn text-white border-transparent py-2 px-4 text-xs flex-1 flex justify-center items-center gap-1"
              style={{ background: '#1B7A43' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>تأكيد استلام الدفع</span>
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
