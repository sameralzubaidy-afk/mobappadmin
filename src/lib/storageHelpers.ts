import { createClient } from '@supabase/supabase-js';
import { getCdnUrlFromPublicUrl } from './cdn';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

export async function deleteImageAndPurge(bucket: string, path: string) {
  const { error } = await adminClient.storage.from(bucket).remove([path]);
  if (error) return { error };

  try {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    const cdnUrl = getCdnUrlFromPublicUrl(publicUrl);
    const purgeEndpoint = process.env.SUPABASE_PURGE_ENDPOINT;
    const purgeKey = process.env.SUPABASE_PURGE_X_API_KEY;
    if (purgeEndpoint && purgeKey) {
      await fetch(purgeEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': purgeKey }, body: JSON.stringify({ urls: [cdnUrl] }) });
    }
  } catch (e) {
    console.warn('Cache purge failed', e);
  }

  return { error: null };
}
