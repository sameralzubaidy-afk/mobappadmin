/**
 * Admin API: Retry failed payout
 * File: p2p-kids-admin/src/app/api/admin/payouts/[id]/retry/route.ts
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-008
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payoutId = params.id;

    // Verify payout exists and is in failed state
    const { data: payout, error: fetchError } = await supabase
      .from('seller_payouts')
      .select('*')
      .eq('id', payoutId)
      .single();

    if (fetchError || !payout) {
      return NextResponse.json(
        { error: 'Payout not found' },
        { status: 404 }
      );
    }

    if (payout.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed payouts can be retried' },
        { status: 400 }
      );
    }

    // Reset payout to pending status for retry
    const { error: updateError } = await supabase
      .from('seller_payouts')
      .update({
        status: 'pending',
        failure_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId);

    if (updateError) {
      console.error('Error resetting payout:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // TODO: Trigger payout processing via Edge Function
    // This would call the appropriate provider payout function
    // For now, we just reset the status

    return NextResponse.json({ 
      success: true,
      message: 'Payout reset to pending for retry' 
    });
  } catch (err: any) {
    console.error('Retry payout error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
