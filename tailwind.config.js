/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f7fae0',
          100: '#eef5b8',
          200: '#e2ed85',
          300: '#d5e45a',
          400: '#ceda47',
          500: '#c7d540',   // Loricatus brand accent — yellow-green
          600: '#aeba33',
          700: '#8e9928',
          800: '#6e7720',
          900: '#4e5518',
        },
        loricatus: {
          dark:    '#2B3B46',   // primary dark — Bellwether Black
          slate:   '#323E48',   // secondary dark
          graphite:'#4A5A66',
          smoke:   '#6B7C89',
          silver:  '#9AAAB5',
          parchment:'#F2F1ED',
          accent:  '#C7D540',   // brand yellow-green
        },
      },
      keyframes: {
        'pulse-beacon': {
          '0%':   { transform: 'scale(1)',   opacity: '1' },
          '50%':  { transform: 'scale(1.8)', opacity: '0.4' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-in-up': {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'check-pop': {
          '0%':   { transform: 'scale(0)' },
          '60%':  { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        'confetti-burst': {
          '0%':   { transform: 'scale(0) rotate(0deg)',   opacity: '1' },
          '60%':  { transform: 'scale(1.2) rotate(15deg)', opacity: '0.8' },
          '100%': { transform: 'scale(1) rotate(0deg)',   opacity: '1' },
        },
      },
      animation: {
        'pulse-beacon':   'pulse-beacon 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':        'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-up':    'slide-in-up 0.3s ease-out',
        'check-pop':      'check-pop 0.4s ease-out',
        'confetti-burst': 'confetti-burst 0.6s ease-out',
      },
    },
  },
  plugins: [],
};
