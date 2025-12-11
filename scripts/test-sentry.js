/* Test script to ensure Sentry server initialization works and captureException can be called. */
require('dotenv').config({ path: '.env.local' });
const Sentry = require('@sentry/nextjs');

function main() {
  try {
    const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!DSN) {
      console.error('Missing Sentry DSN in environment.');
      process.exit(1);
    }
    Sentry.init({ dsn: DSN, tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE || 0.05) });
    Sentry.captureException(new Error('Test Sentry event from admin script'));
    console.log('Sentry test event invoked (admin)');
  } catch (err) {
    console.error('Sentry test failed', err);
    process.exit(1);
  }
}

main();
