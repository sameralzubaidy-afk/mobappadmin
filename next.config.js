/** @type {import('next').NextConfig} */
const nextConfig = {
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
