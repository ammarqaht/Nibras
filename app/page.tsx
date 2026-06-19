import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import LandingMotion from '@/components/LandingMotion';
import { getMergedSettings } from '@/lib/services';
import {
  DiscoverIcon,
  TryIcon,
  LearnIcon,
  RocketIcon,
  TargetIcon,
  CalendarIcon,
  ClockIcon,
  TagIcon,
  PinIcon
} from '@/components/Icons';

const HIGHLIGHT_ICONS: Record<string, (p: { className?: string }) => JSX.Element> = {
  discover: DiscoverIcon,
  try: TryIcon,
  learn: RocketIcon
};

const GLOW_SHADOWS: Record<string, string> = {
  discover: 'hover:shadow-[0_20px_40px_rgba(255,159,28,0.14)] hover:border-brand/30',
  try: 'hover:shadow-[0_20px_40px_rgba(18,179,213,0.14)] hover:border-ncyan/30',
  learn: 'hover:shadow-[0_20px_40px_rgba(229,46,37,0.14)] hover:border-nred/30'
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
              'radial-gradient(60rem 36rem at 50% 18%, rgba(255,159,28,0.10), transparent 60%), radial-gradient(50rem 36rem at 80% 60%, rgba(18,179,213,0.07), transparent 60%), radial-gradient(40rem 30rem at 15% 70%, rgba(16,63,145,0.06), transparent 60%)'
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

          {/* Journey Timeline */}
          <div className="reveal-hero mx-auto max-w-xl mt-12 mb-6 px-2">
            <div className="flex flex-row items-center justify-center gap-2 sm:gap-14 relative w-full sm:w-fit mx-auto">
              
              {/* Connector line */}
              <div className="absolute top-[22px] sm:top-7 left-[48px] right-[48px] sm:left-[64px] sm:right-[64px] h-[2px] bg-gradient-to-r from-nblue/30 via-brand/30 to-ncyan/30 z-0" />
              
              {/* Step 1: Discover */}
              <div className="flex flex-col items-center text-center relative z-10 group w-24 sm:w-32">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-ncyan-50 text-ncyan-600 border border-ncyan-200/60 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <DiscoverIcon className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <span className="font-body text-sm sm:text-lg font-bold text-ink-900 mt-2 sm:mt-3">اكتشف</span>
                <span className="text-[10px] sm:text-xs text-ink-400 mt-0.5 sm:mt-1 font-semibold">اهتمامات جديدة</span>
              </div>

              {/* Step 2: Try */}
              <div className="flex flex-col items-center text-center relative z-10 group w-24 sm:w-32">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-brand-50 text-brand border border-brand-200/60 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
                  <TryIcon className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <span className="font-body text-sm sm:text-lg font-bold text-ink-900 mt-2 sm:mt-3">جرّب</span>
                <span className="text-[10px] sm:text-xs text-ink-400 mt-0.5 sm:mt-1 font-semibold">تجارب تفاعلية</span>
              </div>

              {/* Step 3: Launch */}
              <div className="flex flex-col items-center text-center relative z-10 group w-24 sm:w-32">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-nblue-50 text-nblue border border-nblue-200/60 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <RocketIcon className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <span className="font-body text-sm sm:text-lg font-bold text-ink-900 mt-2 sm:mt-3">انطلق</span>
                <span className="text-[10px] sm:text-xs text-ink-400 mt-0.5 sm:mt-1 font-semibold">بقيمك ومهاراتك</span>
              </div>

            </div>
          </div>

          <p className="reveal-hero mt-8 text-ink-500 text-[clamp(1.05rem,2.2vw,1.4rem)] font-semibold">
            {landing.taglineSub}
          </p>
        </div>
      </section>

      {/* ============================ MARQUEE ============================ */}
      <div className="border-y border-ink-200/70 bg-cream-50 py-4 overflow-hidden select-none" style={{ direction: 'ltr' }}>
        <div className="marquee-track">
          {/* Three identical copies for a seamless infinite loop */}
          {[0, 1, 2].map((copy) => (
            <div key={copy} className="marquee-content" aria-hidden={copy > 0}>
              {Array.from({ length: 6 }).flatMap((_, r) =>
                landing.marquee.map((w, i) => (
                  <span
                    key={`${r}-${i}`}
                    className="font-display text-2xl sm:text-3xl text-ink-300 flex items-center gap-10"
                  >
                    {w}
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                  </span>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ============================ ABOUT / INTRO ============================ */}
      {/* ============================ ABOUT / INTRO ============================ */}
      <section id="about" className="px-6 py-20 sm:py-28 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-nblue/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-3xl text-center reveal flex flex-col items-center">
          <span
            className="font-display inline-block text-lg sm:text-xl font-bold px-6 py-2.5 rounded-full mb-7 bg-nblue-50 text-nblue border border-nblue/10 tracking-wide"
          >
            ما هو نادي نبراس؟
          </span>
          
          <p className="text-[clamp(1.15rem,2.5vw,1.45rem)] leading-[1.85] text-ink-800 font-body mb-10 max-w-2xl">
            نادي نبراس هو أحد برامج جمعية وثبة لتنمية الشباب والنشء، يهدف إلى <span className="text-ncyan-600 font-bold">تنمية مهارات الطالب</span> عن طريق برامج متنوعة، تجمع بين <span className="text-ncyan-600 font-bold">القيم والثقافة والترفيه</span> بشكل هادف وممتع.
          </p>

          {/* Core Features list centered */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl border-t border-ink-200/60 pt-8">
            <div className="font-body text-base sm:text-lg font-bold px-6 py-3 rounded-full bg-nblue-50 text-nblue border border-nblue/10 tracking-wide text-center flex items-center justify-center w-full shadow-sm hover:scale-[1.01] transition-transform duration-300">
              بيئة تربوية آمنة وتفاعلية
            </div>
            <div className="font-body text-base sm:text-lg font-bold px-6 py-3 rounded-full bg-ncyan-50 text-ncyan border border-ncyan/10 tracking-wide text-center flex items-center justify-center w-full shadow-sm hover:scale-[1.01] transition-transform duration-300">
              ورش عمل وتجارب عملية
            </div>
            <div className="font-body text-base sm:text-lg font-bold px-6 py-3 rounded-full bg-brand-50 text-brand border border-brand/10 tracking-wide text-center flex items-center justify-center w-full shadow-sm hover:scale-[1.01] transition-transform duration-300">
              إشراف كادر تربوي متميز
            </div>
            <div className="font-body text-base sm:text-lg font-bold px-6 py-3 rounded-full bg-nred-50 text-nred-600 border border-nred/10 tracking-wide text-center flex items-center justify-center w-full shadow-sm hover:scale-[1.01] transition-transform duration-300">
              برامج قيمية وترفيهية متوازنة
            </div>
          </div>
        </div>

        {/* discover / try / launch */}
        <div
          className="reveal mx-auto max-w-5xl mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6"
          data-stagger
        >
          {landing.highlights.map((h, idx) => {
            const Icon = HIGHLIGHT_ICONS[h.icon] ?? DiscoverIcon;
            const glowClass = GLOW_SHADOWS[h.icon] ?? 'hover:shadow-[0_20px_40px_rgba(255,159,28,0.14)]';
            return (
              <div
                key={h.title}
                className={`group relative card p-8 text-center bg-white/70 backdrop-blur-md border border-ink-200/40 rounded-2xl card-transition hover:bg-white ${glowClass}`}
              >
                {/* Animated Icon Container */}
                <div
                  className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-md"
                  style={{ background: h.color || 'var(--accent)', color: '#fff' }}
                >
                  <Icon className="w-8 h-8" />
                </div>
                
                {/* Title */}
                <h3 className="font-display text-2xl text-ink-900 mb-3">{h.title}</h3>
                
                {/* Description */}
                <p className="text-ink-500 leading-relaxed font-body text-sm sm:text-base">
                  {h.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================ CLUB DETAILS ============================ */}
      <section className="px-6 pb-8">
        <div className="mx-auto max-w-5xl">
          <div className="reveal text-center mb-12">
            <span
              className="font-display inline-block text-lg sm:text-xl font-bold px-6 py-2.5 rounded-full bg-nblue-50 text-nblue border border-nblue/10 tracking-wide"
            >
              تفاصيل النادي
            </span>
          </div>

          <div className="reveal grid grid-cols-1 sm:grid-cols-2 gap-5" data-stagger>
            <DetailCard
              icon={<TargetIcon className="w-6 h-6" />}
              label={clubDetails.targetGroup.label}
              value={
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border border-ncyan-600/20 bg-ncyan-50 text-ncyan-600 select-none animate-pulse-subtle">
                    ابتدائي عليا
                  </span>
                  <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border border-brand-600/20 bg-brand-50 text-brand-600 select-none animate-pulse-subtle">
                    متوسط
                  </span>
                  <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border border-nred-600/20 bg-nred-50 text-nred-600 select-none animate-pulse-subtle">
                    ثانوي
                  </span>
                </div>
              }
              note={clubDetails.targetGroup.note}
              tone="blue"
            />
            <DetailCard
              icon={<CalendarIcon className="w-6 h-6" />}
              label={clubDetails.dates.label}
              value={
                <div className="flex items-center gap-4 mt-1 select-none">
                  <div className="text-center">
                    <div className="font-display text-[22px] font-semibold text-ink-900 leading-none">15</div>
                    <div className="text-[13px] text-ink-700 mt-1.5 font-semibold font-body">محرم</div>
                  </div>
                  <div className="flex items-center justify-center text-ncyan-600/70">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-[22px] font-semibold text-ink-900 leading-none">09</div>
                    <div className="text-[13px] text-ink-700 mt-1.5 font-semibold font-body">صفر</div>
                  </div>
                </div>
              }
              tone="cyan"
            />
            <DetailCard
              icon={<ClockIcon className="w-6 h-6" />}
              label={clubDetails.time.label}
              value={
                <div className="flex items-center gap-4 mt-1 select-none">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-[22px] font-semibold text-ink-900 leading-none">4:00</span>
                    <span className="text-sm font-semibold font-body text-ink-700">م</span>
                  </div>
                  <div className="flex items-center justify-center text-brand-600/70">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-[22px] font-semibold text-ink-900 leading-none">9:00</span>
                    <span className="text-sm font-semibold font-body text-ink-700">م</span>
                  </div>
                </div>
              }
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
              className="card block overflow-hidden group bg-white/70 backdrop-blur-md border border-ink-200/40 rounded-2xl card-transition hover:bg-white hover:shadow-[0_20px_40px_rgba(255,159,28,0.12)] hover:border-brand/30"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-7 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm"
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
          style={{ background: 'linear-gradient(135deg, #103F91 0%, #071F4A 100%)', color: '#fff' }}
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-90"
            style={{
              background:
                'radial-gradient(circle at 80% 10%, rgba(255,159,28,0.2) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(18,179,213,0.3) 0%, transparent 60%)'
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

      <Footer tagline={footer.tagline} social={footer.social} />
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
  value: React.ReactNode;
  note?: string;
  tone: 'orange' | 'blue' | 'cyan' | 'red';
}) {
  const toneVar: Record<typeof tone, string> = {
    orange: 'var(--accent)',
    blue: 'var(--blue)',
    cyan: 'var(--cyan)',
    red: 'var(--red)'
  };

  const glowClass: Record<typeof tone, string> = {
    orange: 'hover:shadow-[0_20px_40px_rgba(255,159,28,0.12)] hover:border-brand/30',
    blue: 'hover:shadow-[0_20px_40px_rgba(16,63,145,0.12)] hover:border-nblue/30',
    cyan: 'hover:shadow-[0_20px_40px_rgba(18,179,213,0.12)] hover:border-ncyan/30',
    red: 'hover:shadow-[0_20px_40px_rgba(229,46,37,0.12)] hover:border-nred/30'
  };

  return (
    <div className={`group card p-7 flex items-start gap-4 bg-white/70 backdrop-blur-md border border-ink-200/40 rounded-2xl card-transition hover:bg-white ${glowClass[tone]}`}>
      <span
        className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm"
        style={{ background: toneVar[tone], color: '#fff' }}
      >
        {icon}
      </span>
      <div>
        <div className="label !mb-1 transition-colors group-hover:text-ink-700">{label}</div>
        <div className="font-display text-xl text-ink-900 leading-snug">{value}</div>
        {note && <div className="text-sm text-ink-500 mt-1">{note}</div>}
      </div>
    </div>
  );
}
