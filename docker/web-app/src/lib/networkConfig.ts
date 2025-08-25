// /src/lib/networkConfig.ts

// Defaults for host-mode, local dev, and mobile clients
const API_PORT = Number(process.env.API_PORT) || 8080;
const WS_PORT = 8080;
const API_PATH_PREFIX = '';      // e.g. '/api' if your backend is not at root
const WS_PATH_DEFAULT = '/ws/camera';

// Safe Base URL function for API
export function apiBaseUrlServer() {
  // Prefer private env var for server-side, fallback for local dev
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  // Legacy Python service optional via flag
  if (process.env.USE_LEGACY_VIDEO_API === '1')
    return process.env.LEGACY_VIDEO_API_URL || 'http://localhost:8080';
  // Default to Go services
  return (
    process.env.GATEWAY_BASE_URL ||
    process.env.MEDIA_API_BASE ||
    'http://localhost:8080'
  );
}

// All "magic" is private--only expose apiUrl and wsUrl!
function inBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

function getHostAndPort(defaultPort: number): { host: string, port: string } {
  if (inBrowser()) {
    const host = window.location.hostname;
    const port = window.location.port || String(defaultPort);
    return { host, port };
  }
  // fallback--used only if running in SSR/build (should never hit)
  return { host: 'localhost', port: String(defaultPort) };
}

function fullUrl(proto: string, host: string, port: string, path: string) {
  // Remove accidental slashes
  let url = `${proto}//${host}:${port}${path}`;
  return url.replace(/([^:]\/)\/+/g, "$1");
}

// The only two things you ever import!
export function apiUrl(path: string = ''): string {
  // 1. Use env override (for Vercel, prod builds, CI, etc)
  if (process.env.NEXT_PUBLIC_API_BASE_URL)
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '') + path;

  // 2. Server-side: respect API_BASE_URL for cross-container calls
  if (!inBrowser()) return apiBaseUrlServer().replace(/\/$/, '') + path;

  // 3. Build from runtime location--just works in browser
  const { host, port } = getHostAndPort(API_PORT);
  const proto = window.location.protocol;
  return fullUrl(proto, host, port, API_PATH_PREFIX + path);
}

export function wsUrl(subPath: string = WS_PATH_DEFAULT): string {
  if (process.env.NEXT_PUBLIC_WS_URL)
    return process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, '') + subPath;

  const { host, port } = getHostAndPort(WS_PORT);
  const wsProto = inBrowser() && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return fullUrl(wsProto, host, port, subPath);
}

// ----- That’s it! -----
//
// (if you ever want to expand, add helpers below or as comments)
//
// Example future expansion:
// export function isMobile() { ... }
// export function getDefaultHeaders() { ... }