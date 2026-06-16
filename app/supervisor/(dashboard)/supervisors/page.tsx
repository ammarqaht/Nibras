'use client';

import { useState, useEffect } from 'react';

type Supervisor = {
  id: number;
  name: string;
  email: string;
  role: string;
  groupIds: string;
  createdAt: string;
};

const roleMapAr: Record<string, string> = {
  admin: 'مدير عام',
  attendance_supervisor: 'مشرف تحضير',
  social_supervisor: 'مشرف اجتماعية',
  cultural_supervisor: 'مشرف ثقافية',
  groups_supervisor: 'مشرف أسر',
  general_supervisor: 'مشرف عام'
};

export default function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('general_supervisor');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSupervisors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supervisor/supervisors');
      if (res.status === 401) {
        setAuthorized(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setSupervisors(data.supervisors || []);
      } else {
        setAuthorized(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const handleAddSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim() || !addRole) {
      setErrorMsg('يرجى تعبئة جميع الحقول الإلزامية');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/supervisor/supervisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          password: addPassword,
          role: addRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSupervisors(prev => [...prev, data.supervisor]);
        setShowAddModal(false);
        // Reset states
        setAddName('');
        setAddEmail('');
        setAddPassword('');
        setAddRole('general_supervisor');
      } else {
        setErrorMsg(data.error || 'فشل إضافة المشرف');
      }
    } catch (err) {
      setErrorMsg('حدث خطأ في الشبكة، يرجى المحاولة لاحقاً');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSupervisor = async (id: number, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المشرف (${name})؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

    try {
      const res = await fetch(`/api/supervisor/supervisors?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setSupervisors(prev => prev.filter(s => s.id !== id));
      } else {
        alert(data.error || 'فشل حذف المشرف');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في الشبكة');
    }
  };

  if (!authorized) {
    return (
      <div className="card p-8 bg-red-50 border border-red-200 text-center max-w-xl mx-auto mt-12 font-body">
        <span className="text-4xl">⚠️</span>
        <h2 className="font-display text-xl text-red-800 mt-3 mb-2">غير مصرح بالدخول</h2>
        <p className="text-red-600 text-sm">عذراً، هذه الصفحة مخصصة فقط للمدير العام (admin).</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink-900">إدارة المشرفين</h1>
          <p className="text-ink-500 mt-2">إضافة المشرفين الجدد لنادي نبراس الصيفي وتوزيع الأدوار والصلاحيات عليهم.</p>
        </div>
        <div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            ➕ إضافة مشرف جديد
          </button>
        </div>
      </div>

      {/* Supervisors Table Card */}
      <div className="card bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-ink-500 font-body">جاري تحميل المشرفين…</div>
        ) : supervisors.length === 0 ? (
          <div className="py-20 text-center text-ink-400 font-body">لا يوجد مشرفين مضافين حالياً.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-cream-50/70 border-b border-ink-200/60 text-ink-500 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4 pr-6">الاسم</th>
                  <th className="p-4">اسم المستخدم / البريد</th>
                  <th className="p-4">الدور الصلاحية</th>
                  <th className="p-4">تاريخ الإضافة</th>
                  <th className="p-4 pl-6 text-left">التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {supervisors.map(sup => (
                  <tr key={sup.id} className="hover:bg-cream-50/40 transition-colors">
                    <td className="p-4 pr-6 font-semibold text-ink-900">{sup.name}</td>
                    <td className="p-4 text-ink-600 ltr text-right">{sup.email}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sup.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-cream-200/60 text-ink-700'}`}>
                        {roleMapAr[sup.role] || sup.role}
                      </span>
                    </td>
                    <td className="p-4 text-ink-400">
                      {new Date(sup.createdAt).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="p-4 pl-6 text-left">
                      {sup.email !== 'admin' && sup.email !== 'admin@nibras.com' ? (
                        <button
                          onClick={() => handleDeleteSupervisor(sup.id, sup.name)}
                          className="btn btn-danger btn-sm py-1 px-2.5"
                        >
                          🗑️ حذف
                        </button>
                      ) : (
                        <span className="text-xs text-ink-300 font-medium">حساب أساسي</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Supervisor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl w-full max-w-md card shadow-xl p-6 sm:p-8 relative">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-ink-100 pb-4 mb-6">
              <div>
                <h2 className="font-display text-2xl text-ink-900">إضافة مشرف جديد</h2>
                <p className="text-xs text-ink-400 mt-1">تعبئة بيانات الاعتماد واختيار صلاحية المشرف.</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-cream-50 hover:bg-cream-100 text-ink-600 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSupervisor} className="space-y-4">
              {/* Name */}
              <div>
                <label className="label mb-1 block">الاسم الكامل للمشرف</label>
                <input 
                  type="text" 
                  required
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  className="input w-full"
                  placeholder="أحمد علي الغامدي"
                  disabled={submitting}
                />
              </div>

              {/* Email / Username */}
              <div>
                <label className="label mb-1 block">اسم المستخدم أو البريد الإلكتروني</label>
                <input 
                  type="text" 
                  required
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  className="input w-full ltr text-left"
                  placeholder="ahmed"
                  disabled={submitting}
                />
              </div>

              {/* Password */}
              <div>
                <label className="label mb-1 block">كلمة المرور</label>
                <input 
                  type="password" 
                  required
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  className="input w-full ltr text-left"
                  placeholder="••••••••"
                  disabled={submitting}
                />
              </div>

              {/* Role Selector */}
              <div>
                <label className="label mb-1 block">الدور الوظيفي / الصلاحية</label>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value)}
                  className="input w-full font-semibold"
                  disabled={submitting}
                >
                  <option value="admin">مدير عام</option>
                  <option value="attendance_supervisor">مشرف تحضير</option>
                  <option value="social_supervisor">مشرف اجتماعية</option>
                  <option value="cultural_supervisor">مشرف ثقافية</option>
                  <option value="groups_supervisor">مشرف أسر</option>
                  <option value="general_supervisor">مشرف عام</option>
                </select>
              </div>

              {/* Modal Footer */}
              <div className="mt-8 pt-4 border-t border-ink-100 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'جاري الإضافة...' : '➕ إضافة المشرف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
