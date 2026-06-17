'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import Brand from './Brand';
import ToastHost from './Toast';

export type SupervisorUser = { id: number; email: string; name: string; role: string };

const SupervisorContext = createContext<{ user: SupervisorUser | null }>({ user: null });
export const useSupervisor = () => useContext(SupervisorContext);

type NavLink = { href: string; label: string; adminOnly?: boolean };

const LINKS: NavLink[] = [
  { href: '/supervisor2', label: 'الرئيسية' },
  { href: '/supervisor2/students', label: 'الطلاب' },
  { href: '/supervisor2/attendance', label: 'الحضور' },
  { href: '/supervisor2/points', label: 'النقاط' },
  { href: '/supervisor2/groups', label: 'المجموعات' },
  { href: '/supervisor2/payments', label: 'المدفوعات' },
  { href: '/supervisor2/announcements', label: 'الإشعارات' },
  { href: '/supervisor2/supervisors', label: 'المشرفون', adminOnly: true },
  { href: '/supervisor2/settings', label: 'الإعدادات', adminOnly: true }
];

export default function SupervisorShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'authed'>('loading');
  const [user, setUser] = useState<SupervisorUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/supervisor/auth/me', { cache: 'no-store' });
        if (r.status === 401) {
          router.replace('/supervisor2/login');
          return;
        }
        const j = await r.json();
        if (cancelled) return;
        setUser(j.user);
        setStatus('authed');
      } catch {
        router.replace('/supervisor2/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch('/api/supervisor/auth/logout', { method: 'POST' });
    router.replace('/supervisor2/login');
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <span
            className="w-8 h-8 rounded-full border-[3px] border-ink-200 animate-spin"
            style={{ borderTopColor: 'var(--accent)' }}
          />
          <span className="text-sm">جارٍ التحميل…</span>
        </div>
      </div>
    );
  }

  const links = LINKS.filter((l) => !l.adminOnly || user?.role === 'admin');
  const isActive = (href: string) => (href === '/supervisor2' ? path === href : path.startsWith(href));

  return (
    <SupervisorContext.Provider value={{ user }}>
      <ToastHost />
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-soft)' }}>
        <header className="bg-white border-b border-ink-200 sticky top-0 z-40">
          <div className="px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-8 min-w-0">
              <div className="flex items-center gap-2">
                <Brand href="/supervisor2" variant="lockup" imgClassName="h-9 w-auto" />
                <span
                  className="text-xs font-bold rounded-md px-1.5 py-0.5 leading-none"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                  title="نسخة المشرف ٢"
                >
                  ٢
                </span>
              </div>
              <nav className="hidden lg:flex items-center gap-1">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`px-3.5 py-2 rounded-lg text-sm transition-all ${
                      isActive(l.href)
                        ? 'bg-brand/10 text-brand-600 font-semibold'
                        : 'text-ink-500 hover:text-ink-900 hover:bg-cream-100'
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-semibold text-ink-900">{user?.name}</span>
                <span className="text-[0.7rem] text-ink-400">
                  {user?.role === 'admin' ? 'مدير عام' : 'مشرف'}
                </span>
              </span>
              <button onClick={logout} className="btn btn-ghost text-sm">
                خروج
              </button>
            </div>
          </div>

          {/* Mobile / tablet nav */}
          <nav className="lg:hidden px-3 py-2 border-t border-ink-200 flex gap-2 overflow-x-auto scroll-soft">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 px-3 py-1.5 rounded-md text-sm ${
                  isActive(l.href) ? 'bg-brand/10 text-brand-600 font-semibold' : 'text-ink-500'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-4 md:px-8 py-7 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </SupervisorContext.Provider>
  );
}
