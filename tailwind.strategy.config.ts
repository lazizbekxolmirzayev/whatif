import type { Config } from 'tailwindcss'

/**
 * Theme of the Grand Strategy game (integrated from PAXAILOVASI), used only by src/strategy/strategy.css.
 * `important: '#strategy-root'` scopes every utility to the game container, so its palette (gold,
 * parchment, ink, ...) does not collide with the WHATIF theme in tailwind.config.ts.
 */
const config: Config = {
  content: ['./src/strategy/**/*.{ts,tsx}'],
  important: '#strategy-root',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07090f', 900: '#0b0f19', 850: '#0f1422', 800: '#141a2b', 700: '#1c2438', 600: '#2a3450' },
        gold: { 50: '#fbf6e6', 100: '#f3e6bd', 200: '#e8d08a', 300: '#d9b65c', 400: '#c99c3b', 500: '#a97f2a', 600: '#835f1f', 700: '#5e4417' },
        bronze: { 300: '#c9925f', 400: '#b07a47', 500: '#8c5c33', 600: '#6b4426' },
        parchment: { 50: '#f6eedb', 100: '#ecdfc0', 200: '#dcc79a', 300: '#c8ad78', 400: '#a88a55' },
        blood: { 400: '#c2493d', 500: '#a3362c', 600: '#7c271f' },
        verdigris: { 400: '#4fa08b', 500: '#3a8371' },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(201,156,59,.28), 0 18px 40px -12px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,235,180,.06)',
        glow: '0 0 24px rgba(217,182,92,.35)',
      },
    },
  },
  plugins: [],
}
export default config
