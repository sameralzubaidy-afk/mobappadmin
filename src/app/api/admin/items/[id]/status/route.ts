import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildItemStatusUpdatePayload,
  validateModerationStatusInput,
} from "@/lib/itemModerationStatus";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET;

interface StatusBody {
  status: string;
  rejection_reason?: string;
  admin_user_id?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: missing Supabase environment variables",
        },
        { status: 500 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const adminSecret = request.headers.get("x-admin-secret");
    if (!adminSecret || adminSecret !== ADMIN_UI_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing admin secret" },
        { status: 401 },
      );
    }

    const itemId = params.id;
    if (!itemId) {
      return NextResponse.json({ error: "Missing item id" }, { status: 400 });
    }

    const body = (await request.json()) as StatusBody;
    const { status, rejection_reason } = body;

    const validation = validateModerationStatusInput(status, rejection_reason);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // APPROVE (flagged/rejected/needs_edits -> available) must go through the
    // complete approval RPC `admin_approve_flagged_listing`. A plain table
    // update used to skip approved_at/approved_by, the admin_activity_log audit
    // trail, and the seller "Listing Approved" notification. The RPC keeps the
    // human-override of the R8 AI-moderation gate (a flagged image would
    // otherwise hard-block approval) and is scoped to the review queue only.
    if (validation.status === "available") {
      const adminUserId = body.admin_user_id;
      if (!adminUserId) {
        return NextResponse.json(
          { error: "admin_user_id is required to approve an item" },
          { status: 400 },
        );
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "admin_approve_flagged_listing",
        {
          p_listing_id: itemId,
          p_admin_user_id: adminUserId,
          p_reason: validation.reason,
        },
      );

      if (rpcError) {
        return NextResponse.json(
          { error: `Failed to approve item: ${rpcError.message}` },
          { status: 500 },
        );
      }

      if (!rpcData || !rpcData.success) {
        return NextResponse.json(
          { error: rpcData?.error || "Failed to approve item" },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: itemId,
          status: "available",
          ...(rpcData as Record<string, unknown>),
        },
      });
    }

    const { data: existingItem, error: existingItemError } = await supabase
      .from("items")
      .select("id, status, appeal_count")
      .eq("id", itemId)
      .maybeSingle();

    if (existingItemError) {
      return NextResponse.json(
        { error: `Failed to fetch item: ${existingItemError.message}` },
        { status: 500 },
      );
    }

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const updatePayload = buildItemStatusUpdatePayload({
      status: validation.status,
      reason: validation.reason,
      currentAppealCount: existingItem.appeal_count || 0,
    });

    const { data: updatedItem, error: updateError } = await supabase
      .from("items")
      .update(updatePayload)
      .eq("id", itemId)
      .select(
        "id, status, flagged_at, rejected_at, rejection_reason, appeal_count, appealed_at, appeal_reason, edited_since_rejection, edited_since_rejection_at",
      )
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update item: ${updateError.message}` },
        { status: 500 },
      );
    }

    if (!updatedItem) {
      return NextResponse.json(
        { error: "No row updated. Verify item exists and is writable." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, data: updatedItem });
  } catch (err: any) {
    console.error("[Admin Items Status API] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
