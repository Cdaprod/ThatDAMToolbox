# Proxy Viewer

Edge-friendly viewer for live camera preview.
Automatically reconciles available devices from `camera-proxy`.

## Development

```sh
npm install
npm run dev
```

### Tests

```sh
npm test
```

## Build

```sh
BASE_PATH=/viewer/ VITE_DEFAULT_SOURCE=daemon:cam1 npm run build
```

The build outputs static files in `dist/`.

### Environment variables

- `BASE_PATH` – viewer mount path (default `/viewer/`)
- `VITE_DEFAULT_SOURCE` – fallback stream id when no device is provided

### Caching

A service worker precaches assets for offline use. Disabled during `npm run dev`.

### Mobile support

`index.html` includes a responsive viewport and basic metadata.
