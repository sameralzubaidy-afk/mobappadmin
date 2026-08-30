/**
 * API route: POST /api/admin/trades/dispute-action
 * TFV2-017: Admin dispute state transitions.
 *
 * Actions:
 *  - mark_under_review: dispute_status reported → under_review
 *  - resolve_complete:  dispute_status → resolved, trade → completed
 *  - resolve_refund:    dispute_status → resolved, trade → cancelled (triggers SP release + Stripe refund)
 *
 * TAX-REFUND-INTEGRITY (2026-07-24):
 * resolve_refund now requires a verified Stripe refund BEFORE marking tax as refunded.
 * The flow is:
 *   1. Issue Stripe refund via Stripe API
 *   2. Record refund on tax_records via rpc_record_stripe_refund (idempotent)
 *   3. If Stripe refund succeeds → call rpc_record_stripe_refund with status='succeeded'
 *   4. If Stripe refund is pending → still record it, tax_status becomes 'pending_refund'
 *   5. If Stripe refund fails → do NOT complete the refund; return error to admin
 *   6. Only after Stripe confirms, proceed with DB status updates and SP release
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActingAdminId } from '@/lib/adminAuth';

type DisputeAction = 'mark_under_review' | 'resolve_complete' | 'resolve_refund';

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret');
    const expectedSecret = process.env.ADMIN_UI_SECRET;
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DEV-TASK-62 (QA Task 8, Item 1): recover the acting admin from the
    // client's Bearer JWT so trades.dispute_resolved_by, trade_events.actor_id
    // and the new admin_audit_logs row record WHO resolved the dispute. NULL
    // fallback when no valid session (actor remains unrecorded).
    const actorId = await getActingAdminId(req);

    const body = await req.json();
    const { tradeId, action } = body as { tradeId?: string; action?: DisputeAction };

    if (!tradeId || !action) {
      return NextResponse.json({ error: 'tradeId and action are required' }, { status: 400 });
    }

    const validActions: DisputeAction[] = ['mark_under_review', 'resolve_complete', 'resolve_refund'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify trade exists and current dispute_status — also fetch buyer_id/seller_id for refund RPC
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('id, listing_id, status, dispute_status, buyer_id, seller_id')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    if (trade.dispute_status === 'resolved') {
      return NextResponse.json({ error: 'Dispute is already resolved' }, { status: 409 });
    }

    const now = new Date().toISOString();

    // Apply the action
    if (action === 'mark_under_review') {
      if (trade.dispute_status !== 'reported') {
        return NextResponse.json({ error: `Cannot mark under_review from ${trade.dispute_status}` }, { status: 409 });
      }
      const { error: updateErr } = await supabase
        .from('trades')
        .update({ dispute_status: 'under_review', updated_at: now })
        .eq('id', tradeId);
      if (updateErr) throw updateErr;

      await supabase.from('trade_events').insert({
        trade_id: tradeId,
        event_type: 'trade_disputed',
        actor_id: actorId,
        metadata: { action: 'marked_under_review', resolved_by: actorId ?? 'admin' },
      });

      // DEV-TASK-62 (Item 1): record the acting admin in the audit trail.
      await supabase.from('admin_audit_logs').insert({
        actor_id: actorId,
        action_type: 'dispute_marked_under_review',
        entity_type: 'trade',
        entity_id: tradeId,
        payload: { action: 'mark_under_review', previous_status: 'reported' },
        reason: null,
      });

    } else if (action === 'resolve_complete') {
      // Resolve dispute (overlay columns only — the money/completion side is
      // delegated to complete_trade_v2 below so payout math is NOT duplicated;
      // DEV-TASK-48: previously this branch wrote status='completed' directly and
      // left payout_amount_cents NULL, so initiate-payout processed $0).
      const { error: updateErr } = await supabase
        .from('trades')
        .update({
          dispute_status:      'resolved',
          dispute_resolution:  'resolved_seller',
          dispute_resolved_at: now,
          dispute_resolved_by: actorId,   // DEV-TASK-62 (Item 1): who resolved it
          updated_at:          now,
        })
        .eq('id', tradeId);
      if (updateErr) throw updateErr;

      // Delegate to the canonical completion money path (same as normal buyer
      // completion): sets status='completed' + completed_at, marks the item sold,
      // computes payout_amount_cents = GREATEST(0, cash − seller_fee) and creates
      // the seller_payouts row via create_seller_payout_on_trade_completion.
      const { data: completion, error: completionErr } = await supabase.rpc('complete_trade_v2', {
        p_trade_id: tradeId,
        p_user_id:  trade.buyer_id,
      });
      if (completionErr) {
        console.error('[dispute-action] complete_trade_v2 failed for trade', tradeId, completionErr);
        throw completionErr;
      }
      if (completion && completion.success === false) {
        throw new Error(`complete_trade_v2 failed: ${completion.error ?? 'unknown error'}`);
      }

      // Log trade_completed event
      await supabase.from('trade_events').insert({
        trade_id: tradeId,
        event_type: 'trade_completed',
        actor_id: actorId,
        metadata: { resolution: 'resolved_seller', resolved_by: actorId ?? 'admin' },
      });

      // DEV-TASK-62 (Item 1): audit the resolution + who did it.
      await supabase.from('admin_audit_logs').insert({
        actor_id: actorId,
        action_type: 'dispute_resolved',
        entity_type: 'trade',
        entity_id: tradeId,
        payload: { action: 'resolve_complete', resolution: 'resolved_seller' },
        reason: null,
      });

      // Notify buyer + seller via create_trade_notification RPC (non-blocking)
      // Fetch item title for notification messages
      const { data: listingItem } = await supabase.from('items').select('title').eq('id', trade.listing_id).maybeSingle();
      const itemTitle = listingItem?.title ?? 'this item';
      await supabase.rpc('create_trade_notification', {
        p_user_id: trade.buyer_id, p_notification_type: 'trade_completed',
        p_title: 'Trade Complete',
        p_body: `Our team reviewed your trade for ${itemTitle} and confirmed it as complete.`,
        p_data: JSON.stringify({ trade_id: tradeId }),
      });
      await supabase.rpc('create_trade_notification', {
        p_user_id: trade.seller_id, p_notification_type: 'trade_completed',
        p_title: 'Sale Complete',
        p_body: `Your trade for ${itemTitle} has been confirmed complete. Your payout is on its way.`,
        p_data: JSON.stringify({ trade_id: tradeId }),
      });

    } else if (action === 'resolve_refund') {
      // ── TAX-REFUND-INTEGRITY: Step 1 — Load full trade with PI info ──────────
      const { data: fullTrade } = await supabase
        .from('trades')
        .select('id, status, stripe_payment_intent_id, stripe_refund_id, cash_amount_cents, buyer_transaction_fee_cents, sp_amount, buyer_id, seller_id')
        .eq('id', tradeId)
        .single();

      const piId = fullTrade?.stripe_payment_intent_id as string | undefined;
      const existingRefundId = fullTrade?.stripe_refund_id as string | undefined;

      // ── TAX-REFUND-INTEGRITY: Step 2 — Issue Stripe refund ──────────────────
      let stripeRefundId: string | null = existingRefundId || null;
      let stripeRefundStatus: string = 'succeeded';
      let stripeRefundError: string | null = null;
      let taxRefundAmountCents: number = 0;

      // Determine the amount to refund: cash + fee + tax (full refund)
      const { data: taxRecord } = await supabase
        .from('tax_records')
        .select('tax_amount_cents, refunded_tax_cents, taxable_amount_cents')
        .eq('trade_id', tradeId)
        .maybeSingle();

      // Calculate refund amount from the original payment
      if (piId && !existingRefundId) {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          const stripeAuth = `Bearer ${stripeKey}`;
          const stripeApi = 'https://api.stripe.com/v1';
          try {
            // Check PI status to determine if it's captured (needs refund) or uncaptured (needs cancel)
            const piRes = await fetch(`${stripeApi}/payment_intents/${piId}`, {
              headers: { Authorization: stripeAuth },
            });
            const pi = await piRes.json();

            if (pi.status === 'requires_capture' || pi.status === 'processing') {
              // Uncaptured authorization — cancel the PI instead of refunding
              const cancelRes = await fetch(`${stripeApi}/payment_intents/${piId}/cancel`, {
                method: 'POST',
                headers: { Authorization: stripeAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ cancellation_reason: 'requested_by_customer' }),
              });
              const cancelled = await cancelRes.json();
              stripeRefundId = `cancelled_${cancelled.id}`;
              stripeRefundStatus = 'succeeded';
              console.log(`[dispute-action] PI ${piId} cancelled (uncaptured) for trade ${tradeId}`);

              // For uncaptured PIs, void the tax (no money moved)
              await supabase.rpc('rpc_void_tax_for_trade', {
                p_trade_id: tradeId,
                p_reason: 'dispute_resolved_refund_uncaptured',
              });

            } else if (pi.status === 'succeeded') {
              // Captured payment — issue a refund
              const totalRefundCents = (
                (fullTrade?.cash_amount_cents as number || 0) +
                (fullTrade?.buyer_transaction_fee_cents as number || 0) +
                ((taxRecord as any)?.tax_amount_cents ?? 0)
              );

              const refundBody = new URLSearchParams();
              refundBody.append('payment_intent', piId);
              refundBody.append('amount', String(Math.round(totalRefundCents)));
              refundBody.append('reason', 'requested_by_customer');
              refundBody.append('metadata[supabase_trade_id]', tradeId);
              refundBody.append('metadata[admin_action]', 'resolve_dispute_refund');
              const refundRes = await fetch(`${stripeApi}/refunds`, {
                method: 'POST',
                headers: { Authorization: stripeAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: refundBody,
              });
              const refund = await refundRes.json();

              stripeRefundId = refund.id;
              stripeRefundStatus = refund.status;
              taxRefundAmountCents = (taxRecord as any)?.tax_amount_cents ?? 0;

              console.log(`[dispute-action] Stripe refund ${refund.id} issued (status=${refund.status}) for trade ${tradeId}`);

              // ── TAX-REFUND-INTEGRITY: Step 3 — Record refund on tax ledger ──
              if (taxRefundAmountCents > 0) {
                if (refund.status === 'succeeded') {
                  await supabase.rpc('rpc_record_stripe_refund', {
                    p_trade_id: tradeId,
                    p_stripe_refund_id: refund.id,
                    p_refund_amount_cents: taxRefundAmountCents,
                    p_refund_status: 'succeeded',
                    p_refund_reason: 'dispute_resolved_refund',
                    p_initiating_actor: 'admin',
                  });
                } else if (refund.status === 'pending' || refund.status === 'processing') {
                  // Pending refund — record as pending_refund
                  await supabase.rpc('rpc_record_stripe_refund', {
                    p_trade_id: tradeId,
                    p_stripe_refund_id: refund.id,
                    p_refund_amount_cents: taxRefundAmountCents,
                    p_refund_status: 'pending',
                    p_refund_reason: 'dispute_resolved_refund',
                    p_initiating_actor: 'admin',
                  });
                } else {
                  // Failed/canceled refund
                  stripeRefundError = `Stripe refund returned status: ${refund.status}`;
                  await supabase.rpc('rpc_record_stripe_refund', {
                    p_trade_id: tradeId,
                    p_stripe_refund_id: refund.id,
                    p_refund_amount_cents: taxRefundAmountCents,
                    p_refund_status: refund.status,
                    p_refund_reason: 'dispute_resolved_refund',
                    p_initiating_actor: 'admin',
                  });
                }
              }
            } else {
              // PI is in an unexpected state (canceled, etc.) — nothing to refund
              console.log(`[dispute-action] PI ${piId} status is ${pi.status} — no refund/cancel needed`);
              stripeRefundStatus = 'noop';
            }
          } catch (stripeErr: any) {
            stripeRefundError = stripeErr.message;
            console.error(`[dispute-action] Stripe error: ${stripeErr.message}`);
          }
        } else {
          console.error('[dispute-action] STRIPE_SECRET_KEY not configured');
          stripeRefundError = 'STRIPE_SECRET_KEY not configured';
        }
      } else if (existingRefundId) {
        console.log(`[dispute-action] Refund ${existingRefundId} already exists, skipping Stripe refund`);
      } else {
        console.log(`[dispute-action] No Stripe PI for trade ${tradeId} — zero-cash or test trade`);
      }

      // ── TAX-REFUND-INTEGRITY: Step 4 — Handle refund failure ────────────────
      if (stripeRefundError && !existingRefundId && piId) {
        // Refund failed — flag the tax record for reconciliation, do NOT complete the refund path
        console.error(`[dispute-action] Stripe refund failed for trade ${tradeId}: ${stripeRefundError}`);

        const { data: listingItem } = await supabase.from('items').select('title').eq('id', trade.listing_id).maybeSingle();
        const itemTitle = listingItem?.title ?? 'this item';

        // Flag the trade for reconciliation — set dispute to resolved but keep trade status
        // so Operations can see it needs attention
        await supabase
          .from('trades')
          .update({
            dispute_status:      'under_review',
            dispute_resolution:  null,
            updated_at:          now,
          })
          .eq('id', tradeId);

        // DEV-TASK-62 (Item 1): audit the FAILED refund attempt + who attempted it.
        await supabase.from('admin_audit_logs').insert({
          actor_id: actorId,
          action_type: 'dispute_refund_failed',
          entity_type: 'trade',
          entity_id: tradeId,
          payload: { action: 'resolve_refund', error: stripeRefundError },
          reason: `Stripe refund failed: ${stripeRefundError}`,
        });

        await supabase.rpc('create_trade_notification', {
          p_user_id: trade.buyer_id, p_notification_type: 'trade_disputed',
          p_title: 'Refund Requires Attention',
          p_body: `A refund for ${itemTitle} could not be processed. Our team is working on it.`,
          p_data: JSON.stringify({ trade_id: tradeId }),
        });

        return NextResponse.json({
          success: false,
          tradeId,
          error: `Stripe refund failed: ${stripeRefundError}`,
          code: 'REFUND_FAILED',
        }, { status: 502 });
      }

      // ── TAX-REFUND-INTEGRITY: Step 5 — Store refund ID on trade ─────────────
      if (stripeRefundId && stripeRefundId !== existingRefundId) {
        await supabase.from('trades').update({ stripe_refund_id: stripeRefundId }).eq('id', tradeId);
      }

      // ── TAX-REFUND-INTEGRITY: Step 6 — Cancel trade + resolve dispute ──────
      const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_trade_v2', {
        p_trade_id: tradeId,
        p_user_id:  trade.buyer_id,
        p_reason:   'Dispute resolved: refund issued by admin',
      });

      const rpcSucceeded = rpcData && rpcData.success === true;

      if (!rpcSucceeded) {
        console.error('[dispute-action] cancel_trade_v2 returned:', rpcData, 'error:', rpcError?.message);
      }

      // Always resolve dispute status, even if RPC had an error
      const { error: updateErr } = await supabase
        .from('trades')
        .update({
          dispute_status:      'resolved',
          dispute_resolution:  'resolved_buyer',
          dispute_resolved_at: now,
          dispute_resolved_by: actorId,   // DEV-TASK-62 (Item 1): who resolved it
          status:              'cancelled',
          cancellation_reason: 'dispute_resolved_refund',
          cancelled_at:        now,
          updated_at:          now,
        })
        .eq('id', tradeId);
      if (updateErr) throw updateErr;

      // Handle SP reversal on refund (non-blocking) — fn_release_sp_on_cancel trigger
      // fires on status change to 'cancelled', so this is idempotent
      if (rpcSucceeded) {
        try {
          await supabase.rpc('fn_release_sp_on_cancel', { p_trade_id: tradeId });
        } catch (spErr: any) {
          console.error('[dispute-action] SP release error (non-fatal):', spErr.message);
        }
      }

      // Log offer_cancelled event
      await supabase.from('trade_events').insert({
        trade_id: tradeId,
        event_type: 'offer_cancelled',
        actor_id: actorId,
        metadata: {
          resolution: 'resolved_buyer',
          refund_rpc_ok: rpcSucceeded,
          stripe_refund_id: stripeRefundId,
          stripe_refund_status: stripeRefundStatus,
          resolved_by: actorId ?? 'admin',
        },
      });

      // DEV-TASK-62 (Item 1): audit the refund-resolution + who did it.
      await supabase.from('admin_audit_logs').insert({
        actor_id: actorId,
        action_type: 'dispute_resolved',
        entity_type: 'trade',
        entity_id: tradeId,
        payload: {
          action: 'resolve_refund',
          resolution: 'resolved_buyer',
          stripe_refund_id: stripeRefundId,
          stripe_refund_status: stripeRefundStatus,
        },
        reason: null,
      });

      // ── TAX-REFUND-INTEGRITY: Step 7 — Notify (only after Stripe confirmed) ─
      const { data: listingItem } = await supabase.from('items').select('title').eq('id', trade.listing_id).maybeSingle();
      const itemTitle = listingItem?.title ?? 'this item';

      // Only say "Refund Issued" if Stripe confirmed it
      const refundConfirmed = stripeRefundStatus === 'succeeded' || stripeRefundStatus === 'noop' || !piId;
      const refundPending = stripeRefundStatus === 'pending' || stripeRefundStatus === 'processing';

      await supabase.rpc('create_trade_notification', {
        p_user_id: trade.buyer_id, p_notification_type: 'trade_cancelled',
        p_title: refundConfirmed ? 'Refund Issued' : 'Refund Processing',
        p_body: refundConfirmed
          ? `Your refund for ${itemTitle} has been issued. It may take 5–10 business days to appear.`
          : `Your refund for ${itemTitle} is being processed. You\'ll get a notification once it\'s complete.`,
        p_data: JSON.stringify({ trade_id: tradeId }),
      });
      await supabase.rpc('create_trade_notification', {
        p_user_id: trade.seller_id, p_notification_type: 'trade_cancelled',
        p_title: 'Sale Cancelled',
        p_body: `Our team resolved the dispute on ${itemTitle} in the buyer\'s favor. The sale has been cancelled.`,
        p_data: JSON.stringify({ trade_id: tradeId }),
      });
    }

    return NextResponse.json({ success: true, tradeId, action });
  } catch (err: any) {
    console.error('[api/admin/trades/dispute-action] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
