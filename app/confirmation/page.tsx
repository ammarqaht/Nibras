'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import { confirmation } from '@/content';

export default function ConfirmationPage() {
  const [membership, setMembership] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('m');
    const fromStore = (() => {
      try {
        return sessionStorage.getItem('nibras_membership');
      } catch {
        return null;
      }
    })();
    setMembership(fromUrl || fromStore);
    setReady(true);
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <SiteHeader showCta={false} />

      <section className="flex-1 px-6 py-12 sm:py-16 relative">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(50rem 30rem at 50% 10%, rgba(245,166,35,0.10), transparent 60%)'
          }}
        />
        <div className="relative mx-auto max-w-xl">
          {ready && !membership ? (
            <div className="card p-10 text-center">
              <p className="text-ink-600 mb-6">لم نجد رقم عضوية. يرجى إكمال التسجيل أولاً.</p>
              <Link href="/register" className="btn btn-primary">
                الذهاب للتسجيل
              </Link>
            </div>
          ) : (
            <>
              {/* Membership badge */}
              <div className="card p-10 text-center pop-in">
                <div
                  className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-5"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="text-sm font-medium tracking-wide" style={{ color: 'var(--accent-deep)' }}>
                  {confirmation.eyebrow}
                </p>
                <h1 className="font-display text-3xl text-ink-900 mt-2 mb-8">{confirmation.title}</h1>

                <div className="rounded-2xl border border-ink-200 bg-cream-50 py-8 px-6">
                  <div className="label !mb-2">{confirmation.membershipLabel}</div>
                  <div
                    className="font-display leading-none tabular-nums"
                    style={{ fontSize: 'clamp(3.5rem, 13vw, 6rem)', color: 'var(--accent)' }}
                    dir="ltr"
                  >
                    {membership ?? '—'}
                  </div>
                </div>
              </div>

              {/* Notices */}
              <div className="card p-7 mt-5">
                <h2 className="font-display text-xl text-ink-900 mb-4">{confirmation.noticesTitle}</h2>
                <ul className="space-y-3">
                  {confirmation.notices.map((n, i) => (
                    <li key={i} className="flex items-start gap-3 text-ink-700 leading-relaxed">
                      <span
                        className="shrink-0 mt-1.5 w-2 h-2 rounded-full"
                        style={{ background: 'var(--accent)' }}
                      />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Link href="/register" className="btn btn-primary flex-1">
                  {confirmation.registerAnother}
                </Link>
                <Link href="/" className="btn btn-secondary flex-1">
                  {confirmation.backHome}
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
