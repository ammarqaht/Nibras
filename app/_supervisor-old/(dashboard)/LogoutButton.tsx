'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/supervisor/auth/logout', { method: 'POST' });
      router.push('/supervisor/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-ink-200 text-ink-600 font-body text-sm hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all duration-200"
    >
      <span>🚪</span>
      <span>{loading ? 'جاري الخروج…' : 'تسجيل الخروج'}</span>
    </button>
  );
}
