'use client';

import { useEffect, useMemo, useState } from 'react';
import { stages } from '@/content';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Group = { id: number; name: string; stage: string };
type Student = { id: number; groupId: number | null };

export default function GroupsPage() {
  const { user } = useSupervisor();
  const isAdmin = user?.role === 'admin';

  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [stage, setStage] = useState<string>(stages[0].key);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [gr, sr] = await Promise.all([
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/students', { cache: 'no-store' })
    ]);
    setGroups((await gr.json().catch(() => ({ groups: [] }))).groups ?? []);
    setStudents((await sr.json().catch(() => ({ students: [] }))).students ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const countOf = useMemo(() => {
    const m = new Map<number, number>();
    students.forEach((s) => { if (s.groupId != null) m.set(s.groupId, (m.get(s.groupId) ?? 0) + 1); });
    return (id: number) => m.get(id) ?? 0;
  }, [students]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return pushToast('error', 'أدخل اسم المجموعة');
    setBusy(true);
    const r = await fetch('/api/supervisor/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), stage })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل إنشاء المجموعة');
    pushToast('success', 'تم إنشاء المجموعة');
    setName('');
    load();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">المجموعات والأسر</h1>
        <p className="text-sm text-ink-500">تنظيم الطلاب في مجموعات لتسهيل الحضور ورصد النقاط.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {isAdmin && (
          <form onSubmit={create} className="card p-6 space-y-4 self-start">
            <h2 className="text-lg font-bold text-ink-900">إنشاء مجموعة</h2>
            <div>
              <label className="label">اسم المجموعة</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أسرة النخبة" />
            </div>
            <div>
              <label className="label">المرحلة</label>
              <select className="field" value={stage} onChange={(e) => setStage(e.target.value)}>
                {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : 'إنشاء'}</button>
          </form>
        )}

        <div className={`card p-6 ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <h2 className="text-lg font-bold text-ink-900 mb-4">المجموعات ({groups.length})</h2>
          {loading ? (
            <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
          ) : groups.length === 0 ? (
            <p className="text-center py-10 text-ink-400 text-sm">لا توجد مجموعات بعد.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g) => (
                <div key={g.id} className="rounded-xl border border-ink-200 p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-ink-900">{g.name}</div>
                    <div className="text-xs text-ink-400 mt-0.5">{g.stage}</div>
                  </div>
                  <span className="pill pill-blue">{countOf(g.id)} طالب</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
