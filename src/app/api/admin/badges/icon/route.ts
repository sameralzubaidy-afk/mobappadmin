import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActingAdminId } from '@/lib/adminAuth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isUnauthorized(request: NextRequest): boolean {
  const headerSecret = request.headers.get('x-admin-secret');
  return !!ADMIN_SECRET && headerSecret !== ADMIN_SECRET;
}

/** Extract the storage object path from a public icon URL, if any. */
function extractObjectPath(publicUrl: string): string | null {
  const marker = '/object/public/badge-icons/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = publicUrl.substring(idx + marker.length).split('?')[0];
  return raw && raw.length > 0 ? decodeURIComponent(raw) : null;
}

/**
 * DELETE /api/admin/badges/icon
 *
 * Removes a badge icon: deletes the storage object in the `badge-icons` bucket
 * (service role, bypasses RLS) and clears `badges.icon_url`. DEV-TASK-117
 * (item 6): prior QA runs left disposable test icons on badges with no way to
 * remove them via the UI (badge `3ac79591` P02 residue; `d886e2af`). Mirrors
 * the upload route's auth + the `badges-update-icon` EF's audit-write shape.
 *
 * Requires the acting admin's Bearer JWT (like the upload EF) so the
 * `badge_audit_logs` row records a real admin — both `user_id` and `admin_id`
 * are NOT NULL on that table, so a secret-only call is rejected.
 *
 * Body: { badgeId }
 * Returns: { success: true, badge_id }
 */
export async function DELETE(request: NextRequest) {
  if (isUnauthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase server configuration' },
      { status: 500 }
    );
  }

  // The badge_audit_logs row needs a real acting admin (user_id/admin_id are
  // NOT NULL). Secret-only automation cannot satisfy that — reject it.
  const actorId = await getActingAdminId(request);
  if (!actorId) {
    return NextResponse.json(
      { error: 'A signed-in admin session is required to remove a badge icon' },
      { status: 401 }
    );
  }

  let body: { badgeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const badgeId = body?.badgeId?.trim();
  if (!badgeId) {
    return NextResponse.json({ error: 'badgeId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: badge, error: badgeError } = await supabase
    .from('badges')
    .select('id, icon_url')
    .eq('id', badgeId)
    .maybeSingle();

  if (badgeError) {
    return NextResponse.json(
      { error: `Failed to load badge: ${badgeError.message}` },
      { status: 500 }
    );
  }
  if (!badge) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  const currentUrl: string | null = badge.icon_url ?? null;

  // 1) Best-effort storage object removal (a failure here must not block the
  //    DB clear — the URL is removed either way; orphaned objects are swept).
  let storageError: string | null = null;
  const objectPath = currentUrl ? extractObjectPath(currentUrl) : null;
  if (objectPath) {
    const { error } = await supabase.storage
      .from('badge-icons')
      .remove([objectPath]);
    if (error) {
      storageError = error.message;
      console.error(
        `[Badge icon] storage remove failed for ${objectPath}:`,
        error.message
      );
    }
  }

  // 2) Clear badges.icon_url
  const { error: updateError } = await supabase
    .from('badges')
    .update({ icon_url: null, updated_at: new Date().toISOString() })
    .eq('id', badgeId);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to clear badge icon: ${updateError.message}` },
      { status: 500 }
    );
  }

  // 3) Audit row (mirror badges-update-icon EF shape)
  try {
    const { error: auditError } = await supabase.from('badge_audit_logs').insert({
      badge_id: badgeId,
      user_id: actorId,
      admin_id: actorId,
      action_type: 'config_change',
      reason: 'Icon removed from admin portal',
      metadata: { removed_url: currentUrl, storage_error: storageError },
    });
    if (auditError) {
      console.error('[Badge icon] audit insert failed:', auditError.message);
    }
  } catch (e: any) {
    console.error('[Badge icon] audit insert exception:', e?.message);
  }

  return NextResponse.json(
    { success: true, badge_id: badgeId, storage_error: storageError },
    { status: 200 }
  );
}
