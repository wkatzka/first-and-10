/**
 * Next.js config.
 * API rewrites: /api/* and /cards/* go to the backend.
 * - Testing environment: NEXT_PUBLIC_API_URL=http://localhost:4000
 * - Live environment: NEXT_PUBLIC_API_URL = deployed backend URL
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Default = testing environment (backend on 4000). Live sets env at build.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/cards/:path*',
        destination: `${apiUrl}/cards/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
