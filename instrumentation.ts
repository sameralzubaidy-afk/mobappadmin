import * as Sentry from '@sentry/nextjs';

export function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || 0.05),
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_RELEASE || undefined,
  });
}

export function unregister() {
  // This is a noop function here as Sentry doesn't provide a public
  // unregister API for the browser/server. Hook implements the lifecycle
  // function and we keep it for parity with the instrumentation API.
  return;
}
