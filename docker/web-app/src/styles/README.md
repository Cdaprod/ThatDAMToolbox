# Styles

This folder hosts global style artifacts for the web app.

## Tokens

`tokens.css` defines spacing and container design tokens as CSS variables. These are imported by `globals.css` and surface through Tailwind utilities. Key vars include:

- `--grid-unit` and `--gutter-*`
- `--section-pad-y` and `--section-pad-y-lg`
- `--container-xs` … `--container-xl`

Adjusting these variables updates layout across the app without touching markup.

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
