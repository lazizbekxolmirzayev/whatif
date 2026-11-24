import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: { 950: '#05070d', 900: '#0a0d16', 800: '#101522', 700: '#171d2e' },
        charcoal: { 900: '#14161c', 800: '#1b1e26', 700: '#242833', 600: '#313644' },
        gold: { 300: '#e6cf9a', 400: '#d4b66c', 500: '#c19a4a', 600: '#9a7a35' },
        parchment: '#e9e2d0',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: { gold: '0 0 0 1px rgba(193,154,74,.35), 0 8px 30px rgba(0,0,0,.45)' },
    },
  },
  plugins: [],
}
export default config
