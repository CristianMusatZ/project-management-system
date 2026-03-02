/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        float: '0 8px 40px -8px rgba(0,0,0,0.18)',
        card:  '0 4px 16px -4px rgba(0,0,0,0.08)',
        modal: '0 24px 60px -12px rgba(0,0,0,0.2)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-down': {
          from: { opacity: '0', transform: 'translateY(-12px) scaleY(0.95)' },
          to:   { opacity: '1', transform: 'translateY(0) scaleY(1)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in-left':  'slide-in-left  0.4s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-up':    'slide-in-up    0.45s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-down':  'slide-in-down  0.28s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in':       'scale-in       0.3s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':        'fade-in        0.35s ease both',
        'page-enter':     'page-enter     0.5s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
