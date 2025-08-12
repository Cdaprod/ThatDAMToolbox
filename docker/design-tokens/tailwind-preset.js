/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        fg: "rgb(var(--color-fg) / <alpha-value>)",
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "glass-bg": "rgba(var(--glass-bg))",
        "glass-border": "rgba(var(--glass-border))"
      },
      borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)" },
      boxShadow: { glass: "var(--shadow-glass)" },
      maxWidth: {
        xs: "var(--container-xs)", sm: "var(--container-sm)", md: "var(--container-md)",
        lg: "var(--container-lg)", xl: "var(--container-xl)", "search-bar": "var(--container-md)"
      },
      spacing: {
        section: "var(--section-pad-y)", "section-lg": "var(--section-pad-y-lg)",
        "gutter-sm": "var(--gutter-sm)", "gutter-md": "var(--gutter-md)", "gutter-lg": "var(--gutter-lg)"
      },
      gridTemplateColumns: { fluid: "repeat(12,minmax(calc(var(--grid-unit)*5),1fr))" },
      transitionTimingFunction: { standard: "var(--ease-standard)" },
      transitionDuration: { fast: "var(--dur-fast)", med: "var(--dur-med)", slow: "var(--dur-slow)" }
    }
  },
  plugins: [
    ({ addComponents }) => addComponents({
      ".container-fluid": { width:"100%", paddingLeft:"var(--gutter-md)", paddingRight:"var(--gutter-md)", margin:"0 auto" },
      ".section": { paddingTop:"var(--section-pad-y)", paddingBottom:"var(--section-pad-y)" },
      ".section-lg": { paddingTop:"var(--section-pad-y-lg)", paddingBottom:"var(--section-pad-y-lg)" },
      ".glass": {
        backgroundColor:"rgba(var(--glass-bg))", backdropFilter:"blur(10px)",
        border:"1px solid rgba(var(--glass-border))", boxShadow:"var(--shadow-glass)", borderRadius:"var(--radius-lg)"
      }
    })
  ]
};
