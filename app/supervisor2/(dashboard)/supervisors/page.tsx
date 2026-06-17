'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Sup = { id: number; name: string; email: string; role: string; groupIds: string; createdAt: string };
type Group = { id: number; name: string };

const ROLE_MAP: Record<string, string> = {
  admin: 'مدير عام',
  attendance_supervisor: 'مشرف تحضير',
  social_supervisor: 'مشرف اجتماعية',
  cultural_supervisor: 'مشرف ثقافية',
  groups_supervisor: 'مشرف أسر',
  general_supervisor: 'مشرف عام'
};

const getRoleLabel = (roleStr: string) => {
  if (roleStr === 'admin') return 'مدير عام';
  return roleStr
    .split(',')
    .map((r) => ROLE_MAP[r.trim()] || r)
    .filter(Boolean)
    .join('، ');
};

export default function SupervisorsPage() {
  const { user } = useSupervisor();
  const [list, setList] = useState<Sup[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'admin' | 'supervisor'>('supervisor');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['general_supervisor']);
  const [groupIds, setGroupIds] = useState<number[]>([]);

  async function load() {
    const [r, gr] = await Promise.all([
      fetch('/api/supervisor/supervisors', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' })
    ]);
    if (r.status === 401) { setLoading(false); return; }
    setList((await r.json().catch(() => ({ supervisors: [] }))).supervisors ?? []);
    setGroups((await gr.json().catch(() => ({ groups: [] }))).groups ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (user && user.role !== 'admin') {
    return <div className="card p-10 text-center text-ink-500">هذه الصفحة متاحة للمدير العام فقط.</div>;
  }

  function toggleGroup(id: number) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return pushToast('error', 'أكمل الحقول الإلزامية');

    let finalRole = 'admin';
    let finalGroupIds = '';

    if (accountType === 'supervisor') {
      if (selectedRoles.length === 0) {
        return pushToast('error', 'يرجى اختيار دور وظيفي واحد على الأقل للمشرف');
      }
      if (selectedRoles.includes('groups_supervisor') && groupIds.length === 0) {
        return pushToast('error', 'يجب تحديد المجموعات/الأسر المسؤول عنها مشرف الأسر');
      }
      finalRole = selectedRoles.join(',');
      finalGroupIds = selectedRoles.includes('groups_supervisor') ? groupIds.join(',') : '';
    }

    setBusy(true);
    const r = await fetch('/api/supervisor/supervisors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        role: finalRole,
        groupIds: finalGroupIds
      })
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل إضافة المشرف');
    pushToast('success', 'تمت إضافة المشرف');
    setName('');
    setEmail('');
    setPassword('');
    setAccountType('supervisor');
    setSelectedRoles(['general_supervisor']);
    setGroupIds([]);
    load();
  }

  async function del(s: Sup) {
    if (!confirm(`حذف المشرف «${s.name}»؟`)) return;
    const r = await fetch(`/api/supervisor/supervisors?id=${s.id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? 'فشل الحذف');
    pushToast('info', 'تم حذف المشرف');
    load();
  }

  const groupNames = (ids: string) =>
    ids.split(',').map((id) => groups.find((g) => String(g.id) === id.trim())?.name).filter(Boolean).join('، ');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">المشرفون</h1>
        <p className="text-sm text-ink-500">إدارة حسابات المشرفين وصلاحياتهم.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form onSubmit={create} className="card p-6 space-y-4 self-start">
          <h2 className="text-lg font-bold text-ink-900">إضافة مشرف</h2>
          <div>
            <label className="label">الاسم</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">البريد / اسم المستخدم</label>
            <input className="field" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input className="field" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">نوع الحساب</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`choice flex-1 ${accountType === 'supervisor' ? 'is-active' : ''}`}
                onClick={() => setAccountType('supervisor')}
              >
                مشرف
              </button>
              <button
                type="button"
                className={`choice flex-1 ${accountType === 'admin' ? 'is-active' : ''}`}
                onClick={() => setAccountType('admin')}
              >
                مدير عام
              </button>
            </div>
          </div>

          {accountType === 'supervisor' && (
            <div className="space-y-3">
              <label className="label font-semibold">الأدوار والوظائف المشرف عليها (تحديد متعدد)</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { key: 'attendance_supervisor', label: 'مشرف تحضير' },
                  { key: 'social_supervisor', label: 'مشرف اجتماعية' },
                  { key: 'cultural_supervisor', label: 'مشرف ثقافية' },
                  { key: 'groups_supervisor', label: 'مشرف أسر' },
                  { key: 'general_supervisor', label: 'مشرف عام' }
                ].map((r) => {
                  const active = selectedRoles.includes(r.key);
                  return (
                    <label key={r.key} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg border border-ink-200 hover:bg-cream-50 transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          setSelectedRoles((prev) =>
                            prev.includes(r.key) ? prev.filter((x) => x !== r.key) : [...prev, r.key]
                          );
                        }}
                        className="rounded text-brand w-5 h-5 focus:ring-brand cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-ink-900">{r.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {accountType === 'supervisor' && selectedRoles.includes('groups_supervisor') && (
            <div>
              <label className="label font-semibold text-brand-600">المجموعات المسؤول عنها (إجباري لمشرف الأسر) <span className="text-red-500">*</span></label>
              {groups.length === 0 ? (
                <p className="text-xs text-ink-400">لا توجد مجموعات بعد — أنشئها من صفحة المجموعات.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => toggleGroup(g.id)}
                      className={`choice py-1.5 px-3 text-xs ${groupIds.includes(g.id) ? 'is-active' : ''}`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : 'إضافة المشرف'}</button>
        </form>

        <div className="card p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-ink-900 mb-4">الحسابات ({list.length})</h2>
          {loading ? (
            <p className="text-center py-10 text-ink-400 text-sm">جارٍ التحميل…</p>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto scroll-soft">
                <table className="tbl">
                  <thead>
                    <tr><th>الاسم</th><th>المستخدم</th><th>الصلاحية</th><th>المجموعات</th><th></th></tr>
                  </thead>
                  <tbody>
                    {list.map((s) => {
                      const primary = s.email === 'admin' || s.email === 'admin@nibras.com';
                      return (
                        <tr key={s.id}>
                          <td className="font-medium">{s.name}</td>
                          <td dir="ltr" className="text-right text-ink-500">{s.email}</td>
                          <td>
                            <span className={`pill ${s.role === 'admin' ? 'pill-blue' : 'pill-gray'}`}>
                              {getRoleLabel(s.role)}
                            </span>
                          </td>
                          <td className="text-ink-500 text-sm">{s.role === 'admin' ? 'الكل' : groupNames(s.groupIds) || '—'}</td>
                          <td>
                            {!primary && (
                              <button onClick={() => del(s)} className="btn btn-danger py-1 px-3 text-xs">حذف</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="lg:hidden divide-y divide-ink-200">
                {list.map((s) => {
                  const primary = s.email === 'admin' || s.email === 'admin@nibras.com';
                  return (
                    <li key={s.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-900 truncate">{s.name}</span>
                          <span className={`pill shrink-0 ${s.role === 'admin' ? 'pill-blue' : 'pill-gray'}`}>
                            {getRoleLabel(s.role)}
                          </span>
                        </div>
                        <div dir="ltr" className="text-xs text-ink-400 mt-0.5 text-right truncate">{s.email}</div>
                        <div className="text-xs text-ink-500 mt-0.5">
                          المجموعات: {s.role === 'admin' ? 'الكل' : groupNames(s.groupIds) || '—'}
                        </div>
                      </div>
                      {!primary && (
                        <button onClick={() => del(s)} className="btn btn-danger py-1 px-3 text-xs shrink-0">حذف</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
