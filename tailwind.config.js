import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', '"Iowan Old Style"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // The product was built with white/NN overlays. On a light theme they become soft ink tints, so every legacy surface keeps working.
        white: 'hsl(var(--ink) / <alpha-value>)',
        black: 'hsl(165 50% 6% / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: { DEFAULT: 'hsl(var(--primary) / <alpha-value>)', foreground: 'hsl(var(--primary-foreground) / <alpha-value>)' },
        secondary: { DEFAULT: 'hsl(var(--secondary) / <alpha-value>)', foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)' },
        accent: { DEFAULT: 'hsl(var(--accent) / <alpha-value>)', foreground: 'hsl(var(--accent-foreground) / <alpha-value>)' },
        muted: { DEFAULT: 'hsl(var(--muted) / <alpha-value>)', foreground: 'hsl(var(--muted-foreground) / <alpha-value>)' },
        card: { DEFAULT: 'hsl(var(--card) / <alpha-value>)', foreground: 'hsl(var(--card-foreground) / <alpha-value>)' },
        popover: { DEFAULT: 'hsl(var(--popover) / <alpha-value>)', foreground: 'hsl(var(--popover-foreground) / <alpha-value>)' },
        destructive: { DEFAULT: 'hsl(var(--destructive) / <alpha-value>)', foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)' },
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger: 'hsl(var(--destructive) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
      },
      opacity: { 3: '0.03', 4: '0.04', 6: '0.06', 8: '0.08', 12: '0.12', 14: '0.14', 18: '0.18', 85: '0.85' },
      borderRadius: { lg: '14px', md: '10px', sm: '8px', xl: '18px', '2xl': '24px' },
      boxShadow: {
        glass: '0 1px 2px hsl(165 30% 20% / .04), 0 10px 28px -16px hsl(165 35% 20% / .16)',
        glow: '0 10px 30px -12px hsl(var(--primary) / .55)',
        lift: '0 2px 4px hsl(165 30% 20% / .05), 0 22px 44px -22px hsl(165 40% 18% / .3)',
      },
      keyframes: {
        scan: { '0%': { top: '4%' }, '50%': { top: '92%' }, '100%': { top: '4%' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseRing: { '0%': { transform: 'scale(.6)', opacity: '.7' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        scan: 'scan 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(.2,.6,.3,1) infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
}
