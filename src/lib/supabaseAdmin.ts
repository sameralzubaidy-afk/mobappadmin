/**
 * Server-only Supabase admin client.
 *
 * MUST ONLY be imported in:
 *  - API routes  (src/app/api/ ** /route.ts)
 *  - Server Components
 *  - Server Actions
 *
 * NEVER import in files marked 'use client' — the service role key must
 * never be bundled into the browser JavaScript.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getAdminSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing server-side Supabase config. Required env vars:\n' +
        '  NEXT_PUBLIC_SUPABASE_URL  (or SUPABASE_URL)\n' +
        '  SUPABASE_SERVICE_ROLE_KEY\n' +
        'These must be set in .env.local WITHOUT the NEXT_PUBLIC_ prefix for the service key.',
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cachedClient;
}
