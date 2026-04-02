import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET;

type PolicyType = 'terms_of_service' | 'privacy_policy' | 'liability_disclaimer';

interface CreatePolicyBody {
  policy_type: PolicyType;
  title: string;
  version: string;
  content: string;
  effective_date: string;
  created_by?: string | null;
}

function isPolicyType(value: string): value is PolicyType {
  return (
    value === 'terms_of_service' ||
    value === 'privacy_policy' ||
    value === 'liability_disclaimer'
  );
}

export async function GET(req: Request) {
  const headerSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SERVICE_KEY || !SUPABASE_URL) {
    return NextResponse.json(
      { error: 'Admin reads are disabled: missing Supabase service role configuration' },
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await supabase
    .from('platform_policies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

export async function POST(req: Request) {
  const headerSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SERVICE_KEY || !SUPABASE_URL) {
    return NextResponse.json(
      { error: 'Admin writes are disabled: missing Supabase service role configuration' },
      { status: 500 }
    );
  }

  let body: CreatePolicyBody;
  try {
    body = (await req.json()) as CreatePolicyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isPolicyType(body.policy_type)) {
    return NextResponse.json({ error: 'Invalid policy_type' }, { status: 400 });
  }

  if (!body.title?.trim() || !body.version?.trim() || !body.content?.trim() || !body.effective_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data, error } = await supabase
    .from('platform_policies')
    .insert({
      policy_type: body.policy_type,
      title: body.title.trim(),
      version: body.version.trim(),
      content: body.content.trim(),
      effective_date: body.effective_date,
      status: 'draft',
      created_by: body.created_by ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505' || error.message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        { error: 'A policy with this type and version already exists', code: 'VERSION_EXISTS' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
