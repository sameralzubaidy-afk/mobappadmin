"use client";

// This component ensures the client-side Sentry SDK initializes in the browser
// by importing the client configuration from the repo's sentry.client.config.ts.
import '../../sentry.client.config';

export default function SentryClientInit(): JSX.Element | null {
  return null;
}
