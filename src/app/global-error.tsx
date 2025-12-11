"use client";

import * as Sentry from '@sentry/nextjs';
import React, { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Capture the client-side rendering error in Sentry
    try {
      Sentry.captureException(error);
    } catch {
      // Fall through in case Sentry isn't configured
      // This should not block the app in production or during builds.
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 24 }}>
          <h1>Something went wrong</h1>
          <p>We captured this error and sent it to our monitoring service.</p>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
