// /docker/web-app/next.config.mjs
import path from 'path';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://host.docker.internal:8080';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // produce .next/standalone
  async rewrites() {
    return [
      // video-api
      { source: '/api/video/:path*', destination: `${API_BASE}/api/video/:path*` },
      // live capture / preview
      { source: '/live/:path*', destination: `${API_BASE}/hwcapture/live/:path*` },
      // explorer
      { source: '/api/assets', destination: `${API_BASE}/explorer/assets` },
      { source: '/folders', destination: `${API_BASE}/explorer/folders` },
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

export default nextConfig;
