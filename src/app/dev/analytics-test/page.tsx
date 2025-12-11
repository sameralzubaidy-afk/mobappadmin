"use client";

import React from 'react';
import { trackEvent } from '@/lib/analytics';

export default function AnalyticsTestPage() {
  const sendTestEvent = () => {
    trackEvent('admin_test_event', { sentAt: new Date().toISOString() });
    alert('Amplitude admin test event sent. Check Amplitude Live View');
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>Amplitude Test</h1>
      <p>Send a test event to Amplitude live view.</p>
      <button onClick={sendTestEvent} style={{ padding: '8px 12px' }}>
        Send admin_test_event
      </button>
    </div>
  );
}
