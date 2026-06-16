'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SupervisorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/supervisor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      router.push('/supervisor');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream-50 px-6 py-12 relative overflow-hidden">
      {/* Background gradients matching Nibras visual identity */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(40rem 24rem at 50% 10%, rgba(245,166,35,0.08), transparent 60%), radial-gradient(30rem 20rem at 10% 80%, rgba(43,175,217,0.06), transparent 60%)'
        }}
      />

      <div className="relative w-full max-w-md card p-8 sm:p-10 bg-white">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white mb-4 shadow-brand font-display text-2xl">
            ن
          </div>
          <h1 className="font-display text-3xl text-ink-900">بوابة المشرفين</h1>
          <p className="text-sm text-ink-500 mt-2">نادي نبراس الصيفي — لوحة الإدارة والتحضير</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body text-center leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label block mb-2" htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="example@nibras.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full ltr text-left"
              disabled={loading}
            />
          </div>

          <div>
            <label className="label block mb-2" htmlFor="password">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full ltr text-left"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full mt-6"
            disabled={loading}
          >
            {loading ? 'جاري التحقق…' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </main>
  );
}
