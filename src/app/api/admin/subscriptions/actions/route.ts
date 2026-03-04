// filepath: p2p-kids-admin/src/app/api/admin/subscriptions/actions/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * POST /api/admin/subscriptions/actions
 * 
 * Admin actions for subscription management:
 * - manually_cancel: Force cancel a subscription
 * - extend_trial: Extend trial period
 * - reactivate: Manually reactivate a cancelled/expired subscription
 * 
 * Body:
 * {
 *   action: 'manually_cancel' | 'extend_trial' | 'reactivate',
 *   user_id: string,
 *   days?: number (for extend_trial),
 *   reason?: string
 * }
 */
export async function POST(request: Request) {
  try {
    // Verify admin secret
    const adminSecret = request.headers.get('x-admin-secret');
    if (!adminSecret || adminSecret !== ADMIN_UI_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing admin secret' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, user_id, days, reason } = body;

    if (!action || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: action, user_id' },
        { status: 400 }
      );
    }

    // Fetch current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found for user', details: fetchError?.message },
        { status: 404 }
      );
    }

    let result;

    switch (action) {
      case 'manually_cancel':
        result = await handleManualCancel(subscription, reason);
        break;
      
      case 'extend_trial':
        result = await handleExtendTrial(subscription, days);
        break;
      
      case 'reactivate':
        result = await handleReactivate(subscription, reason);
        break;
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Admin Subscription Actions] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

async function handleManualCancel(subscription: any, reason?: string) {
  const now = new Date().toISOString();
  
  // For active/trial subscriptions, move to grace_period
  const newStatus = ['active', 'trial'].includes(subscription.status) 
    ? 'grace_period' 
    : 'cancelled';
  
  const gracePeriodEnds = newStatus === 'grace_period'
    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: newStatus,
      cancelled_at: now,
      cancel_reason: reason || 'admin_manual_cancellation',
      grace_ends_at: gracePeriodEnds,
      updated_at: now,
    })
    .eq('user_id', subscription.user_id)
    .select()
    .single();

  if (error) {
    return { error: 'Failed to cancel subscription', details: error.message };
  }

  // Log admin action
  await supabase.from('admin_audit_logs').insert({
    admin_user_id: 'system', // TODO: Extract from auth session
    action: 'subscription_manually_cancelled',
    target_user_id: subscription.user_id,
    changes: { 
      old_status: subscription.status, 
      new_status: newStatus,
      reason 
    },
  });

  return { success: true, data, message: `Subscription moved to ${newStatus}` };
}

async function handleExtendTrial(subscription: any, days?: number) {
  if (subscription.status !== 'trial') {
    return { 
      error: 'Can only extend trial for users currently in trial status',
      current_status: subscription.status 
    };
  }

  if (!days || days < 1 || days > 90) {
    return { error: 'Days must be between 1 and 90' };
  }

  const trialEndSource =
    subscription.trial_end_date ||
    subscription.current_period_end ||
    subscription.trial_ends_at;
  if (!trialEndSource) {
    return { error: 'Trial end date not set for this user' };
  }

  const currentTrialEnds = new Date(trialEndSource);
  if (isNaN(currentTrialEnds.getTime())) {
    return { error: 'Invalid trial end date in database' };
  }

  const newTrialEnds = new Date(currentTrialEnds.getTime() + days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      trial_end_date: newTrialEnds.toISOString(),
      current_period_end: newTrialEnds.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', subscription.user_id)
    .select()
    .single();

  if (error) {
    return { error: 'Failed to extend trial', details: error.message };
  }

  // Log admin action
  await supabase.from('admin_audit_logs').insert({
    admin_user_id: 'system', // TODO: Extract from auth session
    action: 'trial_extended',
    target_user_id: subscription.user_id,
    changes: { 
      old_trial_end_date: trialEndSource,
      new_trial_end_date: newTrialEnds.toISOString(),
      days_added: days 
    },
  });

  return { 
    success: true, 
    data, 
    message: `Trial extended by ${days} days. New end date: ${newTrialEnds.toLocaleDateString()}` 
  };
}

async function handleReactivate(subscription: any, reason?: string) {
  if (!['cancelled', 'grace_period', 'expired', 'paused'].includes(subscription.status)) {
    return { 
      error: 'Can only reactivate cancelled, grace_period, expired, or paused subscriptions',
      current_status: subscription.status 
    };
  }

  const now = new Date();
  const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      cancelled_at: null,
      grace_ends_at: null,
      grace_started_at: null,
      paused_until: null,
      auto_renew_enabled: true,
      current_period_start: now.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('user_id', subscription.user_id)
    .select()
    .single();

  if (error) {
    return { error: 'Failed to reactivate subscription', details: error.message };
  }

  // Log admin action
  await supabase.from('admin_audit_logs').insert({
    admin_user_id: 'system', // TODO: Extract from auth session
    action: 'subscription_reactivated',
    target_user_id: subscription.user_id,
    changes: { 
      old_status: subscription.status, 
      new_status: 'active',
      reason 
    },
  });

  return { 
    success: true, 
    data, 
    message: 'Subscription reactivated successfully. Status set to active.' 
  };
}
