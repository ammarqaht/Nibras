'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { compressImage } from '@/lib/imageUtils';
import { DEPARTMENTS, CATEGORIES, departmentLabel, categoryLabel, statusLabel } from '@/lib/finance';

type Item = { name: string; qty: number; price: number };
type Invoice = {
  id: number;
  invoiceNo: number;
  title: string;
  vendor: string | null;
  invoiceDate: string | null;
  category: string | null;
  department: string;
  supervisorName: string;
  items: Item[];
  subtotal: number | null;
  tax: number | null;
  total: number;
  currency: string;
  imageData: string | null;
  entryMode: string;
  aiExtracted: boolean;
  status: string;
  settlement: string;
  reviewNote: string | null;
  createdAt: string;
};

const money = (n: number) => `${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ﷼`;

function statusPill(s: string) {
  if (s === 'approved') return 'pill-green';
  if (s === 'rejected') return 'pill-red';
  if (s === 'on_hold') return 'pill-gray';
  return 'pill-yellow';
}


export default function InvoicesPage() {
  const { user } = useSupervisor();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [myDepartments, setMyDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);

  const roles = (user?.role ?? '').split(',').map(r => r.trim());
  const canDeleteAny = roles.some(r => ['admin', 'finance'].includes(r));

  async function load() {
    const r = await fetch('/api/supervisor/invoices', { cache: 'no-store' });
    const j = await r.json().catch(() => ({ invoices: [] }));
    // Always show only own invoices regardless of role
    const all: Invoice[] = j.invoices ?? [];
    setInvoices(all.filter(inv => inv.supervisorName === user?.name || !user?.name));
    setMyDepartments(j.myDepartments ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const deptOptions = useMemo(() => {
    if (myDepartments.length > 0) return myDepartments.map((k) => ({ key: k, label: departmentLabel(k) }));
    return DEPARTMENTS.map((d) => ({ key: d.key, label: d.label }));
  }, [myDepartments]);

  async function del(inv: Invoice) {
    if (!confirm(`حذف الفاتورة #${inv.invoiceNo}؟`)) return;
    const r = await fetch(`/api/supervisor/invoices?id=${inv.id}`, { method: 'DELETE' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return pushToast('error', j.error ?? 'فشل الحذف');
    }
    pushToast('info', 'تم حذف الفاتورة');
    setViewing(null);
    setInvoices((p) => p.filter((x) => x.id !== inv.id));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">الفواتير</h1>
          <p className="text-sm text-ink-500">فواتيرك المُضافة. صوّرها ليقرأها الذكاء الاصطناعي أو أدخلها يدوياً.</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn btn-primary">+ إضافة فاتورة</button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
        ) : invoices.length === 0 ? (
          <p className="text-center py-16 text-ink-400 text-sm">لا توجد فواتير بعد.</p>
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden lg:block overflow-x-auto scroll-soft">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>الرقم</th><th>العنوان</th><th>القسم</th>
                    <th>الإجمالي</th><th>الحالة</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="cursor-pointer" onClick={() => setViewing(inv)}>
                      <td dir="ltr" className="text-right font-mono text-ink-500">#{inv.invoiceNo}</td>
                      <td className="font-medium flex items-center gap-1">
                        <span>{inv.title}</span>
                        {inv.aiExtracted && (
                          <span title="قُرئت بالذكاء الاصطناعي">
                            <svg className="w-3.5 h-3.5 text-orange-500 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="text-ink-500 text-sm">{departmentLabel(inv.department)}</td>
                      <td className="font-semibold" dir="ltr">{money(inv.total)}</td>
                      <td>
                        <span className={`pill ${statusPill(inv.status)}`}>{statusLabel(inv.status)}</span>
                        {inv.settlement === 'handed_over' && <span className="pill pill-green mr-1">سُلّم</span>}
                      </td>
                      <td><button className="btn btn-secondary py-1 px-3 text-xs" onClick={(e) => { e.stopPropagation(); setViewing(inv); }}>عرض</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <ul className="lg:hidden divide-y divide-ink-200">
              {invoices.map((inv) => (
                <li key={inv.id} onClick={() => setViewing(inv)} className="p-4 flex items-center gap-3 active:bg-cream-100 cursor-pointer">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink-900 truncate">
                      <span>{inv.title}</span>
                      {inv.aiExtracted && (
                        <svg className="w-3.5 h-3.5 text-orange-500 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z" />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs text-ink-400 mt-0.5">
                      <span dir="ltr" className="font-mono">#{inv.invoiceNo}</span> · {departmentLabel(inv.department)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="font-semibold text-sm" dir="ltr">{money(inv.total)}</span>
                      <span className={`pill ${statusPill(inv.status)}`}>{statusLabel(inv.status)}</span>
                      {inv.settlement === 'handed_over' && <span className="pill pill-green">سُلّم</span>}
                    </div>
                  </div>
                  <span className="text-ink-300 text-xl shrink-0">‹</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {adding && (
        <AddInvoiceModal
          deptOptions={deptOptions}
          onClose={() => setAdding(false)}
          onCreated={(inv) => { setInvoices((p) => [inv, ...p]); setAdding(false); }}
        />
      )}

      {viewing && (
        <ViewInvoiceModal
          invoice={viewing}
          canDelete={canDeleteAny || viewing.status === 'pending'}
          onClose={() => setViewing(null)}
          onDelete={() => del(viewing)}
        />
      )}
    </div>
  );
}

/* ============================= ADD MODAL ============================= */

function AddInvoiceModal({
  deptOptions,
  onClose,
  onCreated
}: {
  deptOptions: { key: string; label: string }[];
  onClose: () => void;
  onCreated: (inv: Invoice) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [aiExtracted, setAiExtracted] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [entryMode, setEntryMode] = useState<'photo' | 'manual'>('manual');

  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [category, setCategory] = useState('');
  const [department, setDepartment] = useState(deptOptions.length === 1 ? deptOptions[0].key : '');
  const [total, setTotal] = useState('');

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEntryMode('photo');
    let dataUrl = '';
    try {
      dataUrl = await compressImage(file);
    } catch {
      pushToast('error', 'تعذّر تجهيز الصورة');
      return;
    }
    setImage(dataUrl);
    setReading(true);
    try {
      const r = await fetch('/api/supervisor/invoices/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.code === 'no_ai') pushToast('info', 'القراءة الآلية غير مفعّلة — أكمل الإدخال يدوياً.');
        else pushToast('error', j.error ?? 'تعذّرت القراءة — أكمل يدوياً.');
        return;
      }
      const d = j.data || {};
      if (d.title) setTitle(d.title);
      if (d.vendor) setVendor(d.vendor);
      if (d.invoiceDate) setInvoiceDate(d.invoiceDate);
      if (d.total != null) setTotal(String(d.total));
      setAiExtracted(true);
      setAiConfidence(d.confidence ?? null);
      pushToast('success', 'تمت قراءة الفاتورة — راجع البيانات وأكّدها.');
    } catch {
      pushToast('error', 'تعذّر الاتصال بخدمة القراءة — أكمل يدوياً.');
    } finally {
      setReading(false);
    }
  }

  async function submit() {
    if (!title.trim()) return pushToast('error', 'أدخل بيان الصرف');
    if (!department) return pushToast('error', 'اختر القسم');
    const finalTotal = parseFloat(total);
    if (isNaN(finalTotal) || finalTotal <= 0) return pushToast('error', 'أدخل قيمة الإجمالي بشكل صحيح');

    setBusy(true);
    const r = await fetch('/api/supervisor/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        vendor: vendor.trim() || null,
        invoiceDate: invoiceDate.trim() || null,
        category: category || null,
        department,
        items: [{ name: title.trim(), qty: 1, price: finalTotal }],
        subtotal: finalTotal,
        tax: null,
        total: finalTotal,
        imageData: image,
        entryMode,
        aiExtracted,
        aiConfidence
      })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل حفظ الفاتورة');
    pushToast('success', 'تم حفظ الفاتورة');
    onCreated(j.invoice);
  }

  return (
    <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="modal-panel w-[92vw] sm:w-full sm:max-w-xl rounded-2xl max-h-[70vh] sm:max-h-[70vh] flex flex-col shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-3.5 sm:p-5 border-b border-ink-200 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink-900">إضافة فاتورة</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-5 flex-1 overflow-y-auto scroll-soft">
          {/* photo / AI */}
          <div className="rounded-xl border border-dashed border-ink-300 p-4 text-center">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="الفاتورة" className="max-h-44 mx-auto rounded-lg border border-ink-200" />
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-ink-400 text-sm gap-2">
                <svg className="w-8 h-8 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>صوّر الفاتورة ليقرأها الذكاء الاصطناعي تلقائياً</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={reading}
              className="btn btn-secondary text-sm mt-3"
            >
              {reading ? 'جارٍ القراءة…' : image ? 'تغيير الصورة' : 'تصوير / رفع صورة'}
            </button>
            {aiExtracted && (
              <p className="hint mt-2 flex items-center justify-center gap-1.5" style={{ color: 'var(--blue)' }}>
                 <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1 1.275-1.275z" />
                 </svg>
                 <span>عُبّئت الحقول تلقائياً{aiConfidence != null ? ` (ثقة ${Math.round(aiConfidence * 100)}%)` : ''} — راجعها قبل الحفظ.</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="القسم / الجهة" required>
              <select className="field" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">اختر القسم</option>
                {deptOptions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="التصنيف">
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">بدون تصنيف</option>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="بيان الصرف (ماذا اشتريت؟)" required>
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مشتريات قرطاسية" />
            </Field>
            <Field label="المتجر / المورّد">
              <input className="field" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
            <Field label="تاريخ الفاتورة">
              <input className="field" dir="ltr" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} placeholder="2026/06/20" />
            </Field>
          </div>

          <Field label="الإجمالي" required>
            <input
              type="number"
              step="any"
              className="field font-semibold"
              dir="ltr"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="p-3.5 sm:p-5 border-t border-ink-200 flex justify-end gap-2 shrink-0 bg-ink-50/50 rounded-b-2xl">
          <button onClick={onClose} className="btn btn-secondary px-6">إلغاء</button>
          <button onClick={submit} disabled={busy || reading} className="btn btn-primary px-6">{busy ? 'جارٍ الحفظ…' : 'حفظ الفاتورة'}</button>
        </div>
      </div>
    </div>
  );
}

/* ============================= VIEW MODAL ============================= */

function ViewInvoiceModal({
  invoice,
  canDelete,
  onClose,
  onDelete
}: {
  invoice: Invoice;
  canDelete: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="modal-panel w-[92vw] sm:w-full sm:max-w-xl rounded-2xl max-h-[70vh] sm:max-h-[70vh] flex flex-col shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-3.5 sm:p-5 border-b border-ink-200 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink-900">{invoice.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span dir="ltr" className="text-xs sm:text-sm font-mono text-ink-500">#{invoice.invoiceNo}</span>
              <span className={`pill ${statusPill(invoice.status)}`}>{statusLabel(invoice.status)}</span>
              {invoice.settlement === 'handed_over' && <span className="pill pill-green">تم تسليم المبلغ</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-5 flex-1 overflow-y-auto scroll-soft">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <Info label="القسم" value={departmentLabel(invoice.department)} />
            <Info label="التصنيف" value={invoice.category ? categoryLabel(invoice.category) : '—'} />
            <Info label="المورّد" value={invoice.vendor || '—'} />
            <Info label="تاريخ الفاتورة" value={invoice.invoiceDate || '—'} />
            <Info label="المشرف" value={invoice.supervisorName} />
            <Info label="طريقة الإدخال" value={invoice.entryMode === 'photo' ? 'تصوير' : 'يدوي'} />
          </div>

          {invoice.reviewNote && (
            <div className="text-sm rounded-xl p-3" style={{ background: '#FDEAE6', color: '#C42910' }}>
              ملاحظة المالية: {invoice.reviewNote}
            </div>
          )}

          <div className="flex items-center justify-between text-base sm:text-lg font-bold border-t border-ink-200 pt-3">
            <span>الإجمالي</span>
            <span dir="ltr" style={{ color: 'var(--accent-deep)' }}>{money(invoice.total)}</span>
          </div>

          {invoice.imageData && (
            <div>
              <div className="label">صورة الفاتورة</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={invoice.imageData} alt="الفاتورة" className="max-h-72 rounded-lg border border-ink-200 mx-auto" />
            </div>
          )}
        </div>

        <div className="p-3.5 sm:p-5 border-t border-ink-200 flex justify-end gap-2 shrink-0 bg-ink-50/50 rounded-b-2xl">
          <button onClick={onClose} className="btn btn-secondary px-6">إغلاق</button>
          {canDelete && (
            <button onClick={onDelete} className="btn btn-danger px-6">حذف الفاتورة</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label} {required && <span className="req">*</span>}</label>
      {children}
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label !mb-0.5">{label}</div>
      <div className="text-ink-900">{value}</div>
    </div>
  );
}
