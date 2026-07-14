'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = {
  id: number; membershipNo: number; studentName: string;
  groupId: number | null; stage: string; grade: string;
  registrationStatus: string; paymentStatus: string;
};
type Group = { id: number; name: string; stage: string };
type Summary = { individual: number; collective: number; deduction: number; balance: number; rankScore: number };
type LogEntry = {
  id: number; registrationId: number; studentName: string; membershipNo: number | null;
  product: string; amount: number; recordedBy: string; createdAt: string;
};

const EMPTY_SUMMARY: Summary = { individual: 0, collective: 0, deduction: 0, balance: 0, rankScore: 0 };

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function StorePage() {
  const { user } = useSupervisor();
  const isAdmin = (user?.role?.split(',').map(r => r.trim()).includes('admin')) || user?.permissions?.includes('*');
  const canAccess = isAdmin || !!user?.permissions?.includes('store');

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Search / selection
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selected student's live figures
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Store-wide withdrawal log (all students)
  const [log, setLog] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  // Withdrawal form
  const [amount, setAmount] = useState('');
  const [product, setProduct] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/supervisor/students?scope=all', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/store', { cache: 'no-store' }),
    ]).then(async ([sr, gr, lr]) => {
      const srj = await sr.json().catch(() => ({ students: [] }));
      const grj = await gr.json().catch(() => ({ groups: [] }));
      const lrj = await lr.json().catch(() => ({ globalLog: [] }));
      const all: Student[] = srj.students ?? [];
      // Only active students can spend (matches the points page's rule).
      setStudents(all.filter(s =>
        (s.registrationStatus === 'approved' || s.paymentStatus === 'exempted')
      ));
      setGroups(grj.groups ?? []);
      setLog(lrj.globalLog ?? []);
      setLoading(false);
      setLogLoading(false);
    }).catch(() => { setLoading(false); setLogLoading(false); });
  }, []);

  // Close the search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const groupName = (id: number | null) =>
    id == null ? '—' : (groups.find(g => g.id === id)?.name ?? '—');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 30);
    return students.filter(s =>
      s.studentName.toLowerCase().includes(q) || String(s.membershipNo).includes(q)
    ).slice(0, 30);
  }, [students, query]);

  async function loadDetails(studentId: number) {
    setDetailsLoading(true);
    try {
      const r = await fetch(`/api/supervisor/store?studentId=${studentId}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { pushToast('error', j.error ?? 'تعذّر جلب بيانات الطالب'); return; }
      setSummary(j.summary ?? EMPTY_SUMMARY);
      if (j.globalLog) setLog(j.globalLog);
    } finally {
      setDetailsLoading(false);
    }
  }

  function selectStudent(s: Student) {
    setSelected(s);
    setQuery('');
    setDropdownOpen(false);
    setAmount('');
    setProduct('');
    setSummary(EMPTY_SUMMARY);
    loadDetails(s.id);
  }

  function clearSelection() {
    setSelected(null);
    setSummary(EMPTY_SUMMARY);
    setAmount('');
    setProduct('');
  }

  const amountNum = parseInt(amount, 10) || 0;
  const insufficient = selected != null && amountNum > 0 && amountNum > summary.balance;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (amountNum <= 0) return pushToast('error', 'أدخل مبلغ السحب');
    if (!product.trim()) return pushToast('error', 'اكتب اسم المنتج');
    if (insufficient) return pushToast('error', 'الطالب لا يملك رصيداً كافياً');

    setBusy(true);
    const r = await fetch('/api/supervisor/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: selected.id, amount: amountNum, product: product.trim() }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل تسجيل عملية السحب');

    setSummary(j.summary ?? summary);
    if (j.globalLog) setLog(j.globalLog);
    setAmount('');
    setProduct('');
    pushToast('success', `تم سحب ${amountNum} نقطة مقابل "${product.trim()}"`);
  }

  async function cancel(entry: LogEntry) {
    if (!window.confirm(`إلغاء عملية سحب "${entry.product}" للطالب ${entry.studentName} واسترجاع ${entry.amount} نقطة للرصيد؟`)) return;
    setCancelingId(entry.id);
    const r = await fetch(`/api/supervisor/store?id=${entry.id}`, { method: 'DELETE' });
    setCancelingId(null);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل إلغاء العملية');
    // Keep the selected student's balance card in sync when the cancelled
    // purchase belongs to them.
    if (selected && j.registrationId === selected.id && j.summary) setSummary(j.summary);
    if (j.globalLog) setLog(j.globalLog);
    else setLog(prev => prev.filter(l => l.id !== entry.id));
    pushToast('success', `تم إلغاء العملية واسترجاع ${entry.amount} نقطة`);
  }

  if (!canAccess) {
    return (
      <div className="card p-10 text-center text-ink-500">
        🔒 عذراً، لا تملك الصلاحية للوصول إلى المتجر.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-0.5">المتجر</h1>
        <p className="text-sm text-ink-500">ابحث عن الطالب لعرض رصيده ثم اسحب من رصيده مقابل المنتجات.</p>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative max-w-2xl mb-6">
        <label className="label">رقم العضوية أو اسم الطالب</label>
        <div className="relative">
          <input
            type="text"
            className="field w-full"
            placeholder="اكتب رقم العضوية أو اسم الطالب..."
            value={query}
            onChange={e => { setQuery(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
          />
          {dropdownOpen && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg max-h-72 overflow-y-auto scroll-soft">
              {loading ? (
                <div className="p-3 text-sm text-ink-400 text-center">جارٍ التحميل…</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-sm text-ink-400 text-center">لا يوجد طلاب مطابقون</div>
              ) : (
                filtered.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectStudent(s)}
                    className="w-full text-right px-3 py-2.5 text-sm hover:bg-cream-50 transition-colors flex items-center justify-between gap-2 border-b border-ink-50 last:border-0"
                  >
                    <span className="font-medium text-ink-900">{s.studentName}</span>
                    <span className="text-xs text-ink-400 shrink-0">
                      <span className="font-mono">#{s.membershipNo}</span>
                      <span className="mx-1">·</span>
                      <span>{s.stage} {s.grade}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {!selected ? (
        <div className="card p-10 text-center text-ink-400">
          ابحث عن طالب أعلاه لعرض بياناته ورصيده.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Student + points card */}
          <div className="card overflow-hidden">
            <div
              className="px-6 py-5 flex items-start justify-between gap-4 text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent-deep), var(--accent))' }}
            >
              <div className="min-w-0">
                <div className="text-xl font-bold truncate">{selected.studentName}</div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/90">
                  <span>رقم العضوية: <span className="font-mono font-semibold">#{selected.membershipNo}</span></span>
                  <span>المرحلة: <span className="font-semibold">{selected.stage} {selected.grade}</span></span>
                  <span>المجموعة: <span className="font-semibold">{groupName(selected.groupId)}</span></span>
                </div>
              </div>
              <button
                onClick={clearSelection}
                className="shrink-0 text-white/80 hover:text-white p-1"
                title="إلغاء الاختيار"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-ink-100 border-t border-ink-100">
              <Stat label="النقاط الفردية" value={summary.individual} loading={detailsLoading} />
              <Stat label="النقاط الجماعية" value={summary.collective} loading={detailsLoading} />
              <Stat label="الرصيد" value={summary.balance} loading={detailsLoading} highlight />
              <Stat label="الإجمالي" value={summary.rankScore} loading={detailsLoading} />
            </div>
          </div>

          {/* Withdrawal form */}
          <div className="card p-6 max-w-2xl">
            <h2 className="text-lg font-bold text-ink-900 mb-4">سحب من الرصيد</h2>
            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label">مبلغ السحب (نقاط)</label>
                  <input
                    className={`field w-full ${insufficient ? 'invalid' : ''}`}
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div>
                  <label className="label">المنتج</label>
                  <input
                    className="field w-full"
                    placeholder="مثال: قلم، دفتر، حلوى…"
                    value={product}
                    onChange={e => setProduct(e.target.value)}
                  />
                </div>
              </div>

              {insufficient && (
                <div className="p-3 bg-nred-50 border border-nred-200 rounded-xl text-sm text-nred-600 font-medium">
                  ⚠️ الطالب لا يملك رصيداً كافياً — الرصيد المتاح {summary.balance} نقطة فقط.
                </div>
              )}

              <button
                type="submit"
                disabled={busy || detailsLoading || amountNum <= 0 || !product.trim() || insufficient}
                className="btn btn-primary w-full"
              >
                {busy ? '…' : 'تأكيد السحب'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Store-wide withdrawal log (all students) */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-ink-900">سجل السحب</h2>
            <p className="text-xs text-ink-500">جميع عمليات السحب لكل الطلاب.</p>
          </div>
          {log.length > 0 && (
            <span className="text-xs text-ink-400">{log.length} عملية</span>
          )}
        </div>

        {logLoading ? (
          <div className="py-8 text-center text-ink-400 text-sm">جارٍ التحميل…</div>
        ) : log.length === 0 ? (
          <div className="py-8 text-center text-ink-400 text-sm">لا توجد عمليات سحب بعد.</div>
        ) : (
          <div className="divide-y divide-ink-100">
            {log.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-900">{entry.studentName}</span>
                    {entry.membershipNo != null && (
                      <span className="text-xs text-ink-400 font-mono">#{entry.membershipNo}</span>
                    )}
                  </div>
                  <div className="text-sm text-ink-700 truncate">{entry.product}</div>
                  <div className="text-xs text-ink-400">
                    {formatDate(entry.createdAt)}
                    {entry.recordedBy ? <> · بواسطة {entry.recordedBy}</> : null}
                  </div>
                </div>
                <span className="shrink-0 font-mono font-semibold text-nred-600">−{entry.amount}</span>
                <button
                  onClick={() => cancel(entry)}
                  disabled={cancelingId === entry.id}
                  title="إلغاء العملية واسترجاع المبلغ"
                  className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-nred-600 hover:bg-nred-50 transition-colors disabled:opacity-50"
                >
                  {cancelingId === entry.id ? (
                    <span className="w-4 h-4 rounded-full border-2 border-ink-200 border-t-nred-600 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, loading, highlight }: { label: string; value: number; loading?: boolean; highlight?: boolean }) {
  return (
    <div className="px-4 py-4 text-center">
      <div className="text-xs text-ink-400 mb-1">{label}</div>
      <div className={`text-2xl font-extrabold ${highlight ? 'text-brand-600' : 'text-ink-900'}`}>
        {loading ? '…' : value}
      </div>
    </div>
  );
}
