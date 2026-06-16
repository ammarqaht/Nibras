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
          DEFAULT: '#F5A623',
          400: '#F8BC5A',
          500: '#F5A623',
          600: '#E08A0C',
          50: '#FEF4E2'
        },
        // Secondary pops sampled from the logo.
        nblue: {
          DEFAULT: '#1E5BA8',
          600: '#184B8C',
          400: '#5A86C2',
          50: '#EAF1F9'
        },
        ncyan: {
          DEFAULT: '#2BAFD9',
          600: '#1F8FB4',
          50: '#E8F6FB'
        },
        nred: {
          DEFAULT: '#FB3B1E',
          600: '#D92E14',
          50: '#FDEAE6'
        }
      },
      boxShadow: {
        soft: '0 2px 12px rgba(45, 35, 20, 0.06)',
        elevated: '0 8px 32px rgba(45, 35, 20, 0.08)',
        brand: '0 0 0 1px rgba(245, 166, 35, 0.18), 0 2px 12px rgba(245, 166, 35, 0.10)'
      },
      borderRadius: { xl2: '14px' },
      transitionTimingFunction: { gentle: 'cubic-bezier(0.4, 0, 0.2, 1)' }
    }
  },
  plugins: []
};

export default config;
