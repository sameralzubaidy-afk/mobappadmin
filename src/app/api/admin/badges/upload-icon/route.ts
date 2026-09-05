import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

// Mirrors the allowed types validated in BadgeEditor/badgeUtils.
const ALLOWED_BADGE_ICON_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
const MAX_ICON_SIZE_BYTES = 5 * 1024 * 1024;

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

/**
 * POST /api/admin/badges/upload-icon
 *
 * Uploads a badge icon to the `badge-icons` storage bucket using the
 * SERVICE ROLE key (bypasses RLS). This mirrors the working category-icon
 * upload path (`/api/admin/categories/upload-icon`) — the previous client-side
 * upload used an authenticated (anon) client whose INSERT was rejected by the
 * `badge-icons` storage RLS policy. The DB write (badges.icon_url) stays with
 * the `badges-update-icon` Edge Function, which also validates the admin and
 * records an audit row.
 *
 * Body: multipart/form-data with `badgeId` + `file`.
 * Returns: { url } — the public URL of the uploaded icon.
 */
export async function POST(request: NextRequest) {
  if (isUnauthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase server configuration' },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const badgeIdRaw = formData.get('badgeId');
  const filePart = formData.get('file');

  if (typeof badgeIdRaw !== 'string' || badgeIdRaw.trim().length === 0) {
    return NextResponse.json({ error: 'badgeId is required' }, { status: 400 });
  }

  if (!filePart || typeof filePart === 'string') {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const badgeId = badgeIdRaw.trim();
  const file = filePart as File;

  if (!ALLOWED_BADGE_ICON_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PNG, JPEG, WebP, SVG' },
      { status: 400 }
    );
  }

  if (file.size > MAX_ICON_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File is too large. Maximum size is 5 MB.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: badgeRow, error: badgeError } = await supabase
    .from('badges')
    .select('id')
    .eq('id', badgeId)
    .maybeSingle();

  if (badgeError) {
    return NextResponse.json(
      { error: `Failed to validate badge: ${badgeError.message}` },
      { status: 500 }
    );
  }

  if (!badgeRow) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `icons/${badgeId}-${Date.now()}.${ext}`;

  const uploadBuffer = Buffer.from(await file.arrayBuffer());

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('badge-icons')
    .upload(filePath, uploadBuffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Failed to upload file: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from('badge-icons')
    .getPublicUrl(uploadData.path);

  if (!publicUrlData?.publicUrl) {
    return NextResponse.json(
      { error: 'Upload succeeded but failed to generate a public URL' },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 200 });
}
