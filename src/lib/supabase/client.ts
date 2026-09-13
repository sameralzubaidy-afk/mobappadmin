// File: p2p-kids-admin/src/lib/supabase/client.ts
//
// Single shared Supabase BROWSER client for the admin portal (FIX-Task-23 item 2).
//
// WHY THIS EXISTS
//   Every client component used to build its OWN client at module scope, so each
//   page/layout mount added another GoTrue instance to the same browser context.
//   Two symptoms followed:
//     1. the console warning `Multiple GoTrueClient instances detected in the same
//        browser context` (the precondition), and
//     2. a contended `lock:sb-<ref>-auth-token` Web Lock — a suspended page could
//        hold it with pending waiters, so `supabase.auth.getUser()` in the auth
//        gate never settled and the portal sat on "Loading…" forever.
//
//   One memoized instance per browser tab removes the precondition for that
//   deadlock. Server-side clients are intentionally NOT consolidated here:
//   `src/app/api/**` route handlers keep their per-request service-role client
//   (see `./server.ts`), which is correct and does not touch the browser lock.
//
// LAZY BY DESIGN
//   Nothing is constructed at import time, so importing this module is safe in unit
//   tests (which run without NEXT_PUBLIC_* env vars) and in any server-rendered pass.
//   The lazy `Proxy` below means existing call sites keep working unchanged:
//   `supabase.from(...)`, `supabase.auth.getUser()`, `supabase.channel(...)`.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/** Returns the shared browser client, creating it on first use. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      // Deliberately log rather than throw: this preserves the previous behaviour
      // exactly (supabase-js itself throws "supabaseUrl is required" when the env
      // is genuinely missing) while keeping unit tests — which run without
      // NEXT_PUBLIC_* env and mock @supabase/supabase-js — able to import modules
      // that use this helper.
      console.error(
        '[supabase/client] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
          'Copy p2p-kids-admin/.env.local.example to .env.local and restart the dev server.'
      );
    }
    browserClient = createClient(url ?? '', anonKey ?? '');
  }
  return browserClient;
}

/**
 * Drop-in replacement for the per-file `createClient(...)` instances: importing it
 * never constructs anything, and the first property access initializes the single
 * shared client. Methods are bound to the real client so `this` is correct.
 */
export const supabaseBrowser: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseBrowserClient() as unknown as object;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
