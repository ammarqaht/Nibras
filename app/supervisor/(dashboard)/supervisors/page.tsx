'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

import RoleCustomizer from './RoleCustomizer';
import { stages } from '@/content';

type Sup = { id: number; name: string; email: string; role: string; groupIds: string; customPermissions?: string; stage?: string; createdAt: string };
type Group = { id: number; name: string };

const MODULES = [
  { id: 'students', label: 'الطلاب' },
  { id: 'attendance', label: 'الحضور' },
  { id: 'points', label: 'النقاط' },
  { id: 'tasks', label: 'المهام' },
  { id: 'schedule', label: 'الجدول' },
  { id: 'groups', label: 'المجموعات' },
  { id: 'payments', label: 'المدفوعات' },
  { id: 'invoices', label: 'الفواتير' },
  { id: 'finance', label: 'المالية' },
  { id: 'announcements', label: 'الإشعارات' }
];

const ROLE_MAP: Record<string, string> = {
  admin: 'مدير عام',
  finance: 'مسؤول المالية',
  attendance_supervisor: 'مشرف تحضير',
  social_supervisor: 'مشرف اجتماعية',
  cultural_supervisor: 'مشرف ثقافية',
  groups_supervisor: 'مشرف أسر',
  general_supervisor: 'مشرف عام',
  finance_supervisor: 'مسؤول المالية',
  media_supervisor: 'مشرف الإعلامية',
  scientific_supervisor: 'مشرف العلمية',
  sports_supervisor: 'مشرف الرياضية',
  stage_supervisor: 'مشرف مرحلة'
};

