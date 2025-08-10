# Components

## useInputGesture

Normalise tap, long-press and double-tap across input types.

```tsx
const ref = useRef<HTMLDivElement>(null);
useInputGesture(ref, g => {
  if (g.type === 'tap')   select();
  if (g.type === 'hold')  openMenu();
  if (g.type === 'dbl')   preview();
});
```

Attach `SelectableItem` to wrap children with selection and gesture handling.

```tsx
<SelectableItem id={asset.id} actions={actions}>
  <img src={asset.thumbnail} />
</SelectableItem>
```

## Layered Explorer (experimental)

Renders the asset tree in 2.5D using WebGL.

Install deps:

```
npm install three @react-three/fiber @react-three/drei
```

Usage:

```tsx
import LayeredExplorer from '@/components/LayeredFS/LayeredExplorer';
<LayeredExplorer />
```
