import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'Times New Roman', 'serif'],
      },
      colors: {
        bg: '#F7F5F0',
        surface: '#FFFFFF',
        border: '#E8E4DB',
        ink: '#1A1817',
        muted: '#6F6A63',
        // The real thing: TfL roundel red (Pantone 485 territory), not pink
        accent: '#E32017',
        'accent-dark': '#B81A12',
        'accent-soft': '#FBE9E7',
        // Acid lime — the pop color. Only ever on dark surfaces, in small doses.
        pop: '#C9F73A',
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,24,23,0.05), 0 1px 1px rgba(26,24,23,0.03)',
        'card-hover': '0 12px 24px -6px rgba(26,24,23,0.14), 0 4px 8px -2px rgba(26,24,23,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
