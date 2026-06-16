import Brand from '@/components/Brand';
import SocialIcon from '@/components/SocialIcon';
import { footer } from '@/content';

/** Shared footer across all pages — association contact / social channels. */
export default function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-200/70 bg-cream-50">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
          <div className="text-center sm:text-right">
            <Brand variant="lockup" imgClassName="h-11 w-auto" />
            <p className="hint mt-3 font-display text-ink-500 tracking-wide">{footer.tagline}</p>
          </div>

          <div className="flex items-center gap-3">
            {footer.social.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                className="w-11 h-11 rounded-full border border-ink-200 bg-white text-ink-700 flex items-center justify-center transition-all duration-200 hover:text-white hover:bg-brand hover:border-transparent hover:-translate-y-0.5 hover:shadow-brand"
              >
                <SocialIcon name={s.key} />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-ink-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-ink-400">
          <span>{footer.rights}</span>
          <div className="flex items-center gap-2.5">
            <span className="font-display tracking-wide text-ink-300">صُمم بعناية بواسطة</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/ammar-logo.png"
              alt="عمار سالم — Ammar Salem"
              className="h-8 w-auto opacity-75 transition-opacity duration-200 hover:opacity-100 select-none pointer-events-none"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
