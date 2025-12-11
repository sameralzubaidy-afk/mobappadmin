"use client";

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/analytics';

export default function AnalyticsClientInit(): JSX.Element | null {
  useEffect(() => {
    initAnalytics();
  }, []);

  return null;
}
