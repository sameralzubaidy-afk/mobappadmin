// filepath: p2p-kids-admin/src/lib/settingsAudit.ts
//
// Shared helpers for the "settings single source + audit" feature.
//
// Single source of truth for "Last updated" metadata:
//   admin_config.updated_at  (when)  +  admin_config.updated_by  (who, UUID)
// Regardless of whether an admin edits a setting from the /config hub or from a
// standalone settings page, both write paths now record updated_at/updated_by
// on the SAME admin_config row, so every UI surface can render the same
// "Last updated · <ts> · by <email>" label.
//
// Editor emails are resolved via the SECURITY DEFINER RPC fn_resolve_admin_emails
// so the email lookup uses the same trail everywhere (no per-surface divergence).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminConfigMetaRow {
  out_key: string;
  out_value: string;
  out_data_type: string | null;
  out_updated_at: string | null;
  out_updated_by: string | null;
  out_updated_by_email: string | null;
}

/** Current signed-in admin id (used as p_admin_id / updated_by on every save). */
export async function getCurrentAdminId(
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch values + last-updated metadata for a set of admin_config keys.
 * Returns a map key -> meta row. Used by standalone settings pages so each
 * field shows the same "Last updated" info the /config hub shows.
 */
export async function getAdminConfigMeta(
  supabase: SupabaseClient,
  keys: string[]
): Promise<Record<string, AdminConfigMetaRow>> {
  const map: Record<string, AdminConfigMetaRow> = {};
  if (!keys.length) return map;
  try {
    const { data, error } = await supabase.rpc('fn_get_admin_config_meta', {
      p_keys: keys,
    });
    if (error) throw error;
    (data ?? []).forEach((row: AdminConfigMetaRow) => {
      map[row.out_key] = row;
    });
  } catch (err) {
    // Non-fatal: the page still renders values; last-updated just stays hidden.
    console.error('[settingsAudit] getAdminConfigMeta failed:', err);
  }
  return map;
}

/**
 * Resolve a list of admin user ids to emails. Returns a map id -> email.
 * Unknown ids are omitted (callers fall back to "—").
 */
export async function resolveAdminEmails(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return map;
  try {
    const { data, error } = await supabase.rpc('fn_resolve_admin_emails', {
      p_user_ids: unique,
    });
    if (error) throw error;
    (data ?? []).forEach((row: { out_user_id: string; out_email: string }) => {
      map[row.out_user_id] = row.out_email;
    });
  } catch (err) {
    console.error('[settingsAudit] resolveAdminEmails failed:', err);
  }
  return map;
}

/** Human-readable "last updated" helper for a meta row. */
export function formatUpdatedMeta(row?: AdminConfigMetaRow | null): {
  updatedAt: string | null;
  editor: string | null;
} {
  if (!row || !row.out_updated_at) {
    return { updatedAt: null, editor: null };
  }
  let editor: string | null = row.out_updated_by_email ?? null;
  if (!editor && row.out_updated_by) {
    editor = row.out_updated_by; // fall back to the raw id if email lookup failed
  }
  return { updatedAt: row.out_updated_at, editor };
}
