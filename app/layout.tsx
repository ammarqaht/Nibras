import type { Metadata, Viewport } from 'next';
import './globals.css';
import { site } from '@/content';

export const metadata: Metadata = {
  title: site.metaTitle,
  description: site.metaDescription
};

export const viewport: Viewport = {
  themeColor: '#FAFAF7',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preload" href="/fonts/title/Nibrasfont.otf" as="font" type="font/otf" crossOrigin="" />
        <link rel="preload" href="/fonts/body/thmanyahsans-Light.otf" as="font" type="font/otf" crossOrigin="" />
        <noscript>
          {/* eslint-disable-next-line react/no-danger */}
          <style>{`.reveal,.reveal-hero,.reveal[data-stagger] > *{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
