// /docker/web-app/next.config.mjs
import path from 'path';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const USE_LEGACY = process.env.USE_LEGACY_VIDEO_API === '1';
const GATEWAY_BASE =
  process.env.GATEWAY_BASE_URL ?? 'http://host.docker.internal:8080';
const LEGACY_BASE =
  process.env.LEGACY_VIDEO_API_URL ?? GATEWAY_BASE;
const API_BASE = USE_LEGACY ? LEGACY_BASE : GATEWAY_BASE;

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  output: 'standalone', // produce .next/standalone
  async rewrites() {
    return [
      // backend API (Go by default, Python when USE_LEGACY_VIDEO_API=1)
      {
        source: '/api/video/:path*',
        destination: `${API_BASE}/${USE_LEGACY ? 'api/video' : 'v1'}/:path*`,
      },
      // live capture / preview
      { source: '/live/:path*', destination: `${API_BASE}/hwcapture/live/:path*` },
      // explorer
      { source: '/api/assets', destination: `${API_BASE}/v1/assets` },
      { source: '/folders', destination: `${API_BASE}/v1/folders` },
    ];
  },

  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [
      // cache Next static assets aggressively in prod, disable in dev to avoid stale chunks
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-store'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // thumbs
      {
        source: '/assets/thumbs/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
      // api (short cache + SWR)
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=5, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },

  images: {
    // Next 14 prefers remotePatterns; keep localhost + LAN + host.docker.internal
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '192.168.0.22' },
      { protocol: 'http', hostname: 'host.docker.internal' },
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  webpack(config, { dev }) {
    // alias “@” to /src and friends
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(process.cwd(), 'src'),
      '@components': path.resolve(process.cwd(), 'src/components'),
      '@app': path.resolve(process.cwd(), 'src/app'),
      '@lib': path.resolve(process.cwd(), 'src/lib'),
      '@styles': path.resolve(process.cwd(), 'src/styles'),
      '@providers': path.resolve(process.cwd(), 'src/providers'),
    };

    // help Docker bind mounts on some hosts
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**'],
      };
    }

    return config;
  },

  // Do NOT include webpackDevMiddleware in Next 14 (it's invalid)
  // env: prefer .env.* files; keep empty here intentionally
};

export default function nextConfig(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...baseConfig,
      // keep compiled pages/API routes resident in dev longer
      onDemandEntries: {
        // default ~25s; bump to 5 minutes so edits don’t constantly evict
        maxInactiveAge: 300 * 1000,
        // default 2; hold more compiled entries before disposing
        pagesBufferLength: 20,
      },
      // helpful when you’re hitting from phone or other LAN hosts in dev
      // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
      allowedDevOrigins: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://192.168.0.22:3000',
      ],
    };
  }
  return baseConfig;
}
