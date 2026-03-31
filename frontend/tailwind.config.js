/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50:  '#fdf9ee',
          100: '#f9f0d0',
          200: '#f2e0a1',
          300: '#e9ca68',
          400: '#dfb13a',
          500: '#C9A84C', // primary gold
          600: '#A8873A',
          700: '#8a6c2e',
          800: '#6e5525',
          900: '#5a451e',
          950: '#2e230f',
        },
        dark: {
          50:  '#f5f5f5',
          100: '#e5e5e5',
          200: '#d4d4d4',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#2a2a2a',
          800: '#1f1f1f',
          850: '#1a1a1a',
          900: '#141414',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      animation: {
        'fadeIn': 'fadeIn 0.4s ease-out',
        'slideIn': 'slideIn 0.3s ease-out',
        'scaleIn': 'scaleIn 0.25s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201, 168, 76, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(201, 168, 76, 0)' },
        },
      },
      boxShadow: {
        'gold': '0 4px 20px rgba(201, 168, 76, 0.25)',
        'gold-lg': '0 8px 32px rgba(201, 168, 76, 0.35)',
        'dark': '0 4px 20px rgba(0,0,0,0.5)',
        'dark-lg': '0 8px 32px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
