// /webapp/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,
  
  // Standalone output for Docker production builds
  output: 'standalone',
  
  // API proxy for development (routes /api/video/* to your Python API)
  async rewrites() {
    return [
      {
        source: '/api/video/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/:path*`,
      },
      {
        // if you have a WebSocket endpoint
        source: '/ws/:path*',
        destination: `${process.env.NEXT_PUBLIC_WS_URL}/:path*`
      }
    ];
  },
  
  // Image optimization settings
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Webpack configuration for development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Enable polling for file watching in containers
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  
  // Environment variables available to the browser
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Experimental features
  experimental: {
    // Enable App Router (Next.js 13+)
    appDir: true,
  },
};

module.exports = nextConfig;