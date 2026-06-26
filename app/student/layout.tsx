import type { Metadata } from 'next';
import { getMergedSettings } from '@/lib/services';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getMergedSettings();
  return {
    title: `${site.metaTitle} — بوابة الطلاب`,
    description: site.metaDescription,
  };
}

export default function StudentRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
