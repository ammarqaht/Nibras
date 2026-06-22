'use client';

import { useEffect } from 'react';

/* CDN sources — same versions as the Medad landing sites. */
const SCRIPTS = [
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'https://unpkg.com/lenis@1.1.13/dist/lenis.min.js'
];

declare global {
  interface Window {
    gsap?: any;
    ScrollTrigger?: any;
    Lenis?: any;
    __nibrasLenis?: any;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => resolve(); // fail soft -> fallback handles it
    document.head.appendChild(el);
  });
}

/**
 * Drives the landing-page motion using the exact patterns from the Medad static
 * sites (Lenis smooth scroll + GSAP/ScrollTrigger reveals). If GSAP can't load
 * or the user prefers reduced motion, it falls back to an IntersectionObserver
 * that reveals elements via CSS. Renders nothing.
 */
export default function LandingMotion() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cleanups: Array<() => void> = [];

    function fallbackReveal() {
      const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
      document.querySelectorAll<HTMLElement>('.reveal-hero').forEach((el) => el.classList.add('is-in'));
      if (reduceMotion) {
        els.forEach((el) => el.classList.add('is-in'));
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-in');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
      );
      els.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());

      // Fallback scroll-active observer for mobile if screen is small
      if (window.innerWidth <= 768) {
        const mobileIo = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('active-mobile');
              } else {
                entry.target.classList.remove('active-mobile');
              }
            });
          },
          {
            rootMargin: '-35% 0px -35% 0px', // targets the middle 30% of the screen
            threshold: 0
          }
        );
        const cards = document.querySelectorAll<HTMLElement>('.card');
        cards.forEach((card) => mobileIo.observe(card));
        cleanups.push(() => mobileIo.disconnect());
      }
    }

    async function run() {
      if (reduceMotion) {
        fallbackReveal();
        return;
      }
      await Promise.all(SCRIPTS.map(loadScript));
      const { gsap, ScrollTrigger, Lenis } = window;
      if (!gsap || !ScrollTrigger) {
        fallbackReveal();
        return;
      }
      gsap.registerPlugin(ScrollTrigger);

      // ---- Lenis smooth scroll, integrated with ScrollTrigger ----
      if (Lenis) {
        const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        window.__nibrasLenis = lenis;
        lenis.on('scroll', () => ScrollTrigger.update());
        const raf = (time: number) => {
          lenis.raf(time);
          requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
        cleanups.push(() => lenis.destroy());
      }

      // ---- Hero: calm rise + fade once fonts are ready ----
      const heroEls = gsap.utils.toArray('.reveal-hero');
      let heroPlayed = false;
      let heroTween: any = null;
      const playHero = () => {
        if (heroPlayed) return;
        heroPlayed = true;
        heroTween = gsap.fromTo(
          heroEls,
          { opacity: 0, y: 30, scale: 1.02 },
          { opacity: 1, y: 0, scale: 1, duration: 1.1, stagger: 0.14, ease: 'power3.out' }
        );
      };
      if (document.fonts && (document.fonts as any).ready) {
        (document.fonts as any).ready.then(playHero);
      }
      setTimeout(playHero, 1400); // safety so the hero never stays hidden
      // Hard guarantee: if rAF is throttled (e.g. backgrounded tab) the tween may
      // never advance. Seek it to completion (rAF-independent) so a live-but-frozen
      // tween can't reassert a partial value on a later tick.
      const heroGuard = setTimeout(() => {
        if (heroTween) heroTween.progress(1);
        else gsap.set(heroEls, { opacity: 1, y: 0, scale: 1 });
      }, 2800);
      cleanups.push(() => clearTimeout(heroGuard));

      // ---- Scroll reveals (fade-up). A [data-stagger] container reveals its
      //      direct children in sequence (the container itself stays visible). ----
      gsap.utils.toArray('.reveal').forEach((el: HTMLElement) => {
        if (el.hasAttribute('data-stagger')) {
          gsap.set(el, { opacity: 1, y: 0 }); // keep container visible
          gsap.fromTo(
            el.children,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: 'power3.out',
              stagger: 0.12,
              scrollTrigger: { trigger: el, start: 'top 85%' }
            }
          );
        } else {
          gsap.fromTo(
            el,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: 'power3.out',
              scrollTrigger: { trigger: el, start: 'top 85%' }
            }
          );
        }
      });

      // ---- Mobile Scroll-Active Cards (Center of Viewport) ----
      const mm = gsap.matchMedia();
      mm.add("(max-width: 768px)", () => {
        const cards = gsap.utils.toArray('.card') as HTMLElement[];
        cards.forEach((card) => {
          ScrollTrigger.create({
            trigger: card,
            start: 'top 65%',
            end: 'bottom 35%',
            toggleClass: 'active-mobile',
          });
        });
      });

      ScrollTrigger.refresh();
      cleanups.push(() => ScrollTrigger.getAll().forEach((t: any) => t.kill()));
    }

    run();
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
