'use client';

import { useState, useEffect } from 'react';
import { pushToast } from '@/components/Toast';

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
  { id: 'announcements', label: 'الإشعارات' },
  { id: 'analytics', label: 'الإحصائيات' }
];

const ROLES = [
  { id: 'attendance_supervisor', label: 'مشرف تحضير' },
  { id: 'social_supervisor', label: 'مشرف اجتماعية' },
  { id: 'cultural_supervisor', label: 'مشرف ثقافية' },
  { id: 'groups_supervisor', label: 'مشرف أسر' },
  { id: 'general_supervisor', label: 'مشرف عام' },
  { id: 'media_supervisor', label: 'مشرف الإعلامية' },
  { id: 'scientific_supervisor', label: 'مشرف العلمية' },
  { id: 'sports_supervisor', label: 'مشرف الرياضية' },
  { id: 'stage_supervisor', label: 'مشرف مرحلة' }
];

export default function RoleCustomizer() {
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/supervisor/role-permissions')
      .then(res => res.json())
      .then(data => {
        if (data.permissions) {
          setPermissions(data.permissions);
        }
        setLoading(false);
      });
  }, []);

  const togglePermission = (role: string, mod: string) => {
    setPermissions(prev => {
      const rolePerms = prev[role] || [];
      const newPerms = rolePerms.includes(mod)
        ? rolePerms.filter(p => p !== mod)
        : [...rolePerms, mod];
      return { ...prev, [role]: newPerms };
    });
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/supervisor/role-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permissions)
    });
    setSaving(false);
    if (res.ok) {
      pushToast('success', 'تم حفظ صلاحيات الأدوار بنجاح. سيتم تطبيقها فوراً.');
    } else {
      pushToast('error', 'فشل حفظ الصلاحيات');
    }
  };

  if (loading) return <div className="text-center py-10 text-ink-400">جارٍ التحميل...</div>;

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-ink-900">تخصيص الصلاحيات حسب الدور</h2>
          <p className="text-sm text-ink-500">اختر الخدمات والصفحات المسموحة لكل لجنة أو دور في النظام.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-primary px-6">
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="overflow-x-auto border border-ink-200 rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-ink-50 text-ink-600 font-semibold border-b border-ink-200">
            <tr>
              <th className="p-3 border-l border-ink-200">الخدمة / الصفحة</th>
              {ROLES.map(r => (
                <th key={r.id} className="p-3 border-l border-ink-200 text-center whitespace-nowrap">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 bg-white">
            {MODULES.map(m => (
              <tr key={m.id} className="hover:bg-cream-50 transition-colors">
                <td className="p-3 border-l border-ink-200 font-bold text-ink-900 whitespace-nowrap">
                  {m.label}
                </td>
                {ROLES.map(r => {
                  const hasPerm = (permissions[r.id] || []).includes(m.id);
                  return (
                    <td key={r.id} className="p-3 border-l border-ink-200 text-center text-center align-middle">
                      <label className="inline-flex items-center justify-center cursor-pointer w-full h-full">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-ink-300 text-brand focus:ring-brand cursor-pointer"
                          checked={hasPerm}
                          onChange={() => togglePermission(r.id, m.id)}
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
