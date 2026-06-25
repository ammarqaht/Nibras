import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تسجيل الحضور — نادي نبراس',
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="supervisor-body" style={{ minHeight: '100dvh', background: '#FAFAF7' }}>
      {children}
    </div>
  );
}
