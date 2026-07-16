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
const QUICK_AMOUNTS = [10, 20, 50, 100];

// Avatar gradients sampled from the Nibras palette — picked deterministically by id.
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#E68500,#FFB752)',
  'linear-gradient(135deg,#103F91,#3F6CB8)',
  'linear-gradient(135deg,#0E92AF,#12B3D5)',
  'linear-gradient(135deg,#C2231B,#E52E25)',
  'linear-gradient(135deg,#1B7A43,#2F9E60)',
];
function avatarGradient(id: number) { return AVATAR_GRADIENTS[Math.abs(id) % AVATAR_GRADIENTS.length]; }
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
}

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
  const remaining = summary.balance - amountNum;
  const meterPct = summary.balance > 0 ? Math.max(0, Math.min(100, (remaining / summary.balance) * 100)) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (amountNum <= 0) return pushToast('error', 'أدخل مبلغ الخصم');
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
    if (!r.ok) return pushToast('error', j.error ?? 'فشل تسجيل عملية الخصم');

    setSummary(j.summary ?? summary);
    if (j.globalLog) setLog(j.globalLog);
    setAmount('');
    setProduct('');
    pushToast('success', `تم خصم ${amountNum} نقطة مقابل "${product.trim()}"`);
  }

  async function cancel(entry: LogEntry) {
    if (!window.confirm(`إلغاء عملية خصم "${entry.product}" للطالب ${entry.studentName} واسترجاع ${entry.amount} نقطة للرصيد؟`)) return;
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
        <p className="text-sm text-ink-500">ابحث عن الطالب لعرض رصيده ثم اخصم من رصيده مقابل المنتجات.</p>
      </div>

      {/* Search — hero card */}
      <div
        ref={searchRef}
        className="relative max-w-2xl mb-6 rounded-2xl border border-ink-200 bg-white p-5 shadow-soft"
      >
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-brand-600 tracking-wide">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          البحث عن طالب
        </div>
        <div className="relative">
          <input
            type="text"
            className="w-full h-14 rounded-2xl border-[1.5px] border-ink-200 bg-cream-100 pr-14 pl-4 text-base text-ink-900 outline-none transition-all placeholder:text-ink-300 focus:border-brand focus:bg-white focus:shadow-[0_0_0_5px_rgba(255,159,28,0.15)]"
            placeholder="اكتب رقم العضوية أو اسم الطالب…"
            value={query}
            onChange={e => { setQuery(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            autoComplete="off"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-brand-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          {dropdownOpen && (
            <div className="absolute z-30 w-full mt-2.5 bg-white border border-ink-200 rounded-2xl shadow-elevated max-h-80 overflow-y-auto scroll-soft">
              {loading ? (
                <div className="p-4 text-sm text-ink-400 text-center">جارٍ التحميل…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-ink-400 text-center">لا يوجد طلاب مطابقون</div>
              ) : (
                filtered.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectStudent(s)}
                    className="w-full text-right flex items-center gap-3.5 px-4 py-3 hover:bg-brand-50 transition-colors border-b border-ink-100 last:border-0"
                  >
                    <span
                      className="w-11 h-11 shrink-0 rounded-xl2 grid place-items-center text-white font-bold text-base shadow-[0_4px_12px_rgba(230,133,0,0.28)]"
                      style={{ background: avatarGradient(s.id) }}
                    >
                      {initials(s.studentName)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-ink-900 truncate">{s.studentName}</span>
                      <span className="block text-xs text-ink-400 mt-0.5">
                        <span className="font-mono">#{s.membershipNo}</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        <span>{s.stage} {s.grade}</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        <span>{groupName(s.groupId)}</span>
                      </span>
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
          {/* Wallet card — balance is the hero */}
          <div
            className="relative overflow-hidden rounded-[22px] text-white shadow-[0_18px_44px_rgba(230,133,0,0.32)]"
            style={{ background: 'linear-gradient(135deg,#E68500 0%,#FF9F1C 55%,#FFB752 100%)' }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(60% 90% at 12% 120%, rgba(255,255,255,.22), transparent 60%), radial-gradient(40% 70% at 95% -10%, rgba(255,255,255,.18), transparent 60%)' }}
            />
            <div className="relative flex items-center gap-3.5 px-6 pt-5">
              <span className="shrink-0 grid place-items-center rounded-2xl bg-white/20 border border-white/35 backdrop-blur-sm font-display font-bold text-xl" style={{ width: '3.25rem', height: '3.25rem' }}>
                {initials(selected.studentName)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-2xl leading-tight truncate">{selected.studentName}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-white/90">
                  <span>العضوية <b className="font-mono font-bold">#{selected.membershipNo}</b></span>
                  <span>{selected.stage} {selected.grade}</span>
                  <span>{groupName(selected.groupId)}</span>
                </div>
              </div>
              <button
                onClick={clearSelection}
                className="shrink-0 w-9 h-9 grid place-items-center rounded-xl border border-white/30 bg-white/10 text-white hover:bg-white/25 transition-colors"
                title="إلغاء الاختيار"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="relative text-center px-6 pt-3.5 pb-5">
              <div className="text-xs font-semibold tracking-[0.08em] text-white/85">الرصيد المتاح للخصم</div>
              <div className="mt-1.5 flex items-baseline justify-center gap-2.5 font-display font-bold leading-none tabular-nums" style={{ fontSize: '3.75rem', textShadow: '0 4px 18px rgba(120,60,0,.25)' }}>
                {detailsLoading ? '…' : summary.balance}
                <span className="font-body font-semibold text-lg opacity-90">نقطة</span>
              </div>
            </div>

            <div className="relative grid grid-cols-3 gap-px bg-white/20">
              <WalletStat label="النقاط الفردية" value={summary.individual} loading={detailsLoading} />
              <WalletStat label="النقاط الجماعية" value={summary.collective} loading={detailsLoading} />
              <WalletStat label="الإجمالي" value={summary.rankScore} loading={detailsLoading} />
            </div>
          </div>

          {/* Withdrawal — point-of-sale style */}
          <div className="rounded-2xl border border-ink-200 bg-white shadow-soft overflow-hidden max-w-2xl">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-ink-100">
              <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-nred-50 text-nred-600">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink-900">خصم من الرصيد</h2>
                <p className="text-xs text-ink-500 mt-0.5">اختر المنتج والمبلغ ثم أكّد العملية.</p>
              </div>
            </div>

            <form onSubmit={submit} className="p-6 space-y-5" autoComplete="off">
              <div>
                <label className="label">المنتج</label>
                <input
                  className="field w-full"
                  placeholder="مثال: قلم، دفتر، حلوى…"
                  value={product}
                  onChange={e => setProduct(e.target.value)}
                />
              </div>

              <div>
                <label className="label">مبلغ الخصم (نقاط)</label>
                <input
                  className={`field w-full text-center font-display font-bold tabular-nums ${insufficient ? 'invalid' : ''}`}
                  style={{ fontSize: '2rem', height: '4.25rem' }}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                />
                <div className="flex gap-2.5 mt-3">
                  {QUICK_AMOUNTS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmount(String(v))}
                      className={`flex-1 h-11 rounded-xl border-[1.5px] font-bold tabular-nums transition-all ${
                        amountNum === v
                          ? 'bg-brand border-brand text-white shadow-[0_5px_14px_rgba(255,159,28,0.32)]'
                          : 'bg-white border-ink-200 text-ink-900 hover:border-brand-400 hover:text-brand-600'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live after-balance */}
              <div
                className={`rounded-2xl border p-4 transition-colors ${
                  amountNum <= 0
                    ? 'border-ink-200 bg-cream-100'
                    : insufficient
                      ? 'border-nred-600/30 bg-nred-50'
                      : 'border-emerald-600/25 bg-emerald-50'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ink-500">الرصيد بعد الخصم</span>
                  <span className={`font-display font-bold text-2xl tabular-nums ${
                    amountNum <= 0 ? 'text-ink-900' : insufficient ? 'text-nred-600' : 'text-emerald-700'
                  }`}>
                    {detailsLoading ? '…' : remaining}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/10 mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${insufficient ? 'bg-nred' : 'bg-emerald-600'}`}
                    style={{ width: `${amountNum <= 0 ? 100 : meterPct}%` }}
                  />
                </div>
                <div className={`text-xs font-semibold mt-2.5 ${
                  amountNum <= 0 ? 'text-ink-400' : insufficient ? 'text-nred-600' : 'text-emerald-700'
                }`}>
                  {amountNum <= 0
                    ? 'لم يُحدَّد مبلغ بعد.'
                    : insufficient
                      ? `⚠️ الرصيد غير كافٍ — المتاح ${summary.balance} نقطة فقط.`
                      : `✓ سيبقى ${remaining} نقطة بعد خصم ${amountNum}.`}
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || detailsLoading || amountNum <= 0 || !product.trim() || insufficient}
                className="btn btn-primary w-full py-3.5 rounded-2xl font-bold text-base"
              >
                {busy ? '…' : 'تأكيد الخصم'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Store-wide withdrawal log (all students) */}
      <div className="rounded-2xl border border-ink-200 bg-white shadow-soft overflow-hidden mt-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h2 className="text-lg font-bold text-ink-900">سجل الخصومات</h2>
            <p className="text-xs text-ink-500 mt-0.5">جميع عمليات الخصم لكل الطلاب.</p>
          </div>
          {log.length > 0 && (
            <span className="text-xs text-ink-400 bg-cream-100 px-3 py-1.5 rounded-full font-semibold">{log.length} عملية</span>
          )}
        </div>

        {logLoading ? (
          <div className="py-8 text-center text-ink-400 text-sm">جارٍ التحميل…</div>
        ) : log.length === 0 ? (
          <div className="py-8 text-center text-ink-400 text-sm">لا توجد عمليات خصم بعد.</div>
        ) : (
          <div>
            {log.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-6 py-3.5 border-b border-ink-100 last:border-0">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
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
                <span className="shrink-0 font-mono font-bold text-nred-600 tabular-nums">−{entry.amount}</span>
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

function WalletStat({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <div
      className="px-2 py-3.5 text-center backdrop-blur-sm"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.03))' }}
    >
      <div className="text-xs text-white/85 mb-1">{label}</div>
      <div className="font-display font-bold text-2xl tabular-nums">{loading ? '…' : value}</div>
    </div>
  );
}
