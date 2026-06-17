'use client';

import { useEffect, useMemo, useState } from 'react';
import { pushToast } from '@/components/Toast';

type Student = {
  id: number; membershipNo: number; studentName: string;
  paymentStatus: string; paymentType: string; paymentReceipt: string | null;
};

type Tab = 'review' | 'unpaid' | 'paid' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'review', label: 'بانتظار المراجعة' },
  { key: 'unpaid', label: 'غير مدفوع' },
  { key: 'paid', label: 'مدفوع' },
  { key: 'all', label: 'الكل' }
];

function isReview(s: Student) {
  return s.paymentStatus !== 'paid' && s.paymentType === 'now' && !!s.paymentReceipt;
}

export default function PaymentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('review');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const r = await fetch('/api/supervisor/students', { cache: 'no-store' });
    setStudents((await r.json().catch(() => ({ students: [] }))).students ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (tab === 'all') return true;
      if (tab === 'paid') return s.paymentStatus === 'paid';
      if (tab === 'unpaid') return s.paymentStatus !== 'paid';
      if (tab === 'review') return isReview(s);
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
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, paymentStatus: 'paid' } : s)));
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
            {t.key === 'review' && reviewCount > 0 && <span className="font-bold"> ({reviewCount})</span>}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center py-16 text-ink-400 text-sm">جارٍ التحميل…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-ink-400 text-sm">لا توجد سجلات في هذا التصنيف.</p>
        ) : (
          <div className="overflow-x-auto scroll-soft">
            <table className="tbl">
              <thead>
                <tr><th>الطالب</th><th>العضوية</th><th>نوع الدفع</th><th>الإيصال</th><th>الحالة</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.studentName}</td>
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
                      {s.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => confirm(s.id)}
                          disabled={busyId === s.id}
                          className="btn text-white border-transparent py-1 px-3 text-xs"
                          style={{ background: '#1B7A43' }}
                        >
                          ✅ تأكيد الدفع
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
