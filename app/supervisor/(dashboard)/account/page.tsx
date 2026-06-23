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

  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (user?.email) setUsername(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!username.trim()) {
      setAvailable(null);
      return;
    }
    const val = username.trim().toLowerCase();
    if (user?.email && val === user.email.toLowerCase()) {
      setAvailable(true);
      return;
    }
    if (/\s/.test(val)) {
      setAvailable(false);
      return;
    }

    setChecking(true);
    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/supervisor/account?username=${encodeURIComponent(val)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.available !== undefined) {
            setAvailable(data.available);
          } else {
            setAvailable(false);
          }
        })
        .catch(() => setAvailable(false))
        .finally(() => setChecking(false));
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [username, user?.email]);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-gray-200', width: '0%' };
    
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    
    if (hasLetters && hasNumbers) score++;
    if (hasSpecial) score++;

    if (pass.length < 4) {
      return { score: 1, label: 'قصيرة جداً', color: 'bg-red-500', width: '15%' };
    }
    if (score <= 1) {
      return { score: 1, label: 'ضعيفة', color: 'bg-red-500', width: '25%' };
    } else if (score === 2) {
      return { score: 2, label: 'متوسطة', color: 'bg-amber-500', width: '50%' };
    } else if (score === 3) {
      return { score: 3, label: 'قوية', color: 'bg-blue-500', width: '75%' };
    } else {
      return { score: 4, label: 'قوية جداً', color: 'bg-green-500', width: '100%' };
    }
  };

  const strengthColorText = (score: number) => {
    if (score === 1) return '#EF4444';
    if (score === 2) return '#F59E0B';
    if (score === 3) return '#3B82F6';
    return '#10B981';
  };

  const strength = getPasswordStrength(password);

  if (user && user.role === 'admin') {
    return <div className="card p-10 text-center text-ink-500">حسابات المدير العام تُدار من صفحة المشرفين.</div>;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const newUsername = username.trim().toLowerCase();
    if (!newUsername) return pushToast('error', 'اسم المستخدم لا يمكن أن يكون فارغاً');
    if (/\s/.test(newUsername)) return pushToast('error', 'اسم المستخدم لا يحتوي على مسافات');
    if (available === false) return pushToast('error', 'اسم المستخدم غير متاح أو غير مناسب، اختر اسماً آخر');
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
          {checking && (
            <p className="text-xs text-ink-400 mt-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
              </svg>
              <span>جاري التحقق من توفر الاسم...</span>
            </p>
          )}
          {!checking && available === true && (
            <span className="text-green-600 flex items-center gap-1 text-xs mt-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>اسم المستخدم متاح ومناسب</span>
            </span>
          )}
          {!checking && available === false && (
            <span className="text-red-600 flex items-center gap-1 text-xs mt-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>اسم المستخدم غير متاح أو يحتوي على مسافات</span>
            </span>
          )}
        </div>

        <div className="pt-2 border-t border-ink-100">
          <label className="label">كلمة المرور الجديدة</label>
          <input
            className="field"
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="اتركها فارغة للإبقاء على الحالية"
          />
          {password && (
            <div className="mt-2.5 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-ink-500">قوة كلمة المرور:</span>
                <span style={{ color: strengthColorText(strength.score) }}>{strength.label}</span>
              </div>
              <div className="w-full bg-ink-150 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full ${strength.color} transition-all duration-300`} 
                  style={{ width: strength.width }} 
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="label">تأكيد كلمة المرور</label>
          <input
            className="field"
            dir="ltr"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="أعد كتابة كلمة المرور الجديدة"
          />
        </div>

        <button type="submit" disabled={busy || checking || available === false} className="btn btn-primary w-full">
          {busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
        </button>
      </form>
    </div>
  );
}
