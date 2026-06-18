'use client';

import { useEffect, useMemo, useState } from 'react';
import { stages } from '@/content';
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
  locationLat: number | null;
  locationLng: number | null;
  mapLink: string | null;
  hasCondition: boolean;
  conditionNote: string | null;
  createdAt: string;
  paymentStatus: string;
  paymentType: string;
  paymentReceipt: string | null;
  registrationStatus: string;
  groupId: number | null;
};

type Group = { id: number; name: string; stage: string };

function paymentPill(s: Student) {
  if (s.paymentStatus === 'paid') return { cls: 'pill-green', label: 'مدفوع' };
  if (s.paymentType === 'now' && s.paymentReceipt) return { cls: 'pill-yellow', label: 'بانتظار المراجعة 📑' };
  return { cls: 'pill-red', label: 'لم يدفع' };
}
function regPill(status: string) {
  if (status === 'approved') return { cls: 'pill-green', label: 'مقبول' };
  if (status === 'rejected') return { cls: 'pill-red', label: 'مرفوض' };
  return { cls: 'pill-yellow', label: 'قيد المراجعة' };
}

export default function StudentsPage() {
  const { user } = useSupervisor();
  const isAdmin = user?.role === 'admin';

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [fStage, setFStage] = useState('');
  const [fPay, setFPay] = useState('');
  const [fReg, setFReg] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('registrationStatus') || '' : ''
  );
  const [fGroup, setFGroup] = useState('');

  async function load() {
    const [sr, gr] = await Promise.all([
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' })
    ]);
    const sj = await sr.json().catch(() => ({ students: [] }));
    const gj = await gr.json().catch(() => ({ groups: [] }));
    setStudents(sj.students ?? []);
    setGroups(gj.groups ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
      if (fStage && s.stage !== fStage) return false;
      if (fPay && s.paymentStatus !== fPay) return false;
      if (fReg && s.registrationStatus !== fReg) return false;
      if (fGroup && String(s.groupId) !== fGroup) return false;
      return true;
    });
  }, [students, search, fStage, fPay, fReg, fGroup]);

  // optimistic local update after a PUT
  function applyUpdate(updated: Student) {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  function exportCsv() {
    const headers = [
      'رقم العضوية', 'اسم الطالب', 'رقم الهوية', 'جوال ولي الأمر', 'جوال الطالب',
      'المرحلة', 'الصف', 'الحي', 'حالة الدفع', 'نوع الدفع', 'حالة التسجيل', 'حالة صحية'
    ];
    const esc = (v: unknown) => {
      const str = String(v ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const rows = filtered.map((s) => [
      s.membershipNo, s.studentName, s.nationalId, s.guardianPhone, s.studentPhone ?? '',
      s.stage, s.grade, s.neighborhood,
      s.paymentStatus === 'paid' ? 'مدفوع' : 'غير مدفوع',
      s.paymentType === 'now' ? 'فوري' : 'آجل',
      s.registrationStatus === 'approved' ? 'مقبول' : s.registrationStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة',
      s.hasCondition ? 'نعم' : 'لا'
    ]);
    const csv = '﻿' + [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nibras-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">سجل الطلاب</h1>
          <p className="text-sm text-ink-500">{filtered.length} طالب من أصل {students.length}</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary text-sm">⬇︎ تصدير CSV</button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            className="field lg:col-span-1"
            placeholder="بحث بالاسم / الهوية / الجوال / العضوية…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="field" value={fStage} onChange={(e) => setFStage(e.target.value)}>
            <option value="">كل المراحل</option>
            {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select className="field" value={fPay} onChange={(e) => setFPay(e.target.value)}>
            <option value="">كل حالات الدفع</option>
            <option value="paid">مدفوع</option>
            <option value="unpaid">غير مدفوع</option>
          </select>
          <select className="field" value={fReg} onChange={(e) => setFReg(e.target.value)}>
            <option value="">كل حالات التسجيل</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">مقبول</option>
            <option value="rejected">مرفوض</option>
          </select>
          <select className="field" value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
            <option value="">كل المجموعات</option>
            {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-ink-400 text-sm">لا يوجد طلاب مطابقون.</p>
        ) : (
          <>
            {/* desktop: table */}
            <div className="hidden lg:block overflow-x-auto scroll-soft">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>العضوية</th>
                    <th>المرحلة / الصف</th>
                    <th>الدفع</th>
                    <th>التسجيل</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const pp = paymentPill(s);
                    const rp = regPill(s.registrationStatus);
                    return (
                      <tr key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                        <td className="font-medium">
                          {s.studentName}
                          {s.hasCondition && <span title="حالة صحية" className="mr-1">🚨</span>}
                        </td>
                        <td dir="ltr" className="text-right font-mono text-ink-500">#{s.membershipNo}</td>
                        <td className="text-ink-500 text-sm">{s.stage} — {s.grade}</td>
                        <td><span className={`pill ${pp.cls}`}>{pp.label}</span></td>
                        <td><span className={`pill ${rp.cls}`}>{rp.label}</span></td>
                        <td>
                          <button
                            className="btn btn-secondary py-1 px-3 text-xs"
                            onClick={(e) => { e.stopPropagation(); setSelected(s); }}
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

            {/* mobile: tappable cards (no horizontal scroll) */}
            <ul className="lg:hidden divide-y divide-ink-200">
              {filtered.map((s) => {
                const pp = paymentPill(s);
                const rp = regPill(s.registrationStatus);
                return (
                  <li
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="py-2.5 px-4 flex items-center gap-3 active:bg-cream-100 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink-900 truncate">
                        {s.studentName}
                        {s.hasCondition && <span title="حالة صحية" className="mr-1">🚨</span>}
                      </div>
                      <div className="text-xs text-ink-400 mt-0.5">
                        <span dir="ltr" className="font-mono">#{s.membershipNo}</span> · {s.stage} — {s.grade}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className={`pill ${pp.cls}`}>{pp.label}</span>
                        <span className={`pill ${rp.cls}`}>{rp.label}</span>
                      </div>
                    </div>
                    <span className="text-ink-300 text-xl shrink-0">‹</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {selected && (
        <StudentModal
          student={selected}
          groups={groups}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onUpdated={applyUpdate}
          onDeleted={(id) => {
            setStudents((prev) => prev.filter((s) => s.id !== id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

/* ============================= MODAL ============================= */

function StudentModal({
  student,
  groups,
  isAdmin,
  onClose,
  onUpdated,
  onDeleted
}: {
  student: Student;
  groups: Group[];
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: (s: Student) => void;
  onDeleted: (id: number) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Student>(student);

  useEffect(() => setForm(student), [student]);

  const stageDef = stages.find((s) => s.key === form.stage);

  async function put(patch: Partial<Student>) {
    setBusy(true);
    const r = await fetch('/api/supervisor/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: student.id, ...patch })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل التحديث');
      return null;
    }
    onUpdated(j.student);
    return j.student as Student;
  }

  async function confirmPayment() {
    const res = await put({ paymentStatus: 'paid' });
    if (res) pushToast('success', 'تم تأكيد استلام الدفع');
  }

  async function setReg(status: string) {
    const res = await put({ registrationStatus: status });
    if (res) pushToast('success', status === 'approved' ? 'تم قبول الطالب' : status === 'rejected' ? 'تم رفض الطلب' : 'تم التحديث');
  }

  async function saveEdit() {
    const res = await put({
      studentName: form.studentName,
      nationalId: form.nationalId,
      guardianPhone: form.guardianPhone,
      studentPhone: form.studentPhone,
      stage: form.stage,
      grade: form.grade,
      neighborhood: form.neighborhood,
      hasCondition: form.hasCondition,
      conditionNote: form.hasCondition ? form.conditionNote : null,
      groupId: form.groupId
    });
    if (res) {
      pushToast('success', 'تم حفظ التعديلات');
      setEdit(false);
    }
  }

  async function del() {
    if (!confirm(`حذف الطالب «${student.studentName}» نهائياً؟`)) return;
    setBusy(true);
    const r = await fetch(`/api/supervisor/students?id=${student.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return pushToast('error', j.error ?? 'فشل الحذف');
    }
    pushToast('info', 'تم حذف الطالب');
    onDeleted(student.id);
  }

  async function openReceipt() {
    if (!student.paymentReceipt) return;
    try {
      const res = await fetch(student.paymentReceipt);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      window.open(student.paymentReceipt, '_blank');
    }
  }

  function copyWhatsapp() {
    const locLine = student.mapLink
      ? student.mapLink
      : student.locationLat && student.locationLng
      ? `https://maps.google.com/?q=${student.locationLat},${student.locationLng}`
      : 'غير محدد';
    const msg =
      `*بيانات تسجيل الطالب في نادي نبراس:*\n` +
      `اسم الطالب: ${student.studentName}\n` +
      `رقم العضوية: #${student.membershipNo}\n` +
      `رقم الهوية: ${student.nationalId}\n` +
      `المرحلة: ${student.stage} - ${student.grade}\n` +
      `جوال ولي الأمر: ${student.guardianPhone}\n` +
      `الحي: ${student.neighborhood}\n` +
      `الموقع: ${locLine}`;
    navigator.clipboard.writeText(msg).then(
      () => pushToast('success', 'تم نسخ بيانات الطالب'),
      () => pushToast('error', 'تعذّر النسخ')
    );
  }

  const pp = paymentPill(student);
  const rp = regPill(student.registrationStatus);
  const mapsHref = student.mapLink
    ? student.mapLink
    : student.locationLat && student.locationLng
    ? `https://www.google.com/maps?q=${student.locationLat},${student.locationLng}`
    : null;

  return (
    <div className="modal-backdrop flex items-start md:items-center justify-center p-2 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="modal-panel w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-ink-200">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink-900">{student.studentName}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span dir="ltr" className="text-xs sm:text-sm font-mono text-ink-500">#{student.membershipNo}</span>
              <span className={`pill ${pp.cls}`}>{pp.label}</span>
              <span className={`pill ${rp.cls}`}>{rp.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 max-h-[70vh] overflow-y-auto scroll-soft">
          {edit ? (
            /* ---------- EDIT MODE ---------- */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Labeled label="اسم الطالب">
                <input className="field" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
              </Labeled>
              <Labeled label="رقم الهوية">
                <input className="field" dir="ltr" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
              </Labeled>
              <Labeled label="جوال ولي الأمر">
                <input className="field" dir="ltr" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
              </Labeled>
              <Labeled label="جوال الطالب">
                <input className="field" dir="ltr" value={form.studentPhone ?? ''} onChange={(e) => setForm({ ...form, studentPhone: e.target.value })} />
              </Labeled>
              <Labeled label="المرحلة">
                <select className="field" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value, grade: '' })}>
                  {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Labeled>
              <Labeled label="الصف">
                <select className="field" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                  <option value="">اختر الصف</option>
                  {stageDef?.grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Labeled>
              <Labeled label="الحي السكني">
                <input className="field" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
              </Labeled>
              <Labeled label="المجموعة / الأسرة">
                <select
                  className="field"
                  value={form.groupId ?? ''}
                  onChange={(e) => setForm({ ...form, groupId: e.target.value ? parseInt(e.target.value, 10) : null })}
                >
                  <option value="">بدون مجموعة</option>
                  {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                </select>
              </Labeled>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasCondition}
                    onChange={(e) => setForm({ ...form, hasCondition: e.target.checked })}
                  />
                  يعاني من حساسية / مرض مزمن
                </label>
                {form.hasCondition && (
                  <textarea
                    className="field mt-2"
                    rows={2}
                    placeholder="تفاصيل الحالة"
                    value={form.conditionNote ?? ''}
                    onChange={(e) => setForm({ ...form, conditionNote: e.target.value })}
                  />
                )}
              </div>
            </div>
          ) : (
            /* ---------- VIEW MODE ---------- */
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6">
                <Info label="رقم الهوية" value={student.nationalId} ltr />
                <Info label="المرحلة / الصف" value={`${student.stage} — ${student.grade}`} />
                <Info label="جوال ولي الأمر" value={student.guardianPhone} ltr />
                <Info label="جوال الطالب" value={student.studentPhone || '—'} ltr />
                <Info label="الحي السكني" value={student.neighborhood} />
                <Info label="المجموعة" value={groups.find((g) => g.id === student.groupId)?.name || 'غير محدد'} />
              </div>

              {/* health */}
              {student.hasCondition && (
                <div className="rounded-lg p-3 text-sm" style={{ background: '#FDEAE6', color: '#C42910' }}>
                  🚨 <span className="font-semibold">حالة صحية:</span> {student.conditionNote || 'غير موضّحة'}
                </div>
              )}

              {/* location */}
              <div>
                <div className="label">الموقع</div>
                {mapsHref ? (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">
                    📍 فتح الموقع في خرائط Google ↗
                  </a>
                ) : (
                  <span className="text-sm text-ink-400">لم يحدّد الطالب موقعاً.</span>
                )}
              </div>

              {/* payment */}
              <div className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-ink-900">تفاصيل الدفع</span>
                  <span className="pill pill-gray">{student.paymentType === 'now' ? 'دفع فوري' : 'دفع آجل'}</span>
                </div>

                {student.paymentType === 'now' && (
                  <div className="mb-3">
                    <div className="label">إيصال التحويل</div>
                    {student.paymentReceipt ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={student.paymentReceipt}
                          alt="إيصال"
                          className="w-20 h-20 object-cover rounded-lg border border-ink-200 cursor-pointer"
                          onClick={openReceipt}
                        />
                        <button onClick={openReceipt} className="btn btn-ghost text-sm">👁️ فتح الإيصال في صفحة جديدة</button>
                      </div>
                    ) : (
                      <span className="text-sm text-ink-400">لم يُرفق إيصال.</span>
                    )}
                  </div>
                )}

                {student.paymentStatus !== 'paid' ? (
                  <div className="rounded-lg p-3" style={{ background: '#FCF3DC' }}>
                    <p className="text-sm mb-2" style={{ color: '#9A6B00' }}>لم يتم تأكيد السداد بعد.</p>
                    <button
                      onClick={confirmPayment}
                      disabled={busy}
                      className="btn text-white border-transparent"
                      style={{ background: '#1B7A43' }}
                    >
                      ✅ تأكيد استلام الدفع
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold" style={{ color: '#1B7A43' }}>✓ تم تأكيد استلام الدفع</p>
                )}
              </div>

              {/* registration status (auto-determined by payment) */}
              <div>
                <div className="label">حالة التسجيل</div>
                <div className="flex items-center gap-2">
                  {student.paymentStatus === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: '#DEF7E5', color: '#1B7A43' }}>
                      ✓ مقبول
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: '#FEF3CD', color: '#856404' }}>
                      ⏳ قيد المراجعة
                    </span>
                  )}
                  <span className="text-xs text-ink-400">(يتحدد تلقائياً حسب حالة الدفع)</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* footer actions */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-ink-200 flex-wrap">
          <div className="flex gap-2">
            {edit ? (
              <>
                <button onClick={saveEdit} disabled={busy} className="btn btn-primary text-sm">حفظ التعديلات</button>
                <button onClick={() => { setEdit(false); setForm(student); }} className="btn btn-ghost text-sm">إلغاء</button>
              </>
            ) : (
              <>
                <button onClick={() => setEdit(true)} className="btn btn-secondary text-sm">✎ تعديل</button>
              </>
            )}
          </div>
          {isAdmin && !edit && (
            <button onClick={del} disabled={busy} className="btn btn-danger text-sm">حذف الطالب</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="label !mb-0.5">{label}</div>
      <div className="text-ink-900 text-sm" dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
