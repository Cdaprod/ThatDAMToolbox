# Styles

This folder hosts global style artifacts for the web app.

## Tokens

`tokens.css` defines spacing, color, and container design tokens as CSS variables. These are imported by `globals.css` and surface through Tailwind utilities. Key vars include:

- `--grid-unit` and `--gutter-*`
- `--section-pad-y` and `--section-pad-y-lg`
- `--container-xs` … `--container-xl`

- semantic color scales like `--color-primary-50` … `--color-primary-900`

Adjusting these variables updates layout across the app without touching markup.

### Color Palette

Six semantic palettes are provided: `primary`, `accent`, `neutral`, `success`, `warning`, and `error`. Each palette follows a Tailwind-like scale (`50`–`900`) plus helper aliases such as `--color-surface-alt` and text-on-color tokens.

Example usage:

```css
.btn-primary {
  background: var(--color-primary-500);
  color: var(--color-text-on-primary);

.alert-success {
  background: var(--color-success-bg);
  color: var(--color-success-700);
}
```

- `--color-surface`, `--color-border`, `--color-muted`
- `--color-primary`/`--color-primary-bg` and `--color-accent`/`--color-accent-bg`

Adjusting these variables updates layout across the app without touching markup.

### Token Reference

| Purpose             | CSS Variable          | Utility Example            |
|---------------------|-----------------------|----------------------------|
| Surface panels      | `--color-surface`     | `bg-surface`               |
| Subtle text         | `--color-muted`       | `text-color-muted`         |
| Standard borders    | `--color-border`      | `border-color-border`      |
| Primary brand       | `--color-primary`     | `text-theme-primary`       |
| Primary highlight   | `--color-primary-bg`  | `bg-color-primary-bg`      |
| Accent brand        | `--color-accent`      | `text-theme-accent`        |
| Accent highlight    | `--color-accent-bg`   | `bg-color-accent-bg`       |

Utilities are defined in `globals.css` under the `@layer utilities` block.

## Color Tokens

Color tokens allow components to stay theme-aware without hardcoding Tailwind palette values.

```tsx
export default function Card() {
  return (
    <div className="bg-surface border-color-border p-4">
      <h2 style={{ color: 'var(--color-accent)' }}>Token Driven</h2>
      <p className="text-color-muted">Colors come from CSS variables.</p>
    </div>
  )
}
```

The `bg-surface` utility maps to `var(--color-surface)` while inline styles can pull any token directly via `var(--color-*)`.

## Layout Primitives

Reusable building blocks live in `../components/primitives/`:

```
import Container from '@/components/primitives/Container'
import Stack from '@/components/primitives/Stack'

<section className="section bg-surface-800">
  <Container max="lg">
    <Stack gap="md">…</Stack>
  </Container>
</section>
```

Both primitives respond to the token-driven Tailwind utilities, so changing a gutter or max-width is a single variable edit.

## Migrating from Tailwind palette classes

Replace hard-coded Tailwind palette classes with token utilities to ensure future theme changes require only token edits.

| Tailwind palette     | Token utility           |
|----------------------|-------------------------|
| `bg-white`           | `bg-surface`            |
| `text-gray-500`      | `text-color-muted`      |
| `border-gray-200`    | `border-color-border`   |
| `bg-blue-500`        | `bg-theme-primary`      |
| `text-purple-500`    | `text-theme-accent`     |

Example:

```tsx
// Before
<div className="bg-white text-gray-500">…</div>

// After
<div className="bg-surface text-color-muted">…</div>
```

Using token utilities centralizes palette decisions and prepares components for future themes.
