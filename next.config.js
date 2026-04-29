/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'drntwgporzabmxdqykrp.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

module.exports = nextConfig;
