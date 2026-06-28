'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { compressImage } from '@/lib/imageUtils';
import { StageMultiSelectDropdown, MultiSelectDropdown } from '@/components/StudentFilters';

type Student = {
  id: number;
  membershipNo: number;
  studentName: string;
  nationalId: string;
  guardianPhone: string;
  studentPhone: string | null;
  stage: string;
  grade: string;
  groupId: number | null;
  neighborhood: string;
  locationLat: number | null;
  locationLng: number | null;
  mapLink: string | null;
  hasCondition: boolean;
  conditionNote: string | null;
  paymentStatus: string;
  paymentType: string;
  paymentReceipt: string | null;
  registrationStatus: string;
};

const PAY_STATUS_OPTIONS = [
  { value: 'paid', label: 'مدفوع' },
  { value: 'exempted', label: 'معفي' },
  { value: 'unpaid', label: 'غير مدفوع' },
  { value: 'review', label: 'بانتظار المراجعة' },
];

function isReview(s: Student) {
  return s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted' && s.paymentType === 'now' && !!s.paymentReceipt;
}

function matchesPayStatus(s: Student, statuses: string[]) {
  if (statuses.length === 0) return true;
  return statuses.some((st) =>
    st === 'paid' ? s.paymentStatus === 'paid' :
    st === 'exempted' ? s.paymentStatus === 'exempted' :
    st === 'unpaid' ? (s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted') :
    st === 'review' ? isReview(s) : false
  );
}


export default function PaymentsPage() {
  const { user } = useSupervisor();
  const allowed = (user?.role ?? '').split(',').map((r) => r.trim()).some((r) => r === 'admin' || r === 'finance' || r === 'finance_supervisor');

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fStages, setFStages] = useState<string[]>([]);
  const [fNeighborhoods, setFNeighborhoods] = useState<string[]>([]);
  const [fPayStatus, setFPayStatus] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  async function load() {
    const sr = await fetch('/api/supervisor/students', { cache: 'no-store' });
    setStudents((await sr.json().catch(() => ({ students: [] }))).students ?? []);
    setLoading(false);
  }
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

  const neighborhoods = useMemo(() => {
    const set = new Set(students.map(s => s.neighborhood).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const hit =
          s.studentName.toLowerCase().includes(q) ||
          s.nationalId.includes(q) ||
          s.guardianPhone.includes(q) ||
          (s.studentPhone ?? '').includes(q) ||
          String(s.membershipNo).includes(q);
        if (!hit) return false;
      }
      if (fStages.length > 0) {
        const hasStageMatch = fStages.includes(`stage:${s.stage}`);
        const hasGradeMatch = fStages.includes(`grade:${s.grade}`);
        if (!hasStageMatch && !hasGradeMatch) return false;
      }
      if (fNeighborhoods.length > 0 && !fNeighborhoods.includes(s.neighborhood)) return false;
      if (!matchesPayStatus(s, fPayStatus)) return false;
      return true;
    });
  }, [students, search, fStages, fNeighborhoods, fPayStatus]);

  function exportCsv() {
    const headers = [
      'رقم العضوية', 'اسم الطالب', 'رقم الهوية', 'جوال ولي الأمر', 'جوال الطالب',
      'المرحلة', 'الصف', 'الحي', 'حالة الدفع', 'نوع الدفع', 'حالة التسجيل', 'حالة صحية', 'الموقع',
    ];
    const statusLabel = (s: Student) =>
      s.paymentStatus === 'paid' ? 'مدفوع' : s.paymentStatus === 'exempted' ? 'معفي' : isReview(s) ? 'بانتظار المراجعة' : 'لم يدفع';
    const mapLink = (s: Student) =>
      s.mapLink ? s.mapLink : (s.locationLat != null && s.locationLng != null ? `https://www.google.com/maps?q=${s.locationLat},${s.locationLng}` : '');
    const rows = filtered.map((s) => [
      s.membershipNo, s.studentName, s.nationalId, s.guardianPhone, s.studentPhone ?? '',
      s.stage, s.grade, s.neighborhood, statusLabel(s),
      s.paymentType === 'now' ? 'فوري' : 'آجل',
      s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة',
      s.hasCondition ? 'نعم' : 'لا', mapLink(s),
    ]);
    const esc = (v: unknown) => {
      const str = String(v ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csv = '﻿' + [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nibras-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  async function deleteStudent(id: number, name: string) {
    if (!window.confirm(`هل أنت متأكد من حذف الطالب «${name}» نهائياً من النظام؟ سيتم حذف جميع بياناته بشكل كامل ولا يمكن استعادتها.`)) return;
    setBusyId(id);
    const r = await fetch(`/api/supervisor/students?id=${id}`, {
      method: 'DELETE'
    });
    setBusyId(null);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل حذف الطالب');
    pushToast('success', 'تم حذف الطالب بنجاح من النظام');
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setSelectedStudent(null);
  }

  async function openReceipt(receipt: string) {
    if (receipt.startsWith('data:')) {
      const w = window.open();
      if (w) {
        w.document.write(`
          <html>
            <head>
              <title>إيصال التحويل</title>
              <style>
                body { margin: 0; display: flex; align-items: center; justify-content: center; background: #000; min-height: 100vh; }
                img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${receipt}" alt="Receipt" />
            </body>
          </html>
        `);
        w.document.close();
      }
    } else {
      window.open(receipt, '_blank');
    }
  }

  if (user && !allowed) {
    return <div className="card p-10 text-center text-ink-500">هذه الصفحة متاحة للمالية والمدير العام فقط.</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">المدفوعات</h1>
          <p className="text-sm text-ink-500">مراجعة إيصالات التحويل وتأكيد استلام الرسوم.</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          <span>تنزيل بيانات الطلاب (CSV)</span>
        </button>
      </div>

      {/* Filters — matching the students page layout */}
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative flex items-center w-full">
            <input
              className="field pl-8 w-full"
              placeholder="بحث بالاسم / الهوية / الجوال / العضوية…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute left-2.5 text-ink-400 hover:text-ink-900 text-lg font-bold leading-none p-1" title="مسح البحث">×</button>
            )}
          </div>

          {/* Stages */}
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 min-w-0">
              <StageMultiSelectDropdown selected={fStages} onChange={setFStages} />
            </div>
            {fStages.length > 0 && (
              <button onClick={() => setFStages([])} className="text-ink-400 hover:text-ink-900 text-xl font-bold p-1 leading-none shrink-0" title="مسح تصفية المراحل">×</button>
            )}
          </div>

          {/* Neighborhoods */}
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 min-w-0">
              <MultiSelectDropdown label="تصفية الأحياء" options={neighborhoods.map((n) => ({ value: n, label: n }))} selected={fNeighborhoods} onChange={setFNeighborhoods} />
            </div>
            {fNeighborhoods.length > 0 && (
              <button onClick={() => setFNeighborhoods([])} className="text-ink-400 hover:text-ink-900 text-xl font-bold p-1 leading-none shrink-0" title="مسح تصفية الأحياء">×</button>
            )}
          </div>

          {/* Payment status */}
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 min-w-0">
              <MultiSelectDropdown label="حالة الدفع" options={PAY_STATUS_OPTIONS} selected={fPayStatus} onChange={setFPayStatus} />
            </div>
            {fPayStatus.length > 0 && (
              <button onClick={() => setFPayStatus([])} className="text-ink-400 hover:text-ink-900 text-xl font-bold p-1 leading-none shrink-0" title="مسح تصفية حالة الدفع">×</button>
            )}
          </div>
        </div>
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
                    <th className="w-[18%]">الطالب</th>
                    <th className="w-[8%]">العضوية</th>
                    <th className="w-[14%]">المرحلة</th>
                    <th className="w-[10%]">نوع الدفع</th>
                    <th className="w-[10%]">الإيصال</th>
                    <th className="w-[10%]">الحالة</th>
                    <th className="!text-center pl-6 w-[40%]">الإجراءات</th>
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
                      <td className="text-xs text-ink-600">{s.stage} — {s.grade}</td>
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
                        <div className="flex items-center gap-1.5 justify-end pl-6 whitespace-nowrap">
                          {s.paymentStatus !== 'paid' && s.paymentStatus !== 'exempted' && (
                            <>
                              <button
                                onClick={() => confirm(s.id)}
                                disabled={busyId === s.id}
                                className="btn text-white border-transparent py-1.5 px-3 text-xs flex items-center gap-1 whitespace-nowrap active:scale-95 transition-all"
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
                                className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 whitespace-nowrap active:scale-95 transition-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <span>إعفاء</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedStudent(s)}
                            className="btn btn-secondary py-1.5 px-2.5 text-xs flex items-center justify-center whitespace-nowrap active:scale-95 transition-all"
                            title="بيانات الطالب"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
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
                            {s.stage} — {s.grade}
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
          isAdmin={user?.role === 'admin'}
          onClose={() => setSelectedStudent(null)}
          onConfirm={confirm}
          onCancelConfirm={cancelConfirm}
          onUpdateStudentReceipt={updateStudentReceipt}
          onDelete={deleteStudent}
        />
      )}
    </div>
  );
}

