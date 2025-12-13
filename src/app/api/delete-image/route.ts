import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { deleteImageAndPurge } from '@/lib/storageHelpers';

// Validation schema for delete request
const DeleteImageSchema = z.object({
  bucket: z.string().min(1, 'Bucket name required'),
  path: z.string().min(1, 'Image path required'),
  idempotencyKey: z.string().optional(),
});

type DeleteImageRequest = z.infer<typeof DeleteImageSchema>;

/**
 * Admin-only API route to delete image and purge from CDN cache.
 * Requires:
 * - Authorization header with valid JWT
 * - User must have admin role
 * - Valid bucket and path in request body
 */
export async function POST(req: Request) {
  try {
    // 1. Extract and verify JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('[DELETE-IMAGE] Missing or invalid Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify token and get user
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      console.warn('[DELETE-IMAGE] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // 2. Check user role (admin-only)
    const userId = userData.user.id;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.warn(`[DELETE-IMAGE] User ${userId} does not have admin role`);
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 3. Validate request payload
    const body = await req.json();
    const validationResult = DeleteImageSchema.safeParse(body);
    if (!validationResult.success) {
      console.warn('[DELETE-IMAGE] Invalid request payload:', validationResult.error.flatten());
      return NextResponse.json(
        {
          error: 'Bad Request: Invalid parameters',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { bucket, path, idempotencyKey } = validationResult.data;

    console.log(`[DELETE-IMAGE] Admin ${userId} deleting image: ${bucket}/${path}`);

    // 4. Delete image and purge cache
    const result = await deleteImageAndPurge(bucket, path);
    if (result.error) {
      console.error(`[DELETE-IMAGE] Failed to delete image: ${result.error.message}`);
      return NextResponse.json(
        { error: 'Failed to delete image', details: result.error.message },
        { status: 500 }
      );
    }

    console.log(`[DELETE-IMAGE] Successfully deleted and purged: ${bucket}/${path}`);
    return NextResponse.json(
      {
        ok: true,
        message: 'Image deleted and purged from cache',
        bucket,
        path,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('[DELETE-IMAGE] Unexpected error:', e);
    return NextResponse.json(
      { error: 'Internal Server Error', details: e.message },
      { status: 500 }
    );
  }
}
