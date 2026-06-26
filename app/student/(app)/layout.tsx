'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { site } from '@/content';

type StudentUser = {
  id: number;
  membershipNo: number;
  name: string;
  stage: string;
  grade: string;
  groupId: number | null;
  balance: number;
  rankScore: number;
};

const StudentContext = createContext<{ user: StudentUser | null }>({ user: null });
export const useStudent = () => useContext(StudentContext);

const NAV = [
  { href: '/student', label: 'الرئيسية', icon: HomeIcon },
  { href: '/student/tasks', label: 'المهام', icon: TaskIcon },
  { href: '/student/leaderboard', label: 'الترتيب', icon: LeaderIcon },
  { href: '/student/group', label: 'الأسرة', icon: GroupIcon },
  { href: '/student/notifications', label: 'الإشعارات', icon: BellIcon },
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
        return r.json();
      })
      .then(d => { if (d) setUser(d); })
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch('/api/student/auth', { method: 'DELETE' });
    router.replace('/student/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={site.logos.icon} alt="" className="h-14 w-auto mx-auto animate-pulse" />
          <p style={{ color: 'var(--ink-soft)' }} className="text-sm">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <StudentContext.Provider value={{ user }}>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        {/* Top header */}
        <header className="card border-0 border-b sticky top-0 z-30" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between px-4 h-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logos.lockupHorizontal} alt={site.clubNameAr} className="h-7 w-auto select-none" draggable={false} />
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold leading-none" style={{ color: 'var(--ink)' }}>{user.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{user.stage} · {user.grade}</p>
                </div>
                <button onClick={logout} className="btn btn-ghost text-xs px-2 py-1" title="خروج">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 pb-24">
          {children}
        </main>

        {/* Bottom navigation */}
        <nav className="fixed bottom-0 inset-x-0 z-30 card border-0 border-t" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-stretch h-16">
            {NAV.map(item => {
              const active = item.href === '/student'
                ? pathname === '/student'
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
                  style={{ color: active ? 'var(--accent-deep)' : 'var(--ink-soft)' }}
                >
                  <Icon active={active} />
                  <span className="text-xs font-medium">{item.label}</span>
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
      <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth={1.5} fill="none"/>
    </svg>
  );
}
function TaskIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      {!active && <>
        <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth={1.5}/>
        <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth={1.5}/>
        <line x1="8" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth={1.5}/>
      </>}
      {active && <>
        <line x1="8" y1="9" x2="16" y2="9" stroke="white" strokeWidth={1.5}/>
        <line x1="8" y1="13" x2="16" y2="13" stroke="white" strokeWidth={1.5}/>
        <line x1="8" y1="17" x2="12" y2="17" stroke="white" strokeWidth={1.5}/>
      </>}
    </svg>
  );
}
function LeaderIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path d="M8 17H4a1 1 0 0 0-1 1v3h6v-3a1 1 0 0 0-1-1z"/>
      <path d="M14 12h-4a1 1 0 0 0-1 1v8h6v-8a1 1 0 0 0-1-1z"/>
      <path d="M20 7h-4a1 1 0 0 0-1 1v13h6V8a1 1 0 0 0-1-1z"/>
    </svg>
  );
}
function GroupIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <circle cx="9" cy="7" r="4"/>
      <path d="M1 21v-2a7 7 0 0 1 14 0v2"/>
      <path d="M17 11a4 4 0 0 1 0-8"/>
      <path d="M23 21v-2a7 7 0 0 0-5-6.7"/>
    </svg>
  );
}
function BellIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
