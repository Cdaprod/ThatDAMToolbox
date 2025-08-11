const plugin = require('tailwindcss/plugin')
const preset = require('../../packages/design-tokens/tailwind-preset.js')

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    plugin(({ addComponents }) => {
      addComponents({
        '.container-fluid': {
          width: '100%',
          paddingLeft: 'var(--gutter-md)',
          paddingRight: 'var(--gutter-md)',
          marginLeft: 'auto',
          marginRight: 'auto',
        },
        '.section': {
          paddingTop: 'var(--section-pad-y)',
          paddingBottom: 'var(--section-pad-y)',
        },
        '.section-lg': {
          paddingTop: 'var(--section-pad-y-lg)',
          paddingBottom: 'var(--section-pad-y-lg)',
        },
      })
    }),
  ],
}