function StudentDetailsModal({
  student,
  busyId,
  isAdmin,
  onClose,
  onConfirm,
  onCancelConfirm,
  onUpdateStudentReceipt,
  onDelete
}: {
  student: Student;
  busyId: number | null;
  isAdmin: boolean;
  onClose: () => void;
  onConfirm: (id: number) => void;
  onCancelConfirm: (id: number) => void;
  onUpdateStudentReceipt: (id: number, base64: string) => Promise<void>;
  onDelete: (id: number, name: string) => Promise<void>;
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

  const mapsHref = student.mapLink
    ? student.mapLink
    : student.locationLat != null && student.locationLng != null
    ? `https://www.google.com/maps?q=${student.locationLat},${student.locationLng}`
    : null;

  async function openReceipt(receipt: string) {
    if (receipt.startsWith('data:')) {
      const w = window.open();
      if (w) {
        w.document.write(`
          <html>
            <head>
              <title>إيصال التحويل</title>
              <style>
                body { margin: 0; display: flex; align-items: center; justify-content: center; background: #000; min-height: 100vh; }
                img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${receipt}" alt="Receipt" />
            </body>
          </html>
        `);
        w.document.close();
      }
    } else {
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
      const base64 = await compressImage(file, 50);
      
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

          {/* Geographic location */}
          <div className="border-t border-line pt-4">
            <div className="flex items-center justify-between bg-cream-50 p-2.5 rounded-lg border border-line">
              <div className="min-w-0">
                <span className="text-xs text-ink-500 block">الموقع الجغرافي</span>
                <span className="text-xs text-ink-800 font-semibold">
                  {mapsHref ? 'موقع مسجَّل على الخريطة' : 'غير محدد'}
                </span>
              </div>
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn text-white py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-md shrink-0"
                  style={{ background: '#1B7A43' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>فتح في الخرائط</span>
                </a>
              )}
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

            {student.paymentReceipt && (
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
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line bg-cream-50/50 flex items-center gap-2">
          {/* Delete — icon-only, far right to avoid accidental taps */}
          {isAdmin && (
            <button
              onClick={() => onDelete(student.id, student.studentName)}
              disabled={busyId === student.id}
              className="btn py-2 px-2.5 text-xs flex items-center justify-center text-red-600 border-red-200 bg-red-50 hover:bg-red-100 shrink-0"
              title="حذف الطالب نهائياً"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="btn btn-ghost py-2 px-4 text-xs shrink-0">إغلاق</button>
          {student.paymentStatus === 'paid' || student.paymentStatus === 'exempted' ? (
            <button
              onClick={() => onCancelConfirm(student.id)}
              disabled={busyId === student.id}
              className="btn py-2 px-4 text-xs flex-1 flex justify-center items-center gap-1 text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
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
        </div>
      </div>
    </div>
  );
}
