import type { Config } from 'tailwindcss';

/**
 * Nibras — same brutalist creative-studio system as the Medad sites.
 * The structure (cream/ink scale, shadows, radii, font families) is kept 1:1.
 * Only the ACCENT identity is swapped from Medad gold -> Nibras brand colors
 * (orange primary, with blue / cyan / red secondary pops sampled from the logo).
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif']
      },
      colors: {
        cream: {
          DEFAULT: '#FAFAF7',
          50: '#FDFCFA',
          100: '#F8F5EF',
          200: '#F2EDE3',
          300: '#E8E1D2'
        },
        ink: {
          900: '#1A1A1A',
          800: '#2D2D2D',
          700: '#3F3F3F',
          500: '#6B6B6B',
          400: '#8A8A8A',
          300: '#B5B0A7',
          200: '#E8E4DF'
        },
        // Primary accent (replaces Medad "gold") — Nibras orange.
        brand: {
          DEFAULT: '#FF9F1C',
          400: '#FFB752',
          500: '#FF9F1C',
          600: '#E68500',
          50: '#FFF8EC'
        },
        // Secondary pops sampled from the logo.
        nblue: {
          DEFAULT: '#103F91',
          600: '#0C2F6E',
          400: '#3F6CB8',
          50: '#EEF3FA'
        },
        ncyan: {
          DEFAULT: '#12B3D5',
          600: '#0E92AF',
          50: '#E7F7FB'
        },
        nred: {
          DEFAULT: '#E52E25',
          600: '#C2231B',
          50: '#FDEAE8'
        }
      },
      boxShadow: {
        soft: '0 2px 12px rgba(45, 35, 20, 0.06)',
        elevated: '0 8px 32px rgba(45, 35, 20, 0.08)',
        brand: '0 0 0 1px rgba(255, 159, 28, 0.18), 0 2px 12px rgba(255, 159, 28, 0.10)'
      },
      borderRadius: { xl2: '14px' },
      transitionTimingFunction: { gentle: 'cubic-bezier(0.4, 0, 0.2, 1)' }
    }
  },
  plugins: []
};

export default config;
