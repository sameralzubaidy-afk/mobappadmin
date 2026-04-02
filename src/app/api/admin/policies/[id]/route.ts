import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

interface RouteParams {
  params: { id: string };
}

interface UpdatePolicyBody {
  title?: string;
  content?: string;
  effective_date?: string;
}

interface PublishBody {
  action?: 'publish';
  admin_id?: string | null;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function missingConfig(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getClient() {
  return createClient(SUPABASE_URL || '', SERVICE_KEY || '');
}

function validateSecret(req: Request) {
  const headerSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
    return false;
  }

  return true;
}

export async function GET(req: Request, { params }: RouteParams) {
  if (!validateSecret(req)) {
    return unauthorized();
  }

  if (!SERVICE_KEY || !SUPABASE_URL) {
    return missingConfig('Admin reads are disabled: missing Supabase service role configuration');
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from('platform_policies')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  if (!validateSecret(req)) {
    return unauthorized();
  }

  if (!SERVICE_KEY || !SUPABASE_URL) {
    return missingConfig('Admin writes are disabled: missing Supabase service role configuration');
  }

  let body: UpdatePolicyBody;
  try {
    body = (await req.json()) as UpdatePolicyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof body.title === 'string') {
    updatePayload.title = body.title.trim();
  }
  if (typeof body.content === 'string') {
    updatePayload.content = body.content.trim();
  }
  if (typeof body.effective_date === 'string') {
    updatePayload.effective_date = body.effective_date;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = getClient();

  const { data: currentPolicy, error: currentPolicyError } = await supabase
    .from('platform_policies')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle();

  if (currentPolicyError) {
    return NextResponse.json(
      { error: currentPolicyError.message, code: currentPolicyError.code },
      { status: 500 }
    );
  }

  if (!currentPolicy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  if (currentPolicy.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft policies can be edited' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('platform_policies')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(req: Request, { params }: RouteParams) {
  if (!validateSecret(req)) {
    return unauthorized();
  }

  if (!SERVICE_KEY || !SUPABASE_URL) {
    return missingConfig('Admin writes are disabled: missing Supabase service role configuration');
  }

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    body = {};
  }

  if (body.action !== 'publish') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const supabase = getClient();
  let adminId = body.admin_id ?? null;

  if (!adminId) {
    const { data: currentPolicy, error: currentPolicyError } = await supabase
      .from('platform_policies')
      .select('created_by')
      .eq('id', params.id)
      .maybeSingle();

    if (currentPolicyError) {
      return NextResponse.json(
        { error: currentPolicyError.message, code: currentPolicyError.code },
        { status: 500 }
      );
    }

    adminId = currentPolicy?.created_by ?? null;
  }

  if (!adminId) {
    return NextResponse.json({ error: 'Missing admin_id for publish action' }, { status: 400 });
  }

  const { data: adminAccess, error: adminAccessError } = await supabase
    .from('role_based_access_control')
    .select('user_id')
    .eq('user_id', adminId)
    .eq('role', 'admin')
    .maybeSingle();

  if (adminAccessError) {
    return NextResponse.json(
      { error: adminAccessError.message, code: adminAccessError.code },
      { status: 500 }
    );
  }

  if (!adminAccess) {
    return NextResponse.json(
      { error: 'Unauthorized: Only admins can publish policies' },
      { status: 403 }
    );
  }

  const { data: targetPolicy, error: targetPolicyError } = await supabase
    .from('platform_policies')
    .select('id, policy_type, status, effective_date')
    .eq('id', params.id)
    .maybeSingle();

  if (targetPolicyError) {
    return NextResponse.json(
      { error: targetPolicyError.message, code: targetPolicyError.code },
      { status: 500 }
    );
  }

  if (!targetPolicy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  if (targetPolicy.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft policies can be published' }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  const { error: archiveError } = await supabase
    .from('platform_policies')
    .update({
      status: 'archived',
      updated_at: nowIso,
    })
    .eq('policy_type', targetPolicy.policy_type)
    .eq('status', 'published')
    .neq('id', params.id);

  if (archiveError) {
    return NextResponse.json({ error: archiveError.message, code: archiveError.code }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('platform_policies')
    .update({
      status: 'published',
      published_by: adminId,
      published_at: nowIso,
      effective_date: targetPolicy.effective_date ?? nowIso,
      updated_at: nowIso,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
