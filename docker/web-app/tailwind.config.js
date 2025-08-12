const preset = require('../design-tokens/tailwind-preset.js');
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: ['./src/app/**/*.{js,ts,jsx,tsx}','./src/components/**/*.{js,ts,jsx,tsx}','./src/providers/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: []
};
