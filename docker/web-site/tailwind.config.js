const preset = require('../../packages/design-tokens/tailwind-preset.js');
module.exports = {
  presets: [preset],
  content: ['./src/app/**/*.{js,ts,jsx,tsx}','./src/components/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: []
};
