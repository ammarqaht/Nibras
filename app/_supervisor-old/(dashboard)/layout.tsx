import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import Link from 'next/link';
import LogoutButton from './LogoutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  const session = token ? verifyToken(token) : null;

  if (!session) {
    redirect('/supervisor/login');
  }

  const navItems = [
    { label: 'الرئيسية', href: '/supervisor', icon: '🏠' },
    { label: 'إدارة الطلاب', href: '/supervisor/students', icon: '👥' },
    { label: 'التحضير اليومي', href: '/supervisor/attendance', icon: '📝' },
    { label: 'لوحة النقاط', href: '/supervisor/points', icon: '🏆' },
    { label: 'المدفوعات', href: '/supervisor/payments', icon: '💰' },
    { label: 'الفواتير', href: '/supervisor/invoices', icon: '🧾' },
    { label: 'الحالات الصحية', href: '/supervisor/health', icon: '🚨' },
    { label: 'خريطة المواقع', href: '/supervisor/locations', icon: '📍' },
    { label: 'المجموعات', href: '/supervisor/groups', icon: '🛡️' },
    { label: 'الإعلانات والرسائل', href: '/supervisor/announcements', icon: '📢' },
  ];

  // Admin-only nav items
  if (session.role === 'admin') {
    navItems.push({ label: 'إدارة المشرفين', href: '/supervisor/supervisors', icon: '👤' });
    navItems.push({ label: 'إدارة المحتوى', href: '/supervisor/settings', icon: '⚙️' });
  }

  return (
    <div className="supervisor-body min-h-screen bg-cream-50 flex flex-col md:flex-row-reverse" dir="rtl">
      {/* Sidebar Nav */}
      <aside className="w-full md:w-64 bg-white border-l border-ink-200/60 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-ink-200/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logos/nibras-icon.png"
              alt="شعار النادي"
              className="w-10 h-10 object-contain"
            />
            <div>
              <div className="font-display text-lg text-ink-900 leading-tight">لوحة نبراس</div>
              <div className="text-xs text-ink-400 mt-0.5">مشرفي النادي الصيفي</div>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 my-3 rounded-2xl bg-cream-50/60 border border-ink-200/40 flex items-center justify-between">
          <div className="truncate pl-2">
            <div className="font-body text-sm font-semibold text-ink-900 truncate">{session.name}</div>
            <div className="text-xs text-ink-500 mt-0.5">
              {session.role === 'admin' ? 'مدير عام' : 'مشرف مجموعة'}
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${session.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
            {session.role === 'admin' ? 'Admin' : 'Staff'}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-ink-700 font-body text-sm transition-all duration-200 hover:bg-cream-100/50 hover:text-ink-900 group"
            >
              <span className="text-lg opacity-80 group-hover:scale-110 transition-transform duration-200">
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className="p-4 border-t border-ink-200/60">
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-full">
        {children}
      </main>
    </div>
  );
}
