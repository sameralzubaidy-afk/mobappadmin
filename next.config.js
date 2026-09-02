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
  // DEV-TASK-62 env fix (2026-08-31): the admin dev server repeatedly corrupts
  // its on-disk webpack cache ("Cannot find module './XXXX.js'" in
  // webpack-runtime.js + webpack.cache.PackFileCacheStrategy ENOENT on
  // vendor-chunks), taking the portal down until .next is cleared. Disable the
  // filesystem cache in development only — production builds keep caching.
  // (Root causes seen: multiple next dev/Playwright-spawned servers sharing one
  // .next dir, PLUS long-running single-server cache corruption. This + running
  // only one server prevents both.)
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
