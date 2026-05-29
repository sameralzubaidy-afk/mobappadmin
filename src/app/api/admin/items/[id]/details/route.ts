import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminAuth } from "@/lib/adminAuth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const normalize = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function GET(
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

    // PROD-010: centralized admin auth
    const auth = await verifyAdminAuth(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: `Unauthorized: ${auth.error}` },
        { status: 401 },
      );
    }

    const itemId = params.id;
    if (!itemId) {
      return NextResponse.json({ error: "Missing item id" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id, requested_category_name")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) {
      return NextResponse.json(
        { error: `Failed to fetch item details: ${itemError.message}` },
        { status: 500 },
      );
    }

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    let requestedCategoryName = normalize(item.requested_category_name);

    if (!requestedCategoryName) {
      const { data: reviewFlag, error: reviewFlagError } = await supabase
        .from("review_flags")
        .select("details")
        .eq("item_id", itemId)
        .eq("type", "category_suggestion")
        .maybeSingle();

      if (reviewFlagError) {
        return NextResponse.json(
          { error: `Failed to fetch category suggestion: ${reviewFlagError.message}` },
          { status: 500 },
        );
      }

      const suggested =
        reviewFlag?.details &&
        typeof reviewFlag.details === "object" &&
        "requested_name" in reviewFlag.details
          ? (reviewFlag.details.requested_name as string | null | undefined)
          : null;

      requestedCategoryName = normalize(suggested);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: itemId,
        requested_category_name: requestedCategoryName,
        is_custom_category: Boolean(requestedCategoryName),
      },
    });
  } catch (err: any) {
    console.error("[Admin Item Details API] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
