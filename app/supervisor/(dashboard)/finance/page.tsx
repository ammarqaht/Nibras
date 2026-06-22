'use client';

import { useEffect, useMemo, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { DEPARTMENTS, departmentLabel, categoryLabel, statusLabel } from '@/lib/finance';

type Item = { name: string; qty: number; price: number };
type Invoice = {
  id: number; invoiceNo: number; title: string; vendor: string | null; invoiceDate: string | null;
  category: string | null; department: string; supervisorName: string; items: Item[];
  total: number; imageData: string | null; status: string; settlement: string; reviewNote: string | null;
};

const money = (n: number) => `${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ﷼`;
function statusPill(s: string) {
  if (s === 'approved') return 'pill-green';
  if (s === 'rejected') return 'pill-red';
  if (s === 'on_hold') return 'pill-gray';
  return 'pill-yellow';
}

type Tab = 'pending' | 'approved' | 'rejected' | 'on_hold' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'قيد المراجعة' },
  { key: 'approved', label: 'معتمدة' },
  { key: 'on_hold', label: 'معلّقة' },
  { key: 'rejected', label: 'مرفوضة' },
  { key: 'all', label: 'الكل' }
];

export default function FinancePage() {
  const { user } = useSupervisor();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paidCount, setPaidCount] = useState(0);
  const [fee, setFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [fDept, setFDept] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);

  const allowed = !user || user.role === 'admin' || user.role === 'finance';

  async function load() {
    const [ir, sr, setr] = await Promise.all([
      fetch('/api/supervisor/invoices', { cache: 'no-store' }),
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/settings', { cache: 'no-store' })
    ]);
    const ij = await ir.json().catch(() => ({ invoices: [] }));
    const sj = await sr.json().catch(() => ({ students: [] }));
    const stj = await setr.json().catch(() => ({ settings: {} }));
    setInvoices(ij.invoices ?? []);
    setPaidCount((sj.students ?? []).filter((s: any) => s.paymentStatus === 'paid').length);
    const feeStr = stj.settings?.clubFeesValue || '300';
    setFee(parseInt(String(feeStr).replace(/[^\d]/g, ''), 10) || 0);
    setLoading(false);
  }
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

  const revenue = paidCount * fee;
  const approvedExpense = invoices.filter((i) => i.status === 'approved' || i.settlement === 'handed_over')
    .reduce((s, i) => s + i.total, 0);
  const pendingAmount = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.total, 0);
  const net = revenue - approvedExpense;

  const byDept = useMemo(() => {
    return DEPARTMENTS.map((d) => {
      const list = invoices.filter((i) => i.department === d.key);
      const approved = list.filter((i) => i.status === 'approved' || i.settlement === 'handed_over').reduce((s, i) => s + i.total, 0);
      const pending = list.filter((i) => i.status === 'pending').length;
      return { ...d, approved, count: list.length, pending };
    }).filter((d) => d.count > 0);
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (tab !== 'all' && i.status !== tab) return false;
      if (fDept && i.department !== fDept) return false;
      return true;
    });
  }, [invoices, tab, fDept]);

  async function act(inv: Invoice, patch: Record<string, unknown>, okMsg: string) {
    const r = await fetch('/api/supervisor/invoices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inv.id, ...patch })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل التحديث');
    pushToast('success', okMsg);
    setInvoices((p) => p.map((x) => (x.id === inv.id ? j.invoice : x)));
    setSelected((prev) => (prev && prev.id === inv.id ? j.invoice : prev));
  }
  const approve = (inv: Invoice) => act(inv, { status: 'approved' }, 'تم اعتماد الفاتورة');
  const reject = (inv: Invoice) => {
    const note = prompt('سبب الرفض (اختياري):') ?? '';
    act(inv, { status: 'rejected', reviewNote: note }, 'تم رفض الفاتورة');
  };
  const hold = (inv: Invoice) => {
    const note = prompt('سبب التعليق (اختياري):') ?? '';
    act(inv, { status: 'on_hold', reviewNote: note }, 'تم تعليق الفاتورة');
  };
  const settle = (inv: Invoice) => act(inv, { settlement: 'handed_over' }, 'تم تأكيد تسليم المبلغ');
  const markPending = (inv: Invoice) => act(inv, { status: 'pending', reviewNote: null }, 'تم إرجاع الفاتورة قيد المراجعة');

  if (user && !allowed) {
    return <div className="card p-10 text-center text-ink-500">هذه الصفحة متاحة للمالية والمدير العام فقط.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">المالية</h1>
        <p className="text-sm text-ink-500">اعتماد فواتير المشرفين وصرفها، ومتابعة الإيرادات والمصروفات.</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</div>
      ) : (
        <>
          {/* summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat label="الإيرادات (الرسوم)" value={money(revenue)} tone="green" hint={`${paidCount} طالب مدفوع`} />
            <Stat label="المصروفات المعتمدة" value={money(approvedExpense)} tone="red" />
            <Stat label="الرصيد الصافي" value={money(net)} tone={net >= 0 ? 'blue' : 'red'} />
            <Stat label="بانتظار الاعتماد" value={money(pendingAmount)} tone="yellow" hint={`${invoices.filter((i) => i.status === 'pending').length} فاتورة`} />
          </div>

          {/* per-department */}
          {byDept.length > 0 && (
            <div className="card p-5 mb-6">
              <h2 className="text-lg font-bold text-ink-900 mb-3">المصروف حسب القسم</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byDept.map((d) => (
                  <div key={d.key} className="rounded-xl border border-ink-200 p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-ink-900">{d.label}</div>
                      <div className="text-xs text-ink-400 mt-0.5">{d.count} فاتورة{d.pending ? ` · ${d.pending} قيد المراجعة` : ''}</div>
                    </div>
                    <div className="font-bold" dir="ltr" style={{ color: 'var(--accent-deep)' }}>{money(d.approved)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map((t) => {
              const c = t.key === 'pending' ? invoices.filter((i) => i.status === 'pending').length : 0;
              return (
                <button key={t.key} className={`choice text-sm ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
                  {t.label}{t.key === 'pending' && c > 0 && <span className="font-bold"> ({c})</span>}
                </button>
              );
            })}
            <select className="field max-w-[12rem] text-sm" value={fDept} onChange={(e) => setFDept(e.target.value)}>
              <option value="">كل الأقسام</option>
              {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>

          {/* list */}
          <div className="card p-0 overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-center py-16 text-ink-400 text-sm">لا توجد فواتير في هذا التصنيف.</p>
            ) : (
              <ul className="divide-y divide-ink-200">
                {filtered.map((inv) => (
                  <li key={inv.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 cursor-pointer flex-1" onClick={() => setSelected(inv)}>
                        <div className="font-semibold text-ink-900 truncate">{inv.title}</div>
                        <div className="text-xs text-ink-400 mt-0.5">
                          <span dir="ltr" className="font-mono">#{inv.invoiceNo}</span> · {departmentLabel(inv.department)} · {inv.supervisorName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="font-semibold text-sm" dir="ltr">{money(inv.total)}</span>
                          <span className={`pill ${statusPill(inv.status)}`}>{statusLabel(inv.status)}</span>
                          {inv.settlement === 'handed_over' && <span className="pill pill-green">سُلّم</span>}
                        </div>
                      </div>
                    </div>
                    {/* actions */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {inv.status !== 'approved' && (
                        <button onClick={() => approve(inv)} className="btn text-white border-transparent py-1 px-3 text-xs" style={{ background: '#1B7A43' }}>✅ اعتماد</button>
                      )}
                      {inv.status !== 'on_hold' && (
                        <button onClick={() => hold(inv)} className="btn btn-secondary py-1 px-3 text-xs">⏸️ تعليق</button>
                      )}
                      {inv.status !== 'rejected' && (
                        <button onClick={() => reject(inv)} className="btn btn-danger py-1 px-3 text-xs">❌ رفض</button>
                      )}
                      {inv.status !== 'pending' && (
                        <button onClick={() => markPending(inv)} className="btn btn-secondary py-1 px-3 text-xs">🔄 قيد المراجعة</button>
                      )}
                      {inv.status === 'approved' && inv.settlement !== 'handed_over' && (
                        <button onClick={() => settle(inv)} className="btn text-white border-transparent py-1 px-3 text-xs" style={{ background: 'var(--blue)' }}>💵 تأكيد تسليم المبلغ</button>
                      )}
                      <button onClick={() => setSelected(inv)} className="btn btn-ghost py-1 px-3 text-xs mr-auto">التفاصيل</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {selected && (
        <ReviewModal
          invoice={selected}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={reject}
          onHold={hold}
          onMarkPending={markPending}
          onSettle={settle}
        />
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: '#1B7A43', red: 'var(--red)', blue: 'var(--blue)', yellow: '#C68A00'
};
function Stat({ label, value, tone, hint }: { label: string; value: string; tone: keyof typeof TONES; hint?: string }) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1 h-full" style={{ background: TONES[tone] }} />
      <div className="text-sm text-ink-500 mb-2">{label}</div>
      <div className="text-xl font-bold tabular-nums" dir="ltr" style={{ color: TONES[tone] }}>{value}</div>
      {hint && <div className="text-xs text-ink-400 mt-2">{hint}</div>}
    </div>
  );
}

function ReviewModal({
  invoice,
  onClose,
  onApprove,
  onReject,
  onHold,
  onMarkPending,
  onSettle
}: {
  invoice: Invoice;
  onClose: () => void;
  onApprove: (inv: Invoice) => void;
  onReject: (inv: Invoice) => void;
  onHold: (inv: Invoice) => void;
  onMarkPending: (inv: Invoice) => void;
  onSettle: (inv: Invoice) => void;
}) {
  return (
    <div className="modal-backdrop flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto" onClick={onClose}>
      <div className="modal-panel w-full max-w-xl my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-ink-200">
          <div>
            <h2 className="text-xl font-bold text-ink-900">{invoice.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span dir="ltr" className="text-sm font-mono text-ink-500">#{invoice.invoiceNo}</span>
              <span className={`pill ${statusPill(invoice.status)}`}>{statusLabel(invoice.status)}</span>
              {invoice.settlement === 'handed_over' && <span className="pill pill-green">سُلّم</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none px-2">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto scroll-soft">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Info label="القسم" value={departmentLabel(invoice.department)} />
            <Info label="التصنيف" value={invoice.category ? categoryLabel(invoice.category) : '—'} />
            <Info label="المشرف" value={invoice.supervisorName} />
            <Info label="المورّد" value={invoice.vendor || '—'} />
          </div>
          {invoice.reviewNote && (
            <div className="text-sm rounded-md p-2.5" style={{ background: '#FDEAE6', color: '#C42910' }}>ملاحظة: {invoice.reviewNote}</div>
          )}
          {invoice.items.length > 0 && (
            <div className="rounded-lg border border-ink-200 overflow-hidden">
              <table className="tbl">
                <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th></tr></thead>
                <tbody>{invoice.items.map((it, i) => <tr key={i}><td>{it.name}</td><td dir="ltr">{it.qty}</td><td dir="ltr">{money(it.price)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between text-lg font-bold border-t border-ink-200 pt-3">
            <span>الإجمالي</span>
            <span dir="ltr" style={{ color: 'var(--accent-deep)' }}>{money(invoice.total)}</span>
          </div>
          {invoice.imageData && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={invoice.imageData} alt="الفاتورة" className="max-h-80 rounded-lg border border-ink-200" />
          )}
        </div>
        <div className="flex flex-wrap gap-2 p-4 border-t border-ink-200 bg-cream-50">
          {invoice.status !== 'approved' && (
            <button onClick={() => onApprove(invoice)} className="btn text-white border-transparent py-1 px-3 text-xs" style={{ background: '#1B7A43' }}>✅ اعتماد</button>
          )}
          {invoice.status !== 'on_hold' && (
            <button onClick={() => onHold(invoice)} className="btn btn-secondary py-1 px-3 text-xs">⏸️ تعليق</button>
          )}
          {invoice.status !== 'rejected' && (
            <button onClick={() => onReject(invoice)} className="btn btn-danger py-1 px-3 text-xs">❌ رفض</button>
          )}
          {invoice.status !== 'pending' && (
            <button onClick={() => onMarkPending(invoice)} className="btn btn-secondary py-1 px-3 text-xs">🔄 قيد المراجعة</button>
          )}
          {invoice.status === 'approved' && invoice.settlement !== 'handed_over' && (
            <button onClick={() => onSettle(invoice)} className="btn text-white border-transparent py-1 px-3 text-xs" style={{ background: 'var(--blue)' }}>💵 تأكيد تسليم المبلغ</button>
          )}
        </div>
      </div>
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
