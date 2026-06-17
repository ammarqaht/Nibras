import SupervisorShell from '@/components/SupervisorShell';

export const metadata = {
  title: 'لوحة المشرفين — نادي نبراس'
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="supervisor-body">
      <SupervisorShell>{children}</SupervisorShell>
    </div>
  );
}
