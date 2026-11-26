import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // the ChoiceMi violet, shared with the member app
        brand: { 950: '#1B0A3D', 900: '#2E0A66', 800: '#430F8F', 700: '#5714B8', 600: '#6B1FDD', 500: '#8140F0', 400: '#9D6BFA', 300: '#BB98FF', 200: '#D6C2FF', 100: '#EAE0FF', 50: '#F5F0FF' },
        // the restaurant site is warmer: paper and ink, with a saffron accent
        ink: { 950: '#110E18', 900: '#1B1624', 800: '#2A2335', 700: '#443C52', 600: '#5E5670', 500: '#7C7490', 400: '#A09AAF', 300: '#CBC6D6', 200: '#E3DFEA', 100: '#F0EDF4' },
        paper: { DEFAULT: '#FBF8F3', 2: '#F5F0E8', 3: '#EBE4D8' },
        saffron: { 600: '#B45F06', 500: '#D4780F', 100: '#FBE7C6', 50: '#FEF6E7' },
        ok: { 600: '#2D6A14', 100: '#DDEFCB', 50: '#EFF7E4' },
        danger: { DEFAULT: '#C0392B', 50: '#FDE8E6' },
      },
      fontFamily: { sans: ['var(--font-sans)', '-apple-system', 'Segoe UI', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(17,14,24,.05), 0 6px 24px -12px rgba(17,14,24,.12)',
        lift: '0 18px 50px -18px rgba(46,10,102,.35)',
      },
    },
  },
  plugins: [],
}
export default config
