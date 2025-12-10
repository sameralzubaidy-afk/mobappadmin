/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true
  },
  eslint: { dirs: ['src'] }
};

module.exports = nextConfig;
