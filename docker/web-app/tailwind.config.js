/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
      },
      colors: {
        'glass-bg': 'rgba(255,255,255,0.6)',
        'glass-border': 'rgba(255,255,255,0.3)',
      },
    },
  },
  plugins: [],

}