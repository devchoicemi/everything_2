import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'bg-danger', 'text-danger', 'border-danger', 'bg-danger-50',
    'text-brand-600', 'text-brand-700', 'text-brand-800',
    // Button variants are composed dynamically (`btn-${variant}`) so Tailwind's
    // content scanner cannot see them — keep the component classes in the build.
    'btn', 'btn-primary', 'btn-secondary', 'btn-ghost', 'btn-white', 'btn-danger',
    'btn-amber', 'btn-sm', 'btn-xs', 'btn-lg', 'btn-auto',
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', sm: '1.5rem', lg: '2rem', xl: '2.5rem' },
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        brand: {
          950: '#1B0A3D',
          900: '#2E0A66',
          800: '#430F8F',
          700: '#5714B8',
          600: '#6B1FDD',
          500: '#8140F0',
          400: '#9D6BFA',
          300: '#BB98FF',
          200: '#D6C2FF',
          100: '#EAE0FF',
          50: '#F5F0FF',
        },
        warm: {
          950: '#110C20',
          900: '#1D1730',
          800: '#2E2840',
          700: '#463F57',
          600: '#5D566E',
          500: '#787088',
          400: '#9C95AD',
          300: '#C3BCD3',
          200: '#DDD7EA',
          100: '#ECE7F5',
          75: '#F5F1FC',
          50: '#FBF9FF',
        },
        amber: { 600: '#A86212', 500: '#C67A22', 100: '#FBE9CA', 50: '#FEF5E7' },
        coral: { 600: '#DB2777', 100: '#FBCFE8', 50: '#FDF2F8' },
        purple: { 600: '#4A42A8', 100: '#C5C2EE', 50: '#EEEDFD' },
        pink: { 600: '#72243E', 50: '#FBEAF0' },
        emerald: { 600: '#2D6A14', 50: '#EAF3DE' },
        danger: { DEFAULT: '#C0392B', 50: '#FDE8E6' },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'sans-serif'],
        ui: ['var(--font-ui)', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['clamp(3rem, 6vw, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-xl': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'display-lg': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(1.6rem, 3vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '128': '32rem',
        '160': '40rem',
      },
      maxWidth: {
        'content': '1200px',
        'prose-sm': '38ch',
      },
      borderRadius: {
        xs: '8px', sm: '12px', md: '16px', lg: '22px', xl: '28px', '2xl': '36px', '3xl': '44px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(14,13,11,.06)',
        sm: '0 1px 3px rgba(14,13,11,.08), 0 1px 2px rgba(14,13,11,.04)',
        md: '0 4px 16px rgba(14,13,11,.10), 0 2px 4px rgba(14,13,11,.06)',
        lg: '0 12px 40px rgba(14,13,11,.14), 0 4px 8px rgba(14,13,11,.06)',
        xl: '0 24px 70px -12px rgba(46,10,102,.30), 0 8px 24px -8px rgba(14,13,11,.12)',
        glow: '0 0 0 1px rgba(129,64,240,.22), 0 20px 60px -15px rgba(192,38,211,.38)',
      },
      screens: {
        xs: '375px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px',
      },
      backgroundImage: {
        'grid-warm':
          'linear-gradient(rgba(14,13,11,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(14,13,11,.035) 1px, transparent 1px)',
        'radial-brand':
          'radial-gradient(60% 60% at 50% 0%, rgba(192,38,211,.22), transparent 70%)',
        'brand-sheen':
          'linear-gradient(135deg, #1B0A3D 0%, #5714B8 50%, #C026D3 85%, #EC4899 100%)',
        'brand-cta': 'linear-gradient(90deg, #6D28D9 0%, #C026D3 55%, #EC4899 100%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.38s ease forwards',
        'fade-in': 'fadeIn 0.25s ease forwards',
        'slide-up': 'slideUp 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'heart-pop': 'heartPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'ring-in': 'ringIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        confetti: 'confettiFall 1.6s ease-in forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        marquee: 'marquee 32s linear infinite',
        'spin-slow': 'spin 14s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { transform: 'scale(.75)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        heartPop: {
          '0%': { transform: 'scale(0) rotate(-15deg)' },
          '60%': { transform: 'scale(1.3) rotate(8deg)' },
          '100%': { transform: 'scale(1) rotate(0)' },
        },
        ringIn: {
          '0%': { transform: 'scale(.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        confettiFall: {
          '0%': { transform: 'translateY(-10px) rotate(0)', opacity: '1' },
          '100%': { transform: 'translateY(700px) rotate(420deg)', opacity: '0' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(-1.5deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