const getRoleLabel = (roleStr: string) => {
  if (roleStr === 'admin') return 'مدير عام';
  if (roleStr === 'finance') return 'مسؤول المالية';
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
  const [accountType, setAccountType] = useState<'admin' | 'supervisor' | 'finance'>('supervisor');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['general_supervisor']);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [stage, setStage] = useState('');
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isEditingPrimary, setIsEditingPrimary] = useState(false);
  const [activeTab, setActiveTab] = useState<'supervisors' | 'roles'>('supervisors');

  async function load() {
    const [r, gr, pr] = await Promise.all([
      fetch('/api/supervisor/supervisors', { cache: 'no-store' }),
      fetch('/api/supervisor/groups', { cache: 'no-store' }),
      fetch('/api/supervisor/role-permissions', { cache: 'no-store' })
    ]);
    if (r.status === 401) { setLoading(false); return; }
    setList((await r.json().catch(() => ({ supervisors: [] }))).supervisors ?? []);
    setGroups((await gr.json().catch(() => ({ groups: [] }))).groups ?? []);
    
    const prJson = await pr.json().catch(() => ({ permissions: {} }));
    setRolePermissionsMap(prJson.permissions || {});
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (user && user.role !== 'admin') {
    return <div className="card p-10 text-center text-ink-500">هذه الصفحة متاحة للمدير العام فقط.</div>;
  }

  function toggleGroup(id: number) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function cancelEdit() {
    setName('');
    setEmail('');
    setPassword('');
    setAccountType('supervisor');
    setSelectedRoles(['general_supervisor']);
    setGroupIds([]);
    setStage('');
    setCustomPermissions([]);
    setEditingId(null);
    setIsEditingPrimary(false);
  }

  function startEdit(s: Sup) {
    setEditingId(s.id);
    setName(s.name);
    setEmail(s.email);
    setPassword('');
    const primary = s.email === 'admin' || s.email === 'admin@nibras.com';
    setIsEditingPrimary(primary);
    if (s.role === 'admin') {
      setAccountType('admin');
      setSelectedRoles(['general_supervisor']);
      setGroupIds([]);
    } else if (s.role === 'finance') {
      setAccountType('finance');
      setSelectedRoles([]);
      setGroupIds([]);
    } else {
      setAccountType('supervisor');
      setSelectedRoles(s.role.split(',').map((r) => r.trim()).filter(Boolean));
      setGroupIds(s.groupIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id)));
    }
    setStage(s.stage ?? '');
    setCustomPermissions(s.customPermissions ? s.customPermissions.split(',').map(p => p.trim()).filter(Boolean) : []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return pushToast('error', 'أكمل الحقول الإلزامية');
    if (!editingId && !password) return pushToast('error', 'يرجى إدخال كلمة مرور للمشرف الجديد');

    let finalRole = accountType === 'admin' ? 'admin' : accountType === 'finance' ? 'finance' : '';
    let finalGroupIds = '';

    if (accountType === 'supervisor') {
      if (selectedRoles.length === 0) {
        return pushToast('error', 'يرجى اختيار دور وظيفي واحد على الأقل للمشرف');
      }
      if (selectedRoles.includes('groups_supervisor') && groupIds.length === 0) {
        return pushToast('error', 'يجب تحديد المجموعات/الأسر المسؤول عنها مشرف الأسر');
      }
      if (selectedRoles.includes('stage_supervisor') && !stage) {
        return pushToast('error', 'يجب اختيار المرحلة المسؤول عنها مشرف المرحلة');
      }
      finalRole = selectedRoles.join(',');
      finalGroupIds = selectedRoles.includes('groups_supervisor') ? groupIds.join(',') : '';
    }

    const finalStage = accountType === 'supervisor' && selectedRoles.includes('stage_supervisor') ? stage : '';

    setBusy(true);

    const payload: any = {
      name: name.trim(),
      email: email.trim(),
      role: finalRole,
      groupIds: finalGroupIds,
      stage: finalStage,
      customPermissions: customPermissions.join(',')
    };

    if (editingId) {
      payload.id = editingId;
      if (password) payload.password = password;
    } else {
      payload.password = password;
    }

    const r = await fetch('/api/supervisor/supervisors', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return pushToast('error', j.error ?? (editingId ? 'فشل تعديل المشرف' : 'فشل إضافة المشرف'));

    pushToast('success', editingId ? 'تم تعديل بيانات المشرف' : 'تمت إضافة المشرف');
    cancelEdit();
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">المشرفون</h1>
          <p className="text-sm text-ink-500">إدارة حسابات المشرفين وصلاحياتهم.</p>
        </div>
        <div className="flex bg-ink-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('supervisors')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'supervisors' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600 hover:text-ink-900'}`}
          >
            إضافة وإدارة المشرفين
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'roles' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600 hover:text-ink-900'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>تخصيص الأدوار</span>
          </button>
        </div>
      </div>

      {activeTab === 'roles' ? (
        <RoleCustomizer />
      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form onSubmit={handleSubmit} className="card p-6 space-y-4 self-start">
          <h2 className="text-lg font-bold text-ink-900">{editingId ? 'تعديل المشرف' : 'إضافة مشرف'}</h2>
          <div>
            <label className="label">الاسم</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">البريد / اسم المستخدم</label>
            <input className="field" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">
              كلمة المرور {editingId && <span className="text-xs text-ink-400 font-normal">(اتركها فارغة للإبقاء على الحالية)</span>}
            </label>
            <input className="field" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editingId ? '••••••••' : ''} />
          </div>
          <div>
            <label className="label">نوع الحساب</label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isEditingPrimary}
                className={`choice flex-1 ${accountType === 'supervisor' ? 'is-active' : ''} ${isEditingPrimary ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => setAccountType('supervisor')}
              >
                مشرف
              </button>
              <button
                type="button"
                disabled={isEditingPrimary}
                className={`choice flex-1 ${accountType === 'finance' ? 'is-active' : ''} ${isEditingPrimary ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => setAccountType('finance')}
              >
                مالية
              </button>
              <button
                type="button"
                disabled={isEditingPrimary}
                className={`choice flex-1 ${accountType === 'admin' ? 'is-active' : ''} ${isEditingPrimary ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  { key: 'general_supervisor', label: 'مشرف عام' },
                  { key: 'media_supervisor', label: 'مشرف الإعلامية' },
                  { key: 'scientific_supervisor', label: 'مشرف العلمية' },
                  { key: 'sports_supervisor', label: 'مشرف الرياضية' },
                  { key: 'stage_supervisor', label: 'مشرف مرحلة' }
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

          {accountType === 'supervisor' && selectedRoles.includes('stage_supervisor') && (
            <div>
              <label className="label font-semibold text-brand-600">المرحلة المسؤول عنها (إجباري لمشرف المرحلة) <span className="text-red-500">*</span></label>
              <p className="text-xs text-ink-500 mb-2">يحصل مشرف المرحلة على وصول لكل أسر/مجموعات هذه المرحلة تلقائياً.</p>
              <div className="flex flex-wrap gap-2">
                {stages.map((st) => (
                  <button
                    type="button"
                    key={st.key}
                    onClick={() => setStage(st.key)}
                    className={`choice py-1.5 px-4 text-xs ${stage === st.key ? 'is-active' : ''}`}
                  >
                    {st.label}
                  </button>
                ))}
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

          {accountType === 'supervisor' && (
            <div className="pt-3 border-t border-ink-100">
              <label className="label font-semibold text-ink-900">صلاحيات مخصصة واستثنائية</label>
              <p className="text-xs text-ink-500 mb-3">حدد الصفحات الإضافية التي ترغب بمنحها لهذا المشرف بشكل استثنائي، والتي قد لا تكون متاحة في دوره الافتراضي.</p>
              <div className="flex flex-wrap gap-2">
                {MODULES.map((m) => {
                  let isRoleGranted = false;
                  selectedRoles.forEach(r => {
                    if (rolePermissionsMap[r]?.includes(m.id)) {
                      isRoleGranted = true;
                    }
                  });
                  const isCustomGranted = customPermissions.includes(m.id);
                  const isActive = isRoleGranted || isCustomGranted;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (isRoleGranted) return; // Already granted by role
                        setCustomPermissions(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])
                      }}
                      className={`choice py-1.5 px-3 text-xs ${isActive ? 'is-active bg-brand hover:bg-brand-600 text-white border-brand' : ''} ${isRoleGranted ? 'opacity-80 cursor-default' : ''}`}
                      title={isRoleGranted ? 'ممنوحة مسبقاً من خلال الدور الوظيفي' : 'تخصيص بشكل استثنائي'}
                    >
                      {m.label} {isRoleGranted && (
                        <svg className="w-3 h-3 inline-block mr-1 text-white/90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary flex-1">{busy ? '...' : editingId ? 'حفظ التعديلات' : 'إضافة المشرف'}</button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="btn btn-secondary">إلغاء</button>
            )}
          </div>
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
                            <span className={`pill ${s.role === 'admin' ? 'pill-blue' : s.role === 'finance' ? 'pill-green' : 'pill-gray'}`}>
                              {getRoleLabel(s.role)}
                            </span>
                          </td>
                          <td className="text-ink-500 text-sm">{s.role === 'admin' ? 'الكل' : groupNames(s.groupIds) || '—'}</td>
                          <td>
                            <div className="flex items-center gap-1.5 justify-end">
                              <button onClick={() => startEdit(s)} className="btn btn-secondary py-1 px-3 text-xs">تعديل</button>
                              {!primary && (
                                <button onClick={() => del(s)} className="btn btn-danger py-1 px-3 text-xs">حذف</button>
                              )}
                            </div>
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
                          <span className={`pill shrink-0 ${s.role === 'admin' ? 'pill-blue' : s.role === 'finance' ? 'pill-green' : 'pill-gray'}`}>
                            {getRoleLabel(s.role)}
                          </span>
                        </div>
                        <div dir="ltr" className="text-xs text-ink-400 mt-0.5 text-right truncate">{s.email}</div>
                        <div className="text-xs text-ink-500 mt-0.5">
                          المجموعات: {s.role === 'admin' ? 'الكل' : groupNames(s.groupIds) || '—'}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 items-end">
                        <button onClick={() => startEdit(s)} className="btn btn-secondary py-1 px-3 text-xs">تعديل</button>
                        {!primary && (
                          <button onClick={() => del(s)} className="btn btn-danger py-1 px-3 text-xs">حذف</button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
