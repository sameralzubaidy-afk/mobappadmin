export default function SentryDevTestPage() {
  // Throw a server-side render-time error intentionally to validate the instrumentation
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Sentry dev test - throw from server render');
  }
}
