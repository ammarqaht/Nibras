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

type GeneralExpense = {
  id: number; title: string; amount: number; date: string; notes: string | null; supervisorName: string;
};

type OtherRevenue = {
  id: number; title: string; amount: number; date: string; notes: string | null; supervisorName: string;
};

const money = (n: number) => `${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ﷼`;
function statusPill(s: string) {
  if (s === 'approved') return 'pill-green';
  if (s === 'rejected') return 'pill-red';
  if (s === 'on_hold') return 'pill-gray';
  return 'pill-yellow';
}

type Tab = 'pending' | 'approved' | 'rejected' | 'on_hold' | 'handed_over' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'قيد المراجعة' },
  { key: 'approved', label: 'معتمدة' },
  { key: 'on_hold', label: 'معلّقة' },
  { key: 'rejected', label: 'مرفوضة' },
  { key: 'handed_over', label: 'المستلمة 💵' },
  { key: 'all', label: 'الكل' }
];

export default function FinancePage() {
  const { user } = useSupervisor();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paidCount, setPaidCount] = useState(0);
  const [fee, setFee] = useState(0);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [otherRevenues, setOtherRevenues] = useState<OtherRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [fDept, setFDept] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);

  // Modal open states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddRevenue, setShowAddRevenue] = useState(false);

  const allowed = !user || user.role.split(',').map((r) => r.trim()).some((r) => r === 'admin' || r === 'finance' || r === 'finance_supervisor');

  async function load() {
    const [ir, sr, setr, ger, orr] = await Promise.all([
      fetch('/api/supervisor/invoices', { cache: 'no-store' }),
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/settings', { cache: 'no-store' }),
      fetch('/api/supervisor/finance/general-expenses', { cache: 'no-store' }),
      fetch('/api/supervisor/finance/other-revenues', { cache: 'no-store' })
    ]);
    const ij = await ir.json().catch(() => ({ invoices: [] }));
    const sj = await sr.json().catch(() => ({ students: [] }));
    const stj = await setr.json().catch(() => ({ settings: {} }));
    const gej = await ger.json().catch(() => ({ expenses: [] }));
    const orj = await orr.json().catch(() => ({ revenues: [] }));

    setInvoices(ij.invoices ?? []);
    setPaidCount((sj.students ?? []).filter((s: any) => s.paymentStatus === 'paid').length);
    const feeStr = stj.settings?.clubFeesValue || '300';
    setFee(parseInt(String(feeStr).replace(/[^\d]/g, ''), 10) || 0);
    setGeneralExpenses(gej.expenses ?? []);
    setOtherRevenues(orj.revenues ?? []);
    setLoading(false);
  }
  
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

  // Calculations
  const studentRevenue = paidCount * fee;
  const totalOtherRevenue = otherRevenues.reduce((sum, r) => sum + r.amount, 0);
  const totalRevenue = studentRevenue + totalOtherRevenue;

  const approvedExpense = invoices.filter((i) => i.status === 'approved' || i.settlement === 'handed_over')
    .reduce((s, i) => s + i.total, 0);
  const totalGeneralExpense = generalExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = approvedExpense + totalGeneralExpense;

  const pendingAmount = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.total, 0);
  const net = totalRevenue - totalExpense;

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
      if (tab === 'handed_over') {
        if (i.settlement !== 'handed_over') return false;
      } else {
        if (tab !== 'all' && i.status !== tab) return false;
        if (i.settlement === 'handed_over') return false; // Hide settled from standard status tabs
      }
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
  const cancelSettle = (inv: Invoice) => act(inv, { settlement: 'unsettled' }, 'تم إلغاء تسليم المبلغ');
  const markPending = (inv: Invoice) => act(inv, { status: 'pending', reviewNote: null }, 'تم إرجاع الفاتورة قيد المراجعة');

  // Add General Expense
  async function handleAddExpense(title: string, amount: number, date: string, notes: string) {
    const r = await fetch('/api/supervisor/finance/general-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, amount, date, notes })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل إضافة المصروف');
      return false;
    }
    pushToast('success', 'تم إضافة المصروف بنجاح');
    setGeneralExpenses((prev) => [j.expense, ...prev]);
    setShowAddExpense(false);
    return true;
  }

  // Delete General Expense
  async function handleDeleteExpense(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف العام؟')) return;
    const r = await fetch(`/api/supervisor/finance/general-expenses?id=${id}`, {
      method: 'DELETE'
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل حذف المصروف');
      return;
    }
    pushToast('success', 'تم حذف المصروف العام بنجاح');
    setGeneralExpenses((prev) => prev.filter((x) => x.id !== id));
  }

  // Add Other Revenue
  async function handleAddRevenue(title: string, amount: number, date: string, notes: string) {
    const r = await fetch('/api/supervisor/finance/other-revenues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, amount, date, notes })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل إضافة الإيراد');
      return false;
    }
    pushToast('success', 'تم إضافة الإيراد بنجاح');
    setOtherRevenues((prev) => [j.revenue, ...prev]);
    setShowAddRevenue(false);
    return true;
  }

  // Delete Other Revenue
  async function handleDeleteRevenue(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا الإيراد؟')) return;
    const r = await fetch(`/api/supervisor/finance/other-revenues?id=${id}`, {
      method: 'DELETE'
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      pushToast('error', j.error ?? 'فشل حذف الإيراد');
      return;
    }
    pushToast('success', 'تم حذف الإيراد بنجاح');
    setOtherRevenues((prev) => prev.filter((x) => x.id !== id));
  }

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
            <Stat
              label="إجمالي الإيرادات"
              value={money(totalRevenue)}
              tone="green"
              hint={`${money(studentRevenue)} رسوم · ${money(totalOtherRevenue)} إضافية`}
            />
            <Stat
              label="إجمالي المصروفات"
              value={money(totalExpense)}
              tone="red"
              hint={`${money(approvedExpense)} فواتير · ${money(totalGeneralExpense)} عامة`}
            />
            <Stat label="الرصيد الصافي" value={money(net)} tone={net >= 0 ? 'blue' : 'red'} />
            <Stat label="بانتظار الاعتماد (الفواتير)" value={money(pendingAmount)} tone="yellow" hint={`${invoices.filter((i) => i.status === 'pending').length} فاتورة`} />
          </div>

          {/* per-department */}
          {byDept.length > 0 && (
            <div className="card p-5 mb-6">
              <h2 className="text-lg font-bold text-ink-900 mb-3">المصروف المعتمد حسب القسم</h2>
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

          {/* Invoice list block */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-ink-900 mb-3">فواتير المشرفين والأنشطة</h2>
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
              <select className="field max-w-[12rem] text-sm mr-auto" value={fDept} onChange={(e) => setFDept(e.target.value)}>
                <option value="">كل الأقسام</option>
                {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>

            <div className="card p-0 overflow-hidden">
              {filtered.length === 0 ? (
                <p className="text-center py-16 text-ink-400 text-sm">لا توجد فواتير في هذا التصنيف.</p>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto scroll-soft">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>الرقم</th>
                          <th>العنوان</th>
                          <th>القسم</th>
                          <th>المشرف</th>
                          <th>الإجمالي</th>
                          <th>الحالة</th>
                          <th className="text-left pl-6">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((inv) => (
                          <tr key={inv.id} className="hover:bg-cream-100/30 transition-colors">
                            <td dir="ltr" className="font-mono text-ink-500 text-sm">#{inv.invoiceNo}</td>
                            <td className="font-semibold cursor-pointer" onClick={() => setSelected(inv)}>{inv.title}</td>
                            <td className="text-ink-500 text-sm">{departmentLabel(inv.department)}</td>
                            <td className="text-ink-500 text-sm">{inv.supervisorName}</td>
                            <td className="font-bold" dir="ltr">{money(inv.total)}</td>
                            <td>
                              <span className={`pill ${statusPill(inv.status)}`}>{statusLabel(inv.status)}</span>
                              {inv.settlement === 'handed_over' && <span className="pill pill-green mr-1">سُلّم</span>}
                            </td>
                            <td>
                              <div className="flex items-center justify-end gap-1.5 pl-4">
                                {inv.settlement === 'handed_over' ? (
                                  <button onClick={() => cancelSettle(inv)} className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
                                    <span>↩️ إلغاء التسليم</span>
                                  </button>
                                ) : (
                                  <>
                                    {inv.status === 'pending' && (
                                      <>
                                        <button onClick={() => approve(inv)} className="btn text-white border-transparent py-1 px-2.5 text-xs flex items-center gap-1" style={{ background: '#1B7A43' }}>
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                          <span>اعتماد</span>
                                        </button>
                                        <button onClick={() => hold(inv)} className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="6" y="4" width="4" height="16" />
                                            <rect x="14" y="4" width="4" height="16" />
                                          </svg>
                                          <span>تعليق</span>
                                        </button>
                                        <button onClick={() => reject(inv)} className="btn btn-danger py-1 px-2.5 text-xs flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                          </svg>
                                          <span>رفض</span>
                                        </button>
                                      </>
                                    )}
                                    {inv.status === 'on_hold' && (
                                      <>
                                        <button onClick={() => approve(inv)} className="btn text-white border-transparent py-1 px-2.5 text-xs flex items-center gap-1" style={{ background: '#1B7A43' }}>
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                          <span>اعتماد</span>
                                        </button>
                                        <button onClick={() => markPending(inv)} className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                            <path d="M21 3v5h-5" />
                                          </svg>
                                          <span>قيد المراجعة</span>
                                        </button>
                                        <button onClick={() => reject(inv)} className="btn btn-danger py-1 px-2.5 text-xs flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                          </svg>
                                          <span>رفض</span>
                                        </button>
                                      </>
                                    )}
                                    {inv.status === 'rejected' && (
                                      <button onClick={() => markPending(inv)} className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                          <path d="M21 3v5h-5" />
                                        </svg>
                                        <span>إرجاع للمراجعة</span>
                                      </button>
                                    )}
                                    {inv.status === 'approved' && (
                                      <>
                                        <button onClick={() => settle(inv)} className="btn text-white border-transparent py-1 px-2.5 text-xs flex items-center gap-1" style={{ background: 'var(--blue)' }}>
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="1" x2="12" y2="23" />
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                          </svg>
                                          <span>تأكيد تسليم المبلغ</span>
                                        </button>
                                        <button onClick={() => markPending(inv)} className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                            <path d="M21 3v5h-5" />
                                          </svg>
                                          <span>إلغاء الاعتماد</span>
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                                <button onClick={() => setSelected(inv)} className="btn btn-ghost py-1.5 px-3 text-xs">عرض</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List View */}
                  <ul className="lg:hidden divide-y divide-ink-200">
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
                          {inv.settlement === 'handed_over' ? (
                            <button onClick={() => cancelSettle(inv)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                              <span>↩️ إلغاء التسليم</span>
                            </button>
                          ) : (
                            <>
                              {inv.status === 'pending' && (
                                <>
                                  <button onClick={() => approve(inv)} className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1" style={{ background: '#1B7A43' }}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>اعتماد</span>
                                  </button>
                                  <button onClick={() => hold(inv)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="6" y="4" width="4" height="16" />
                                      <rect x="14" y="4" width="4" height="16" />
                                    </svg>
                                    <span>تعليق</span>
                                  </button>
                                  <button onClick={() => reject(inv)} className="btn btn-danger py-1 px-3 text-xs flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                    <span>رفض</span>
                                  </button>
                                </>
                              )}
                              {inv.status === 'on_hold' && (
                                <>
                                  <button onClick={() => approve(inv)} className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1" style={{ background: '#1B7A43' }}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>اعتماد</span>
                                  </button>
                                  <button onClick={() => markPending(inv)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                      <path d="M21 3v5h-5" />
                                    </svg>
                                    <span>قيد المراجعة</span>
                                  </button>
                                  <button onClick={() => reject(inv)} className="btn btn-danger py-1 px-3 text-xs flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                    <span>رفض</span>
                                  </button>
                                </>
                              )}
                              {inv.status === 'rejected' && (
                                <button onClick={() => markPending(inv)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                    <path d="M21 3v5h-5" />
                                  </svg>
                                  <span>إرجاع للمراجعة</span>
                                </button>
                              )}
                              {inv.status === 'approved' && (
                                <>
                                  <button onClick={() => settle(inv)} className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1" style={{ background: 'var(--blue)' }}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="12" y1="1" x2="12" y2="23" />
                                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                    <span>تأكيد تسليم المبلغ</span>
                                  </button>
                                  <button onClick={() => markPending(inv)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                      <path d="M21 3v5h-5" />
                                    </svg>
                                    <span>إلغاء الاعتماد</span>
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          <button onClick={() => setSelected(inv)} className="btn btn-ghost py-1 px-3 text-xs mr-auto">التفاصيل</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* General Expenses & Other Revenues sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            
            {/* General Club Expenses Column */}
            <div className="card p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink-900">مصاريف النادي العامة</h2>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 font-semibold"
                >
                  ➕ إضافة مصروف عام
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[350px] border border-ink-200 rounded-lg divide-y divide-ink-100">
                {generalExpenses.length === 0 ? (
                  <p className="text-center py-10 text-ink-400 text-sm">لا توجد مصاريف عامة مسجلة.</p>
                ) : (
                  generalExpenses.map((exp) => (
                    <div key={exp.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-cream-100/30 transition-colors">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-900 text-sm">{exp.title}</div>
                        <div className="text-xs text-ink-400 mt-1">
                          {exp.date} · {exp.supervisorName}
                        </div>
                        {exp.notes && (
                          <div className="text-xs text-ink-500 mt-1.5 bg-cream-100/50 p-2 rounded border border-ink-200 italic">
                            {exp.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-left shrink-0 flex flex-col items-end gap-1.5">
                        <span className="font-bold text-sm text-nred-600" dir="ltr">
                          -{money(exp.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-xs text-nred-600 hover:underline p-1"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Other Revenues Column */}
            <div className="card p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink-900">إيرادات النادي الأخرى</h2>
                <button
                  onClick={() => setShowAddRevenue(true)}
                  className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 font-semibold"
                >
                  ➕ إضافة إيراد آخر
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[350px] border border-ink-200 rounded-lg divide-y divide-ink-100">
                {otherRevenues.length === 0 ? (
                  <p className="text-center py-10 text-ink-400 text-sm">لا توجد إيرادات أخرى مسجلة.</p>
                ) : (
                  otherRevenues.map((rev) => (
                    <div key={rev.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-cream-100/30 transition-colors">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-900 text-sm">{rev.title}</div>
                        <div className="text-xs text-ink-400 mt-1">
                          {rev.date} · {rev.supervisorName}
                        </div>
                        {rev.notes && (
                          <div className="text-xs text-ink-500 mt-1.5 bg-cream-100/50 p-2 rounded border border-ink-200 italic">
                            {rev.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-left shrink-0 flex flex-col items-end gap-1.5">
                        <span className="font-bold text-sm text-[#1B7A43]" dir="ltr">
                          +{money(rev.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteRevenue(rev.id)}
                          className="text-xs text-nred-600 hover:underline p-1"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* Invoice details modal */}
      {selected && (
        <ReviewModal
          invoice={selected}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={reject}
          onHold={hold}
          onMarkPending={markPending}
          onSettle={settle}
          onCancelSettle={cancelSettle}
        />
      )}

      {/* Add General Expense Modal */}
      {showAddExpense && (
        <AddTransactionModal
          type="expense"
          onClose={() => setShowAddExpense(false)}
          onSave={handleAddExpense}
        />
      )}

      {/* Add Other Revenue Modal */}
      {showAddRevenue && (
        <AddTransactionModal
          type="revenue"
          onClose={() => setShowAddRevenue(false)}
          onSave={handleAddRevenue}
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
  onSettle,
  onCancelSettle
}: {
  invoice: Invoice;
  onClose: () => void;
  onApprove: (inv: Invoice) => void;
  onReject: (inv: Invoice) => void;
  onHold: (inv: Invoice) => void;
  onMarkPending: (inv: Invoice) => void;
  onSettle: (inv: Invoice) => void;
  onCancelSettle: (inv: Invoice) => void;
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
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 font-bold p-1 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
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
          {invoice.settlement === 'handed_over' ? (
            <>
              <span className="text-sm text-ink-400 font-semibold py-1.5 flex-1">🔒 هذه الفاتورة مغلقة ومسددة بالكامل.</span>
              <button onClick={() => onCancelSettle(invoice)} className="btn btn-secondary py-1.5 px-3.5 text-xs flex items-center gap-1">
                <span>↩️ إلغاء التسليم</span>
              </button>
            </>
          ) : (
            <>
              {invoice.status === 'pending' && (
                <>
                  <button onClick={() => onApprove(invoice)} className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1" style={{ background: '#1B7A43' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>اعتماد</span>
                  </button>
                  <button onClick={() => onHold(invoice)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    <span>تعليق</span>
                  </button>
                  <button onClick={() => onReject(invoice)} className="btn btn-danger py-1 px-3 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span>رفض</span>
                  </button>
                </>
              )}
              {invoice.status === 'on_hold' && (
                <>
                  <button onClick={() => onApprove(invoice)} className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1" style={{ background: '#1B7A43' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>اعتماد</span>
                  </button>
                  <button onClick={() => onMarkPending(invoice)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                    <span>قيد المراجعة</span>
                  </button>
                  <button onClick={() => onReject(invoice)} className="btn btn-danger py-1 px-3 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span>رفض</span>
                  </button>
                </>
              )}
              {invoice.status === 'rejected' && (
                <button onClick={() => onMarkPending(invoice)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  <span>إرجاع للمراجعة</span>
                </button>
              )}
              {invoice.status === 'approved' && (
                <>
                  <button onClick={() => onSettle(invoice)} className="btn text-white border-transparent py-1 px-3 text-xs flex items-center gap-1" style={{ background: 'var(--blue)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <span>تأكيد تسليم المبلغ</span>
                  </button>
                  <button onClick={() => onMarkPending(invoice)} className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                    <span>إلغاء الاعتماد</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddTransactionModal({
  type,
  onClose,
  onSave
}: {
  type: 'expense' | 'revenue';
  onClose: () => void;
  onSave: (title: string, amount: number, date: string, notes: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const titleLabel = type === 'expense' ? 'اسم/بيان المصروف' : 'بيان/مصدر الإيراد';
  const headerText = type === 'expense' ? 'إضافة مصروف عام للنادي' : 'إضافة إيراد آخر للنادي';
  const saveText = type === 'expense' ? 'إضافة المصروف' : 'إضافة الإيراد';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !amount || !date) {
      pushToast('error', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      pushToast('error', 'المبلغ يجب أن يكون أكبر من صفر');
      return;
    }

    setSubmitting(true);
    const ok = await onSave(title.trim(), amtNum, date, notes.trim());
    setSubmitting(false);
    if (ok) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto" onClick={onClose}>
      <form onSubmit={handleSubmit} className="modal-panel w-full max-w-md my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-ink-200">
          <h2 className="text-xl font-bold text-ink-900">{headerText}</h2>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label">{titleLabel} <span className="req">*</span></label>
            <input
              type="text"
              className="field text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'expense' ? 'مثال: فاتورة كهرباء المقر' : 'مثال: تبرع فاعل خير'}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المبلغ (ريال) <span className="req">*</span></label>
              <input
                type="number"
                step="any"
                className="field text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="label">التاريخ <span className="req">*</span></label>
              <input
                type="date"
                className="field text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">ملاحظات إضافية</label>
            <textarea
              className="field text-sm min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل أو معلومات إضافية..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-ink-200 bg-cream-50">
          <button type="button" onClick={onClose} className="btn btn-secondary py-2 px-4 text-xs font-semibold">إلغاء</button>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary py-2 px-4 text-xs text-white font-semibold"
            style={{ background: 'var(--accent)' }}
          >
            {submitting ? 'جارٍ الحفظ...' : saveText}
          </button>
        </div>
      </form>
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
