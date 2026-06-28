'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { site } from '@/content';
import { StudentContext, type StudentUser } from './context';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const NAV = [
  { href: '/student', label: 'الرئيسية', icon: HomeIcon },
  { href: '/student/tasks', label: 'المهام', icon: TaskIcon },
  { href: '/student/family', label: 'الأسرة', icon: GroupIcon },
  { href: '/student/leaderboard', label: 'الترتيب', icon: LeaderIcon },
  { href: '/student/announcements', label: 'الإعلانات', icon: BellIcon },
];

export default function StudentAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/me')
      .then(r => {
        if (r.status === 401) { router.replace('/student/login'); return null; }
        if (!r.ok) throw new Error('Failed to fetch user session');
        return r.json();
      })
      .then(d => { if (d) setUser(d); })
      .catch(err => { console.error('Error loading session:', err); })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = useCallback(async () => {
    try { await fetch('/api/student/auth', { method: 'DELETE' }); } catch {}
    router.replace('/student/login');
  }, [router]);

  // Auto-logout after IDLE_TIMEOUT_MS of no interaction. Resets on any user
  // gesture (pointer / key / touch / scroll) and when the tab regains focus.
  const idleTimer = useRef<number | null>(null);
  useEffect(() => {
    if (loading || !user) return;

    const resetTimer = () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => { void logout(); }, IDLE_TIMEOUT_MS);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') resetTimer(); };

    const EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    EVENTS.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);

    resetTimer();

    return () => {
      EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', onVisibility);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, [loading, user, logout]);

  if (loading) {
    return (
      <div className="student-body min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={site.logos.lockupVertical} alt="" className="h-24 w-auto mx-auto select-none animate-pulse" draggable={false} />
          <div className="skeleton mx-auto" style={{ width: 160, height: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <StudentContext.Provider value={{ user }}>
      <div className="student-body min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        {/* Desktop header */}
        <header
          className="hidden md:block sticky top-0 z-30"
          style={{
            background: 'rgba(250,250,247,0.85)',
            backdropFilter: 'saturate(180%) blur(14px)',
            WebkitBackdropFilter: 'saturate(180%) blur(14px)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
            <Link href="/student" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.logos.lockupHorizontal} alt={site.clubNameAr} className="h-8 w-auto select-none" draggable={false} />
            </Link>

            <nav className="flex items-center gap-1">
              {NAV.map(item => {
                const active = item.href === '/student' ? pathname === '/student' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      color: active ? 'var(--accent-deep)' : 'var(--ink-soft)',
                      background: active ? 'rgba(255,159,28,0.10)' : 'transparent',
                    }}
                  >
                    <Icon active={active} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold leading-none" style={{ color: 'var(--ink)' }}>{user.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{user.stage} · {user.grade}</p>
                </div>
                <button onClick={logout} className="btn btn-ghost px-2 py-1" title="خروج" aria-label="تسجيل الخروج">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile top bar */}
        <header
          className="md:hidden sticky top-0 z-30"
          style={{
            background: 'rgba(250,250,247,0.85)',
            backdropFilter: 'saturate(180%) blur(12px)',
            WebkitBackdropFilter: 'saturate(180%) blur(12px)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div className="flex items-center justify-between px-4 h-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logos.lockupHorizontal} alt={site.clubNameAr} className="h-7 w-auto select-none" draggable={false} />
            {user && (
              <button onClick={logout} className="btn btn-ghost text-xs px-2 py-1" title="خروج" aria-label="تسجيل الخروج">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 pb-28 md:pb-12">
          {children}
        </main>

        {/* Mobile bottom navigation — frosted, premium */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 student-bottom-nav"
          aria-label="التنقّل"
        >
          <div className="flex items-stretch h-16">
            {NAV.map(item => {
              const active = item.href === '/student' ? pathname === '/student' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors"
                  style={{ color: active ? 'var(--accent-deep)' : 'var(--ink-soft)' }}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute top-0 h-0.5 rounded-full"
                      style={{ background: 'var(--accent-deep)', width: 28 }}
                    />
                  )}
                  <Icon active={active} />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </StudentContext.Provider>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9" stroke={active ? '#fff' : 'currentColor'} strokeWidth={1.5} fill="none"/>
    </svg>
  );
}
function TaskIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <rect x="3" y="3" width="18" height="18" rx="4"/>
      <path d="M8 9h8M8 13h8M8 17h5" stroke={active ? '#fff' : 'currentColor'} strokeWidth={1.5} strokeLinecap="round"/>
    </svg>
  );
}
function LeaderIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path d="M6 9V4h12v5a6 6 0 0 1-12 0z"/>
      <path d="M4 4h2v3a2 2 0 0 1-2 2H3V5a1 1 0 0 1 1-1zM20 4h-2v3a2 2 0 0 0 2 2h1V5a1 1 0 0 0-1-1z" />
      <path d="M9 21h6M12 16v5" stroke={active ? '#fff' : 'currentColor'} strokeWidth={1.6} strokeLinecap="round"/>
    </svg>
  );
}
function GroupIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <circle cx="9" cy="8" r="3.5"/>
      <path d="M2 20v-1a6 6 0 0 1 12 0v1"/>
      <circle cx="17" cy="9" r="2.5"/>
      <path d="M15 20v-1a5 5 0 0 1 7-4.6" />
    </svg>
  );
}
function BellIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/>
      <path d="M10 19a2 2 0 0 0 4 0" stroke={active ? '#fff' : 'currentColor'} strokeWidth={1.6} fill="none"/>
    </svg>
  );
}
