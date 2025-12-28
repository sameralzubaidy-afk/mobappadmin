// filepath: p2p-kids-admin/src/app/api/admin/payout-fees/route.ts
// Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-002)
// Description: API route for managing payout fee configuration

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PAYOUT_FEE_KEYS = [
  'payout_fee_stripe_fixed_cents',
  'payout_fee_stripe_percentage',
  'payout_fee_paypal_percentage',
  'payout_fee_paypal_cap_cents',
  'payout_fee_venmo_percentage',
  'payout_fee_venmo_cap_cents',
  'payout_fee_bank_ach_cents',
];

export async function GET() {
  try {
    // Fetch all payout fee config from admin_config
    const { data, error } = await supabase
      .from('admin_config')
      .select('*')
      .in('key', PAYOUT_FEE_KEYS)
      .order('key');

    if (error) {
      console.error('Error fetching payout fee config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch from RPC for comparison
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_payout_fee_config');

    if (rpcError) {
      console.error('Error fetching payout fee config via RPC:', rpcError);
    }

    return NextResponse.json({
      data: data || [],
      rpc_data: rpcData?.[0] || null,
      can_write: true,
    });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    if (!PAYOUT_FEE_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid payout fee key' }, { status: 400 });
    }

    // Validate value types
    if (key.includes('percentage')) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0 || numValue > 100) {
        return NextResponse.json({ error: 'Percentage must be between 0 and 100' }, { status: 400 });
      }
    } else if (key.includes('cents')) {
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 0) {
        return NextResponse.json({ error: 'Cents must be a non-negative integer' }, { status: 400 });
      }
    }

    // Update config using upsert_admin_config RPC
    const { data, error } = await supabase.rpc('upsert_admin_config', {
      p_key: key,
      p_value: value.toString(),
    });

    if (error) {
      console.error('Error updating payout fee config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
