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
}

.alert-success {
  background: var(--color-success-bg);
  color: var(--color-success-700);
}
```

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
