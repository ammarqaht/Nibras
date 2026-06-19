'use client';

import { useEffect, useState } from 'react';
import Brand from '@/components/Brand';
import SocialIcon from '@/components/SocialIcon';
import { footer as origFooter } from '@/content';

/** Shared footer across all pages — association contact / social channels. */
export default function Footer({
  tagline,
  social: initialSocial
}: {
  tagline?: string;
  social?: Array<{ key: string; label: string; href: string }>;
}) {
  const [social, setSocial] = useState(initialSocial || origFooter.social);
  const [customTagline, setCustomTagline] = useState(tagline);

  useEffect(() => {
    if (initialSocial) {
      setSocial(initialSocial);
      return;
    }

    // Fetch public settings client-side for pages where it is not pre-rendered
    fetch('/api/supervisor/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          const custom = data.settings;
          const mergedSocial = origFooter.social.map((s) => ({
            ...s,
            href: custom[`social_${s.key}`] || s.href
          }));
          setSocial(mergedSocial);
          if (!tagline && custom.landingTagline) {
            setCustomTagline(custom.landingTagline);
          }
        }
      })
      .catch(() => {});
  }, [tagline, initialSocial]);

  return (
    <footer
      className="mt-24 border-t border-blue-900/50 text-white relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 80% 10%, rgba(255,159,28,0.15) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(18,179,213,0.2) 0%, transparent 60%), linear-gradient(135deg, #103F91 0%, #071F4A 100%)'
      }}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-12 relative z-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-right">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Brand variant="lockup" imgClassName="h-11 w-auto brightness-0 invert" />
              <div className="hidden sm:block h-6 w-[1px] bg-white/20 self-center" />
              <img
                src="/wathbah-white.png"
                alt="جمعية وثبة"
                className="h-9 w-auto opacity-80 transition-opacity hover:opacity-100 select-none"
              />
            </div>
            <p className="mt-4 font-display text-blue-100/80 tracking-wide text-sm">{customTagline || origFooter.tagline}</p>
          </div>

          <div className="flex items-center gap-3">
            {social.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                className="w-11 h-11 rounded-full border border-white/20 bg-white/10 text-white flex items-center justify-center transition-all duration-200 hover:text-blue-900 hover:bg-white hover:border-transparent hover:-translate-y-0.5 hover:shadow-lg"
              >
                <SocialIcon name={s.key} />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-blue-200/70">
          <span>{origFooter.rights}</span>
          <div className="flex items-center gap-2.5">
            <span className="font-display tracking-wide text-blue-200/50">صُمم بعناية بواسطة</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/ammar-logo.png"
              alt="عمار سالم — Ammar Salem"
              className="h-14 w-auto opacity-75 brightness-0 invert transition-opacity duration-200 hover:opacity-100 select-none pointer-events-none"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
