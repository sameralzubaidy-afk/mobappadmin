// PROD-010: Centralized admin authentication middleware.
//
// Provides a SINGLE source of truth for verifying that an inbound request
// to any /api/admin/* route comes from an authorized admin.
//
// Two supported auth methods (checked in order):
//   1. `x-admin-secret` header equals `ADMIN_UI_SECRET` env (server-to-server / trusted UI)
//   2. `Authorization: Bearer <jwt>` from Supabase Auth + `is_admin()` RPC returns true
//
// Security rules (PROD-010):
//   - NEVER fall back to NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY (would expose secret to the client bundle).
//   - The server-only `SUPABASE_SERVICE_ROLE_KEY` env is NOT used here; verification uses the user JWT + anon key.
//   - Returns structured { authorized, adminId?, error? } so callers can return 401 with a clear message.
//
// Usage:
//   ```ts
//   import { verifyAdminAuth } from '@/lib/adminAuth';
//   export async function POST(req: NextRequest) {
//     const auth = await verifyAdminAuth(req);
//     if (!auth.authorized) {
//       return NextResponse.json({ error: auth.error }, { status: 401 });
//     }
//     // ... admin operation
//   }
//   ```
//
// Migration roadmap: see docs/PROD-010-ADMIN-AUTH-MIGRATION.md

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface AdminAuthResult {
  authorized: boolean;
  adminId?: string;
  error?: string;
}

// Server-only secret. Do NOT use NEXT_PUBLIC_* fallback.
function getAdminSecret(): string | undefined {
  return process.env.ADMIN_UI_SECRET;
}

function getSupabaseConfig(): { url: string; anonKey: string } | null {
  // SUPABASE_URL is intentionally allowed as either NEXT_PUBLIC_* or server-only
  // because the URL is non-secret. The anon key is also designed to be public.
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Verify the request is authorized to call an admin API route.
 *
 * Method 1: `x-admin-secret` header matches `ADMIN_UI_SECRET` env (constant-time check).
 * Method 2: Supabase JWT in `Authorization` header + `is_admin()` RPC returns true.
 *
 * @returns `{ authorized: true, adminId }` on success; `{ authorized: false, error }` on failure.
 */
export async function verifyAdminAuth(
  req: NextRequest | Request
): Promise<AdminAuthResult> {
  // -- Method 1: shared admin secret -----------------------------------------
  const presentedSecret = req.headers.get('x-admin-secret');
  const expectedSecret = getAdminSecret();
  if (presentedSecret && expectedSecret) {
    if (constantTimeEqual(presentedSecret, expectedSecret)) {
      return { authorized: true, adminId: 'admin-secret' };
    }
    // Presented but mismatched: do not silently fall through to method 2.
    return { authorized: false, error: 'Invalid admin secret' };
  }

  // -- Method 2: Supabase JWT + is_admin() -----------------------------------
  const authorization = req.headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.substring(7).trim();
    if (!token) {
      return { authorized: false, error: 'Empty bearer token' };
    }

    const cfg = getSupabaseConfig();
    if (!cfg) {
      return { authorized: false, error: 'Server configuration error' };
    }

    const supabase = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { authorized: false, error: 'Invalid or expired session' };
    }

    const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
    if (rpcError) {
      return { authorized: false, error: 'Admin role check failed' };
    }
    if (!isAdmin) {
      return { authorized: false, error: 'User is not an admin' };
    }

    return { authorized: true, adminId: user.id };
  }

  return { authorized: false, error: 'No valid authentication provided' };
}

// Constant-time string comparison to avoid timing side-channels on the secret.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
