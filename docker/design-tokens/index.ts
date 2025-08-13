export const tokens = {
  color: {
    bg: 'rgb(var(--color-bg))',
    fg: 'rgb(var(--color-fg))',
    muted: 'rgb(var(--color-muted))',
    accent: 'rgb(var(--color-accent))',
    glassBg: 'rgba(var(--glass-bg))',
    glassBorder: 'rgba(var(--glass-border))'
  },
  radius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
  shadow: { glass: 'var(--shadow-glass)' },
  motion: { ease: 'var(--ease-standard)', fast: 'var(--dur-fast)', med: 'var(--dur-med)', slow: 'var(--dur-slow)' }
} as const;

export type Tokens = typeof tokens;

export function applyTokensToCSSVars(doc: Document, flat: Record<string, string>) {
  const root = doc.documentElement;
  for (const [k, v] of Object.entries(flat)) root.style.setProperty(`--${k}`, v);
}
