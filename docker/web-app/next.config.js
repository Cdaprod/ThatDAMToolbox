// /webapp/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // --------------------------------------------------------
  // HTTP-only rewrites for /api/video/*
  // --------------------------------------------------------
  async rewrites() {
    return [
      {
        source: '/api/video/:path*',
        // MUST start with http(s):// or a root‐relative path
        destination:
          `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/video/:path*`,
      },
    ]
  },

  images: {
    domains: ['localhost'],
    // disable Next’s optimizer in dev so you don’t need an external loader
    unoptimized: process.env.NODE_ENV === 'development',
  },

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },

  // --------------------------------------------------------
  // Browser‐visible env vars: only NEXT_PUBLIC_*
  // --------------------------------------------------------
  env: {
    // If you actually need CUSTOM_KEY in the browser, give it a default here:
    // CUSTOM_KEY: process.env.CUSTOM_KEY || '',
  },

  // --------------------------------------------------------
  // Next.js 14+ "appDir" is no longer experimental
  // --------------------------------------------------------
  // If you’re using the new "/app" directory, just set it at top level:
  appDir: true,
}

module.exports = nextConfig