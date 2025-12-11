/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
    // Experimental instrumentation hook for Next.js App Router. Enable
    // the feature — the framework will load ./instrumentation.ts automatically.
    instrumentationHook: true,
  },
  eslint: { dirs: ['src'] }
};

// Use Sentry's NextJS wrapper in build mode — safe if SENTRY_DSN not set
const sentryWebpackPluginOptions = {
  silent: true, // Suppresses all logs
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
