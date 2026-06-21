'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import Brand from './Brand';
import ToastHost from './Toast';

export type SupervisorUser = { id: number; email: string; name: string; role: string };

const SupervisorContext = createContext<{ user: SupervisorUser | null }>({ user: null });
export const useSupervisor = () => useContext(SupervisorContext);

type NavLink = { href: string; label: string; adminOnly?: boolean; financeOnly?: boolean };

const LINKS: NavLink[] = [
  { href: '/supervisor', label: 'الرئيسية' },
  { href: '/supervisor/students', label: 'الطلاب' },
  { href: '/supervisor/attendance', label: 'الحضور' },
  { href: '/supervisor/points', label: 'النقاط' },
  { href: '/supervisor/groups', label: 'المجموعات' },
  { href: '/supervisor/payments', label: 'المدفوعات' },
  { href: '/supervisor/invoices', label: 'الفواتير' },
  { href: '/supervisor/finance', label: 'المالية', financeOnly: true },
  { href: '/supervisor/announcements', label: 'الإشعارات' },
  { href: '/supervisor/supervisors', label: 'المشرفون', adminOnly: true },
  { href: '/supervisor/settings', label: 'الإعدادات', adminOnly: true }
];

export default function SupervisorShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'authed'>('loading');
  const [user, setUser] = useState<SupervisorUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/supervisor/auth/me', { cache: 'no-store' });
        if (r.status === 401) {
          router.replace('/supervisor/login');
          return;
        }
        const j = await r.json();
        if (cancelled) return;
        setUser(j.user);
        setStatus('authed');
      } catch {
        router.replace('/supervisor/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // close the mobile menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  async function logout() {
    await fetch('/api/supervisor/auth/logout', { method: 'POST' });
    router.replace('/supervisor/login');
  }

  // Idle timeout auto-logout (5 minutes of inactivity)
  useEffect(() => {
    if (status !== 'authed') return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, 5 * 60 * 1000); // 5 minutes
    };

    // Events that count as active interaction
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Initialize timer
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [status]);

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

  const links = LINKS.filter(
    (l) =>
      (!l.adminOnly || user?.role === 'admin') &&
      (!l.financeOnly || user?.role === 'admin' || user?.role === 'finance')
  );
  const isActive = (href: string) => (href === '/supervisor' ? path === href : path.startsWith(href));

  return (
    <SupervisorContext.Provider value={{ user }}>
      <ToastHost />
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-soft)' }}>
        <header className="bg-white border-b border-ink-200 sticky top-0 z-40">
          <div className="px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
            {/* right (RTL): hamburger on mobile, logo */}
            <div className="flex items-center gap-3 lg:gap-8 min-w-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="القائمة"
                aria-expanded={menuOpen}
                className="lg:hidden w-10 h-10 -ms-1 inline-flex items-center justify-center rounded-lg text-ink-700 hover:bg-cream-100"
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
              <Brand href="/supervisor" variant="lockup" imgClassName="h-9 w-auto" />
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

            {/* left (RTL): user + logout */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-semibold text-ink-900">{user?.name}</span>
                <span className="text-[0.7rem] text-ink-400">
                  {user?.role === 'admin' ? 'مدير عام' : 'مشرف'}
                </span>
              </span>
              <button onClick={logout} className="!hidden lg:!inline-flex btn btn-ghost text-sm">
                خروج
              </button>
            </div>
          </div>

          {/* mobile dropdown menu */}
          {menuOpen && (
            <div className="lg:hidden border-t border-ink-200 bg-white fade-in">
              <div className="px-3 py-3 flex flex-col gap-1 max-w-7xl mx-auto">
                <div className="px-3 pb-2 mb-1 border-b border-ink-100">
                  <div className="text-sm font-semibold text-ink-900">{user?.name}</div>
                  <div className="text-xs text-ink-400">{user?.role === 'admin' ? 'مدير عام' : 'مشرف'}</div>
                </div>
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2.5 rounded-lg text-[0.95rem] ${
                      isActive(l.href) ? 'bg-brand/10 text-brand-600 font-semibold' : 'text-ink-700 hover:bg-cream-100'
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
                <button
                  onClick={logout}
                  className="mt-1 px-3 py-2.5 rounded-lg text-[0.95rem] text-right text-nred-600 hover:bg-nred-50"
                >
                  تسجيل الخروج
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-7 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </SupervisorContext.Provider>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
