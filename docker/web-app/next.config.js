// /webapp/next.config.js
const path = require('path');

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
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/video/:path*`,
      },
    ];
  },

  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  webpack: (config, { dev, isServer }) => {
    // 1) teach webpack that '@' roots at your /src dir
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@app': path.resolve(__dirname, 'src/app'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@providers': path.resolve(__dirname, 'src/providers'),
      // add more if needed
    };

    // 2) for polling in dev
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },

  env: {
    // Add any env var defaults if needed.
    // CUSTOM_KEY: process.env.CUSTOM_KEY || '',
  },
};

module.exports = nextConfig;