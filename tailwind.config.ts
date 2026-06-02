import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/(frontend)/**/*.{ts,tsx,js,jsx,mdx}',
    './components/**/*.{ts,tsx,js,jsx,mdx}',
    './lib/**/*.{ts,tsx,js,jsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          primary: 'rgb(var(--ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--ink-tertiary) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-primary) / <alpha-value>)',
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent) / <alpha-value>)',
          'accent-soft': 'rgb(var(--brand-accent-soft) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          canvas: 'rgb(var(--surface-canvas) / <alpha-value>)',
          warm: 'rgb(var(--surface-warm) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        },
        state: {
          star: 'rgb(var(--state-star) / <alpha-value>)',
          error: 'rgb(var(--state-error) / <alpha-value>)',
          info: 'rgb(var(--state-info) / <alpha-value>)',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['4.75rem', { lineHeight: '1.02', fontWeight: '500', letterSpacing: '-0.022em' }],
        'display-m': ['2.875rem', { lineHeight: '1.05', fontWeight: '500', letterSpacing: '-0.02em' }],
        'h1': ['3.5rem', { lineHeight: '1.08', fontWeight: '500', letterSpacing: '-0.018em' }],
        'h1-m': ['2.375rem', { lineHeight: '1.1', fontWeight: '500', letterSpacing: '-0.015em' }],
        'h2': ['3.25rem', { lineHeight: '1.08', fontWeight: '500', letterSpacing: '-0.02em' }],
        'h2-m': ['2.375rem', { lineHeight: '1.1', fontWeight: '500', letterSpacing: '-0.018em' }],
        'h3': ['1.5rem', { lineHeight: '2rem', fontWeight: '500' }],
        'h3-m': ['1.375rem', { lineHeight: '1.875rem', fontWeight: '500' }],
        'h4': ['1.125rem', { lineHeight: '1.625rem', fontWeight: '600' }],
        'lede': ['1.375rem', { lineHeight: '2.125rem', fontWeight: '400' }],
        'lede-m': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '400' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '400' }],
        'body': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],
        'overline': ['0.6875rem', { lineHeight: '0.875rem', fontWeight: '600', letterSpacing: '0.08em' }],
        'guide-body': ['1.1875rem', { lineHeight: '2rem', fontWeight: '400' }],
      },
      spacing: {
        '4.5': '1.125rem',
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'pill': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(11,27,52,0.06)',
        'md': '0 4px 12px rgba(11,27,52,0.08)',
        'lg': '0 12px 32px rgba(11,27,52,0.10)',
        'hover': '0 8px 24px rgba(11,27,52,0.12)',
      },
      maxWidth: {
        'canvas': '1280px',
      },
      transitionDuration: {
        '180': '180ms',
      },
      keyframes: {
        'verified-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(63,166,138,0.5)' },
          '100%': { boxShadow: '0 0 0 12px rgba(63,166,138,0)' },
        },
        'fade-up': {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'verified-pulse': 'verified-pulse 2.4s ease-out 1',
        'fade-up': 'fade-up 700ms ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
