'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import Brand from '@/components/Brand';
import { confirmation } from '@/content';

const CopyIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CardIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M12 11h6" />
    <path d="M12 15h4" />
    <circle cx="6.5" cy="10" r="2" />
    <path d="M3.5 15c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2" />
  </svg>
);

const AlertTriangleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export default function ConfirmationPage() {
  const [membership, setMembership] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [studentStage, setStudentStage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('m');
    const fromStore = (() => {
      try {
        return sessionStorage.getItem('nibras_membership');
      } catch {
        return null;
      }
    })();
    const storedName = (() => {
      try {
        return sessionStorage.getItem('nibras_student_name');
      } catch {
        return null;
      }
    })();
    const storedStage = (() => {
      try {
        return sessionStorage.getItem('nibras_student_stage');
      } catch {
        return null;
      }
    })();

    setMembership(fromUrl || fromStore);
    setStudentName(storedName);
    setStudentStage(storedStage);
    setReady(true);
  }, []);

  const handleCopy = () => {
    if (!membership) return;
    try {
      navigator.clipboard.writeText(membership);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const getFirstName = (fullName: string | null) => {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0];
  };

  const welcomeText = studentName
    ? `مرحباً بك يا ${getFirstName(studentName)} في نبراس`
    : 'مرحباً بك في نبراس';

  const getCardBorderClass = (stageKey: string | null) => {
    switch (stageKey) {
      case 'ابتدائي':
        return 'border-2 border-ncyan shadow-[0_6px_20px_rgba(18,179,213,0.08)]';
      case 'متوسط':
        return 'border-2 border-brand shadow-[0_6px_20px_rgba(255,159,28,0.08)]';
      case 'ثانوي':
        return 'border-2 border-nblue shadow-[0_6px_20px_rgba(16,63,145,0.08)]';
      default:
        return 'border border-ink-200/80 shadow-soft';
    }
  };

  const getNumberColorClass = (stageKey: string | null) => {
    switch (stageKey) {
      case 'ابتدائي':
        return 'text-ncyan-600';
      case 'متوسط':
        return 'text-brand-600';
      case 'ثانوي':
        return 'text-nblue';
      default:
        return 'text-nblue';
    }
  };

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
          {/* Step Progress Bar */}
          <div className="flex items-center justify-center max-w-md mx-auto mb-16 select-none relative px-4">
            <div className="flex items-center w-full relative">
              {/* Line Connector Background */}
              <div className="absolute top-[15px] left-0 right-0 h-[3px] bg-ink-200/60 z-0 rounded-full" />
              {/* Line Connector Active Fill */}
              <div 
                className="absolute top-[15px] right-0 h-[3px] bg-brand z-0 transition-all duration-500 rounded-full" 
                style={{ 
                  width: '100%'
                }} 
              />
              
              {/* Step 1 */}
              <div className="flex flex-col items-center relative z-10 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 bg-brand text-white border-brand">
                  ١
                </div>
                <span className="text-xs font-semibold mt-2 absolute whitespace-nowrap top-8 text-brand-600 font-bold">
                  بيانات الطالب
                </span>
              </div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center relative z-10 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 bg-brand text-white border-brand">
                  ٢
                </div>
                <span className="text-xs font-semibold mt-2 absolute whitespace-nowrap top-8 text-brand-600 font-bold">
                  طريقة السداد
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center relative z-10 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 bg-brand text-white border-brand shadow-[0_0_12px_rgba(255,159,28,0.25)]">
                  ٣
                </div>
                <span className="text-xs font-semibold mt-2 absolute whitespace-nowrap top-8 text-brand-600 font-bold">
                  التأكيد
                </span>
              </div>
            </div>
          </div>

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
                {/* Emerald Pulsing success circle */}
                <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-5 bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-[pulse_2s_infinite]">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="text-sm font-bold tracking-wide text-emerald-600 mb-1">
                  {confirmation.eyebrow}
                </p>
                <h1 className="font-display text-xl sm:text-2xl text-ink-900 mt-2 mb-8">{welcomeText}</h1>

                {/* Digital Membership Card Layout */}
                <div className={`bg-white rounded-2xl py-7 px-6 text-ink-900 relative overflow-hidden transition-all duration-300 ${getCardBorderClass(studentStage)}`}>
                  {/* Card Background Pattern Overlay */}
                  <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Card Header */}
                  <div className={`flex items-center justify-between border-b pb-3 mb-5 text-xs ${
                    studentStage === 'ابتدائي' ? 'border-ncyan/15 text-ncyan-600' :
                    studentStage === 'متوسط' ? 'border-brand/15 text-brand-600' :
                    'border-nblue/15 text-nblue'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      <CardIcon className="w-4 h-4 text-ink-500" />
                      <span className="text-ink-800">بطاقة عضوية رقمية</span>
                    </div>
                    <Brand variant="icon" imgClassName="h-9 w-auto" />
                  </div>

                  {/* Card Body */}
                  <div className="text-center my-4">
                    <div className="text-ink-400 text-xs font-semibold mb-1.5">{confirmation.membershipLabel}</div>
                    <div
                      className={`font-display leading-none tabular-nums text-5xl sm:text-6xl font-black tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${getNumberColorClass(studentStage)}`}
                      dir="ltr"
                    >
                      {membership ?? '—'}
                    </div>
                  </div>

                  {/* Copy Button */}
                  {membership && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`mx-auto mt-4 flex items-center justify-center gap-2 py-2 px-5 rounded-full text-xs font-bold transition-all duration-300 ${
                        copied 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' 
                          : 'bg-white hover:bg-ink-50 text-ink-700 border border-ink-200'
                      }`}
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-600 animate-[scaleIn_0.2s_ease]" />
                          <span>تم نسخ رقم العضوية!</span>
                        </>
                      ) : (
                        <>
                          <CopyIcon className="w-3.5 h-3.5 text-ink-500" />
                          <span>نسخ رقم العضوية</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Notices alerts box */}
              <div className="card border border-amber-200/80 bg-amber-50/40 p-7 mt-5">
                <h2 className="font-display text-lg text-ink-900 mb-4 flex items-center gap-2">
                  <AlertTriangleIcon className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>{confirmation.noticesTitle}</span>
                </h2>
                <ul className="space-y-3.5">
                  {confirmation.notices.map((n, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700 leading-relaxed">
                      <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Link 
                  href="/register" 
                  className="btn font-bold text-white bg-brand hover:bg-brand-600 hover:shadow-[0_8px_24px_rgba(255,159,28,0.22)] hover:-translate-y-0.5 border-none transition-all duration-300 flex-1 py-3.5 text-center"
                >
                  {confirmation.registerAnother}
                </Link>
                <Link 
                  href="/" 
                  className="btn btn-secondary flex-1 py-3.5 text-center transition-all duration-300 hover:border-nblue hover:text-nblue-600"
                >
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
