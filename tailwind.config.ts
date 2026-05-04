import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      colors: {
        bg: '#F8F7F4',
        surface: '#FFFFFF',
        border: '#E5E3DC',
        ink: '#1C1C1A',
        muted: '#78716C',
        accent: '#2563EB',
        'accent-dark': '#1D4ED8',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}

export default config
