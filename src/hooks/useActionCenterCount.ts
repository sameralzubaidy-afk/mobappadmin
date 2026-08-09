// File: p2p-kids-admin/src/hooks/useActionCenterCount.ts
// Shared live count for the Action Center (sidebar badge + header bell badge).
//
// Fetches GET /api/admin/action-center (summary) and exposes the total pending
// action count. Polls every 60s so the badges stay roughly current without
// hammering the API. Gracefully degrades to 0 on error — a broken badge must
// never block navigation.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 60_000;

interface ActionCenterCount {
  total: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useActionCenterCount(): ActionCenterCount {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const mounted = useRef(true);


  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch('/api/admin/action-center', {
        headers: {
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Action center API ${res.status}`);
      }
      const json = await res.json();
      const next = Number(json?.data?.total ?? 0);
      if (mounted.current) {
        setTotal(Number.isFinite(next) ? next : 0);
      }
    } catch (err) {
      // Non-fatal: keep the last known count; a network blip must not crash the shell.
      console.warn('[action-center-count] refresh failed', err);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  return { total, loading, refresh };
}
