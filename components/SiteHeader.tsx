'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Brand from '@/components/Brand';
import { landing } from '@/content';

/** Sticky header that turns solid on scroll — same pattern as the Medad landing nav. */
export default function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: solid ? 'rgba(250,250,247,0.85)' : 'transparent',
        backdropFilter: solid ? 'saturate(180%) blur(12px)' : 'none',
        borderBottom: solid ? '1px solid var(--line)' : '1px solid transparent'
      }}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-4 flex items-center justify-between">
        <Brand href="/" variant="lockup" imgClassName="h-10 sm:h-11 w-auto" />
        {showCta && (
          <Link href="/register" className="btn btn-primary">
            {landing.ctaPrimary}
          </Link>
        )}
      </div>
    </header>
  );
}
