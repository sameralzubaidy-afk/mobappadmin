import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

const ALLOWED_ICON_TYPES = ['image/png', 'image/svg+xml'];
const MAX_ICON_SIZE_BYTES = 500 * 1024;

type IconType = 'category' | 'bonus_badge';

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

function isIconType(value: string): value is IconType {
  return value === 'category' || value === 'bonus_badge';
}

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

  const categoryIdRaw = formData.get('categoryId');
  const iconTypeRaw = formData.get('iconType');
  const filePart = formData.get('file');

  if (typeof categoryIdRaw !== 'string' || categoryIdRaw.trim().length === 0) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }

  if (typeof iconTypeRaw !== 'string' || !isIconType(iconTypeRaw)) {
    return NextResponse.json({ error: 'iconType must be category or bonus_badge' }, { status: 400 });
  }

  if (!filePart || typeof filePart === 'string') {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const categoryId = categoryIdRaw.trim();
  const iconType = iconTypeRaw;
  const file = filePart as File;

  if (!ALLOWED_ICON_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PNG and SVG files are supported.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_ICON_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File is too large. Maximum size is 500 KB.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: categoryRow, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle();

  if (categoryError) {
    return NextResponse.json(
      { error: `Failed to validate category: ${categoryError.message}` },
      { status: 500 }
    );
  }

  if (!categoryRow) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const ext = file.type === 'image/svg+xml' ? 'svg' : 'png';
  const filePath = `category-icons/${categoryId}/${iconType}.${ext}`;

  const stalePaths = [
    `category-icons/${categoryId}/${iconType}.png`,
    `category-icons/${categoryId}/${iconType}.svg`,
  ];

  await supabase.storage.from('category-icons').remove(stalePaths);

  const uploadBuffer = Buffer.from(await file.arrayBuffer());

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('category-icons')
    .upload(filePath, uploadBuffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Failed to upload file: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from('category-icons')
    .getPublicUrl(uploadData.path);

  if (!publicUrlData?.publicUrl) {
    return NextResponse.json(
      { error: 'Upload succeeded but failed to generate a public URL' },
      { status: 500 }
    );
  }

  const updateColumn = iconType === 'category' ? 'icon_url' : 'bonus_badge_icon_url';
  const { error: updateError } = await supabase
    .from('categories')
    .update({ [updateColumn]: publicUrlData.publicUrl })
    .eq('id', categoryId);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update category icon URL: ${updateError.message}`, code: updateError.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 200 });
}
