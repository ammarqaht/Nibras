'use client';

import { useEffect, useState } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

export default function AccountPage() {
  const { user } = useSupervisor();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.email) setUsername(user.email);
  }, [user?.email]);

  if (user && user.role === 'admin') {
    return <div className="card p-10 text-center text-ink-500">حسابات المدير العام تُدار من صفحة المشرفين.</div>;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const newUsername = username.trim().toLowerCase();
    if (!newUsername) return pushToast('error', 'اسم المستخدم لا يمكن أن يكون فارغاً');
    if (/\s/.test(newUsername)) return pushToast('error', 'اسم المستخدم لا يحتوي على مسافات');
    if (password && password !== confirm) return pushToast('error', 'كلمتا المرور غير متطابقتين');
    if (password && password.length < 4) return pushToast('error', 'كلمة المرور قصيرة جداً (4 خانات على الأقل)');

    const usernameChanged = newUsername !== (user?.email ?? '');
    if (!usernameChanged && !password) return pushToast('info', 'لا يوجد تغيير لحفظه');

    const payload: { username?: string; password?: string } = {};
    if (usernameChanged) payload.username = newUsername;
    if (password) payload.password = password;

    setBusy(true);
    const r = await fetch('/api/supervisor/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return pushToast('error', j.error ?? 'تعذّر حفظ التغييرات');

    pushToast('success', 'تم حفظ بيانات حسابك بنجاح');
    setPassword('');
    setConfirm('');
    // A username change re-issues the session cookie; reload so the header reflects it.
    if (usernameChanged) setTimeout(() => window.location.reload(), 900);
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 mb-1">حسابي</h1>
        <p className="text-sm text-ink-500">عدّل اسم المستخدم وكلمة المرور الخاصة بك. تُحفظ التغييرات مباشرة.</p>
      </div>

      <form onSubmit={save} className="card p-6 space-y-4">
        <div>
          <label className="label">اسم المستخدم (للدخول)</label>
          <input
            className="field"
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
          />
          <p className="text-xs text-ink-400 mt-1">يُستخدم لتسجيل الدخول. يجب أن يكون فريداً (غير مكرر مع مشرف آخر).</p>
        </div>

        <div className="pt-2 border-t border-ink-100">
          <label className="label">كلمة المرور الجديدة</label>
          <input
            className="field"
            dir="ltr"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="اتركها فارغة للإبقاء على الحالية"
          />
        </div>

        <div>
          <label className="label">تأكيد كلمة المرور</label>
          <input
            className="field"
            dir="ltr"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="أعد كتابة كلمة المرور الجديدة"
          />
        </div>

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
        </button>
      </form>
    </div>
  );
}
