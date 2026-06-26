'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { site } from '@/content';

export default function StudentLogin() {
  const router = useRouter();
  const [membershipNo, setMembershipNo] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/student/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipNo: Number(membershipNo), nationalId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error ?? 'فشل تسجيل الدخول');
        setBusy(false);
        return;
      }
      router.replace('/student');
    } catch {
      setErr('تعذّر الاتصال بالخادم');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative" style={{ background: 'var(--bg)' }}>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(50rem 30rem at 50% 25%, rgba(245,166,35,0.08), transparent 60%), radial-gradient(40rem 28rem at 80% 80%, rgba(43,175,217,0.06), transparent 60%)',
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
          <p className="mt-4 text-sm" style={{ color: 'var(--ink-soft)' }}>بوابة الطلاب</p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--ink)' }}>تسجيل الدخول</h1>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>أدخل رقم عضويتك ورقم هويتك للمتابعة.</p>
          </div>

          <div>
            <label className="label">رقم العضوية</label>
            <input
              className="field"
              type="number"
              inputMode="numeric"
              value={membershipNo}
              onChange={e => setMembershipNo(e.target.value)}
              autoComplete="username"
              placeholder="مثال: 1001"
              required
            />
          </div>
          <div>
            <label className="label">رقم الهوية</label>
            <input
              className="field"
              type="password"
              inputMode="numeric"
              value={nationalId}
              onChange={e => setNationalId(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••••"
              required
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
            {busy ? 'جارٍ التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
