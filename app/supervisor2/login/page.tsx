'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { site } from '@/content';

export default function SupervisorLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/supervisor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error ?? 'فشل تسجيل الدخول');
        setBusy(false);
        return;
      }
      router.replace('/supervisor2');
    } catch {
      setErr('تعذّر الاتصال بالخادم');
      setBusy(false);
    }
  }

  return (
    <div className="supervisor-body min-h-screen flex items-center justify-center px-6 py-12 relative">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(50rem 30rem at 50% 25%, rgba(245,166,35,0.08), transparent 60%), radial-gradient(40rem 28rem at 80% 80%, rgba(43,175,217,0.06), transparent 60%)'
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={site.logos.lockupVertical}
            alt={site.clubNameAr}
            className="mx-auto h-28 w-auto select-none"
            draggable={false}
          />
          <p className="mt-4 text-ink-500 text-sm">لوحة تحكم المشرفين</p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-ink-900 mb-1">تسجيل الدخول</h1>
            <p className="text-sm text-ink-500">أدخل بيانات حسابك للمتابعة.</p>
          </div>

          <div>
            <label className="label">البريد الإلكتروني / اسم المستخدم</label>
            <input
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••"
            />
          </div>

          {err && (
            <div
              className="text-sm rounded-md p-3 border"
              style={{ color: 'var(--red)', background: '#FDEAE6', borderColor: 'rgba(251,59,30,0.25)' }}
            >
              {err}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
            {busy ? '...' : 'دخول'}
          </button>

          <p className="text-xs text-ink-400 text-center pt-3 border-t border-ink-200">
            الدخول الافتراضي للمدير: <span dir="ltr">admin / 12345</span>
          </p>
        </form>
      </div>
    </div>
  );
}
