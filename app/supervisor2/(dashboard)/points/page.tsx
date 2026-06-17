'use client';

import { useEffect, useMemo, useState } from 'react';
import { pushToast } from '@/components/Toast';

type Student = { id: number; membershipNo: number; studentName: string; groupId: number | null };
type Group = { id: number; name: string };
type Point = {
  id: number; registrationId: number; delta: number; reason: string;
  category: string; recordedBy: string | null; createdAt: string;
};

const CATEGORIES = [
  { key: 'behavior', label: 'سلوك' },
  { key: 'participation', label: 'مشاركة' },
  { key: 'activity', label: 'نشاط' },
  { key: 'other', label: 'أخرى' }
];
const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;

export default function PointsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [studentId, setStudentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('5');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('behavior');
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [sr, gr, pr] = await Promise.all([
      fetch('/api/supervisor/students', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/points', { cache: 'no-store' })
    ]);
    setStudents((await sr.json().catch(() => ({ students: [] }))).students ?? []);
    setGroups((await gr.json().catch(() => ({ groups: [] }))).groups ?? []);
    setPoints((await pr.json().catch(() => ({ points: [] }))).points ?? []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  const nameOf = useMemo(() => {
    const m = new Map(students.map((s) => [s.id, s.studentName]));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [students]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const delta = sign * Math.abs(parseInt(amount, 10) || 0);
    if (!delta || !reason.trim()) return pushToast('error', 'أدخل عدد النقاط والسبب');
    if (mode === 'individual' && !studentId) return pushToast('error', 'اختر الطالب');
    if (mode === 'group' && !groupId) return pushToast('error', 'اختر المجموعة');

    setBusy(true);
    const r = await fetch('/api/supervisor/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: mode === 'individual' ? studentId : undefined,
        groupId: mode === 'group' ? groupId : undefined,
        delta, reason: reason.trim(), category
      })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل تسجيل النقاط');
    pushToast('success', j.bulk ? `تم رصد النقاط لـ ${j.pointRecords.length} طالب` : 'تم رصد النقاط');
    setReason('');
    loadAll();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">رصد النقاط</h1>
        <p className="text-sm text-ink-500">امنح أو اخصم نقاطاً لطالب أو لمجموعة كاملة.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form onSubmit={submit} className="card p-6 space-y-4 lg:col-span-1 self-start">
          <div className="flex gap-2">
            <button type="button" className={`choice flex-1 ${mode === 'individual' ? 'is-active' : ''}`} onClick={() => setMode('individual')}>طالب</button>
            <button type="button" className={`choice flex-1 ${mode === 'group' ? 'is-active' : ''}`} onClick={() => setMode('group')}>مجموعة</button>
          </div>

          {mode === 'individual' ? (
            <div>
              <label className="label">الطالب</label>
              <select className="field" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">اختر الطالب</option>
                {students.map((s) => <option key={s.id} value={String(s.id)}>{s.studentName} (#{s.membershipNo})</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">المجموعة / الأسرة</label>
              <select className="field" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">اختر المجموعة</option>
                {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">النوع</label>
            <div className="flex gap-2">
              <button type="button" className={`choice flex-1 ${sign === 1 ? 'is-active' : ''}`} onClick={() => setSign(1)}>+ إضافة</button>
              <button type="button" className={`choice flex-1 ${sign === -1 ? 'is-active' : ''}`} onClick={() => setSign(-1)}>− خصم</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">عدد النقاط</label>
              <input className="field" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">السبب</label>
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تميّز في النشاط" />
          </div>

          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : 'رصد النقاط'}</button>
        </form>

        <div className="card p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-ink-900 mb-4">سجل النقاط</h2>
          {loading ? (
            <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
          ) : points.length === 0 ? (
            <p className="text-center py-10 text-ink-400 text-sm">لا توجد نقاط مرصودة بعد.</p>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto scroll-soft">
                <table className="tbl">
                  <thead>
                    <tr><th>الطالب</th><th>النقاط</th><th>التصنيف</th><th>السبب</th><th>بواسطة</th></tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{nameOf(p.registrationId)}</td>
                        <td>
                          <span className={`pill ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                            {p.delta >= 0 ? `+${p.delta}` : p.delta}
                          </span>
                        </td>
                        <td className="text-ink-500 text-sm">{catLabel(p.category)}</td>
                        <td className="text-ink-700 text-sm">{p.reason}</td>
                        <td className="text-ink-400 text-sm">{p.recordedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="lg:hidden divide-y divide-ink-200">
                {points.map((p) => (
                  <li key={p.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink-900 truncate">{nameOf(p.registrationId)}</div>
                      <div className="text-sm text-ink-700 mt-0.5">{p.reason}</div>
                      <div className="text-xs text-ink-400 mt-0.5">{catLabel(p.category)} · {p.recordedBy || '—'}</div>
                    </div>
                    <span className={`pill shrink-0 ${p.delta >= 0 ? 'pill-green' : 'pill-red'}`} dir="ltr">
                      {p.delta >= 0 ? `+${p.delta}` : p.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
