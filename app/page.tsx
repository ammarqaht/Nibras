import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import LandingMotion from '@/components/LandingMotion';
import { getMergedSettings } from '@/lib/services';
import {
  DiscoverIcon,
  TryIcon,
  LearnIcon,
  TargetIcon,
  CalendarIcon,
  ClockIcon,
  TagIcon,
  PinIcon
} from '@/components/Icons';

const HIGHLIGHT_ICONS: Record<string, (p: { className?: string }) => JSX.Element> = {
  discover: DiscoverIcon,
  try: TryIcon,
  learn: LearnIcon
};

export default async function LandingPage() {
  const { site, landing, clubDetails, footer } = await getMergedSettings();
  const loc = clubDetails.location;

  return (
    <main className="min-h-screen flex flex-col overflow-x-hidden">
      <SiteHeader />

      {/* ============================ HERO ============================ */}
      {/* ============================ HERO ============================ */}
      <section className="relative px-6 pt-10 pb-20 sm:pt-16 sm:pb-28">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60rem 36rem at 50% 18%, rgba(245,166,35,0.10), transparent 60%), radial-gradient(50rem 36rem at 80% 60%, rgba(43,175,217,0.07), transparent 60%), radial-gradient(40rem 30rem at 15% 70%, rgba(30,91,168,0.06), transparent 60%)'
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={site.logos.lockupVertical}
            alt={site.clubNameAr}
            className="reveal-hero mx-auto w-auto h-44 sm:h-56 md:h-64 select-none"
            draggable={false}
          />

          <h1 className="reveal-hero font-display text-ink-900 mt-8 leading-tight text-[clamp(2.4rem,7vw,4.5rem)]">
            {landing.tagline}
          </h1>
          <p className="reveal-hero mt-4 text-ink-500 text-[clamp(1.05rem,2.2vw,1.4rem)]">
            {landing.taglineSub}
          </p>
        </div>
      </section>

      {/* ============================ MARQUEE ============================ */}
      <div className="border-y border-ink-200/70 bg-cream-50 py-4 overflow-hidden select-none">
        <div className="marquee-track">
          {/* Two identical copies side-by-side for a seamless infinite loop */}
          {[0, 1].map((copy) => (
            <div key={copy} className="marquee-content" aria-hidden={copy === 1}>
              {landing.marquee.map((w, i) => (
                <span
                  key={i}
                  className="font-display text-2xl sm:text-3xl text-ink-300 flex items-center gap-10"
                >
                  {w}
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============================ ABOUT / INTRO ============================ */}
      <section id="about" className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center reveal">
          <span
            className="inline-block text-sm font-medium px-3 py-1 rounded-full mb-5"
            style={{ background: 'var(--accent-soft)', color: '#7a4d00' }}
          >
            عن النادي
          </span>
          <p className="text-[clamp(1.2rem,2.6vw,1.7rem)] leading-[1.9] text-ink-800 font-body">
            {landing.intro}
          </p>
        </div>

        {/* discover / try / launch */}
        <div
          className="reveal mx-auto max-w-5xl mt-16 grid grid-cols-1 sm:grid-cols-3 gap-5"
          data-stagger
        >
          {landing.highlights.map((h) => {
            const Icon = HIGHLIGHT_ICONS[h.icon] ?? DiscoverIcon;
            return (
              <div key={h.title} className="card p-7 text-center">
                <div
                  className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-display text-2xl text-ink-900 mb-2">{h.title}</h3>
                <p className="text-ink-500 leading-relaxed">{h.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================ CLUB DETAILS ============================ */}
      <section className="px-6 pb-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal font-display text-3xl sm:text-4xl text-ink-900 text-center mb-12">
            تفاصيل النادي
          </h2>

          <div className="reveal grid grid-cols-1 sm:grid-cols-2 gap-5" data-stagger>
            <DetailCard
              icon={<TargetIcon className="w-6 h-6" />}
              label={clubDetails.targetGroup.label}
              value={clubDetails.targetGroup.value}
              note={clubDetails.targetGroup.note}
              tone="blue"
            />
            <DetailCard
              icon={<CalendarIcon className="w-6 h-6" />}
              label={clubDetails.dates.label}
              value={clubDetails.dates.value}
              tone="cyan"
            />
            <DetailCard
              icon={<ClockIcon className="w-6 h-6" />}
              label={clubDetails.time.label}
              value={clubDetails.time.value}
              note={clubDetails.time.note}
              tone="orange"
            />
            <DetailCard
              icon={<TagIcon className="w-6 h-6" />}
              label={clubDetails.fees.label}
              value={clubDetails.fees.value}
              tone="red"
            />
          </div>

          {/* Location card with embedded map */}
          <div className="reveal mt-5">
            <a
              href={loc.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="card block overflow-hidden group"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-7 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      <PinIcon className="w-6 h-6" />
                    </span>
                    <span className="label !mb-0">{loc.label}</span>
                  </div>
                  <div className="font-display text-2xl text-ink-900 mb-1">{loc.value}</div>
                  <div className="text-sm" style={{ color: 'var(--accent-deep)' }}>
                    {loc.note} ↗
                  </div>
                </div>
                <div className="h-56 md:h-auto border-t md:border-t-0 md:border-r border-ink-200">
                  {loc.embedSrc ? (
                    <iframe
                      title={loc.label}
                      src={loc.embedSrc}
                      className="w-full h-full min-h-[14rem] block pointer-events-none"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[14rem] bg-cream-50 flex flex-col items-center justify-center p-6 text-center group-hover:bg-cream-100/50 transition-colors duration-200">
                      <span className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-2xl mb-3">
                        📍
                      </span>
                      <span className="font-display text-lg text-ink-800 font-semibold mb-1">
                        اضغط لفتح موقع النادي
                      </span>
                      <span className="text-xs text-ink-400">
                        انقر للانتقال مباشرة إلى خرائط Google Maps
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ============================ CTA BAND ============================ */}
      <section className="px-6 py-24">
        <div
          className="reveal mx-auto max-w-4xl rounded-3xl px-8 py-16 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1E5BA8 0%, #113669 100%)', color: '#fff' }}
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-90"
            style={{
              background:
                'radial-gradient(circle at 80% 10%, rgba(245,166,35,0.2) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(43,175,217,0.3) 0%, transparent 60%)'
            }}
          />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-5xl mb-4">جاهز تنطلق معنا؟</h2>
            <p className="text-cream-200/80 mb-9 text-lg">سجّل الآن واحجز مكانك في نادي نبراس.</p>
            <Link href="/register" className="btn btn-primary btn-lg">
              {landing.ctaPrimary}
            </Link>
          </div>
        </div>
      </section>

      <Footer tagline={landing.tagline} social={footer.social} />
      <LandingMotion />
    </main>
  );
}

function DetailCard({
  icon,
  label,
  value,
  note,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  tone: 'orange' | 'blue' | 'cyan' | 'red';
}) {
  const toneVar: Record<typeof tone, string> = {
    orange: 'var(--accent)',
    blue: 'var(--blue)',
    cyan: 'var(--cyan)',
    red: 'var(--red)'
  };
  return (
    <div className="card p-7 flex items-start gap-4">
      <span
        className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: toneVar[tone], color: '#fff' }}
      >
        {icon}
      </span>
      <div>
        <div className="label !mb-1">{label}</div>
        <div className="font-display text-xl text-ink-900 leading-snug">{value}</div>
        {note && <div className="text-sm text-ink-500 mt-1">{note}</div>}
      </div>
    </div>
  );
}
