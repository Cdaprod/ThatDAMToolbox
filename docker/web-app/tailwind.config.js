const plugin = require('tailwindcss/plugin')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
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
      maxWidth: {
        'xs': 'var(--container-xs)',
        'sm': 'var(--container-sm)',
        'md': 'var(--container-md)',
        'lg': 'var(--container-lg)',
        'xl': 'var(--container-xl)',
      },
      spacing: {
        'section': 'var(--section-pad-y)',
        'section-lg': 'var(--section-pad-y-lg)',
        'gutter-sm': 'var(--gutter-sm)',
        'gutter-md': 'var(--gutter-md)',
        'gutter-lg': 'var(--gutter-lg)',
      },
      gridTemplateColumns: {
        fluid: 'repeat(12,minmax(calc(var(--grid-unit)*5),1fr))',
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