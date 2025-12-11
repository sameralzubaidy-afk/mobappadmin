import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Capture 10% of traces for client-side by default (tune per tier)
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE || 0.1),
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
  release: process.env.NEXT_PUBLIC_RELEASE || undefined,
});

export default Sentry;
