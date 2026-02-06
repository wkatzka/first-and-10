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
  // Optional: Use Farcaster's hosted manifest service instead of static file
  // Uncomment and set FARCASTER_MANIFEST_ID to use hosted manifest
  // async redirects() {
  //   const manifestId = process.env.FARCASTER_MANIFEST_ID;
  //   if (!manifestId) return [];
  //   return [
  //     {
  //       source: '/.well-known/farcaster.json',
  //       destination: `https://api.farcaster.xyz/miniapps/hosted-manifest/${manifestId}`,
  //       permanent: false,
  //     },
  //   ];
  // },
  webpack: (config) => {
    // Fix for Web3Auth / MetaMask SDK missing react-native modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

module.exports = nextConfig;
