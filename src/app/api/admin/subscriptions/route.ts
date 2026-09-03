// filepath: p2p-kids-admin/src/app/api/admin/subscriptions/route.ts

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type TierInfo = {
  id: string;
  display_name: string | null;
  price_cents: number | null;
  stripe_price_id: string | null;
};

type BillingAmountRow = {
  user_id: string;
  amount?: number | string | null;
  amount_cents?: number | string | null;
  charged_at?: string | null;
  created_at?: string | null;
};

const resolveSubscriptionPrice = (
  row: any,
  tierMap: Record<string, TierInfo>,
  billingMap?: Record<string, number>,
): number | null => {
  // For admin display, prefer the latest successful billed amount when available.
  if (billingMap && billingMap[row.user_id] != null) {
    return billingMap[row.user_id];
  }
  if (row.monthly_price_cents != null) {
    return row.monthly_price_cents;
  }
  if (row.last_payment_amount != null) {
    return row.last_payment_amount;
  }
  if (row.tier_id && tierMap[row.tier_id]) {
    return tierMap[row.tier_id].price_cents;
  }
  return null;
};

const toSafeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

async function fetchLatestSuccessfulBillingAmounts(
  userIds: string[],
): Promise<Record<string, number>> {
  const billingMap: Record<string, number> = {};

  if (userIds.length === 0) {
    return billingMap;
  }

  // Try canonical schema first: billing_history.amount (stored in cents)
  const amountQuery = await supabase
    .from("billing_history")
    .select("user_id, amount, charged_at, created_at")
    .in("user_id", userIds)
    .eq("status", "succeeded")
    .order("charged_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  let rows: BillingAmountRow[] = [];

  if (!amountQuery.error && amountQuery.data) {
    rows = amountQuery.data as BillingAmountRow[];
  } else {
    // Backward-compatible fallback for environments using amount_cents
    const amountCentsQuery = await supabase
      .from("billing_history")
      .select("user_id, amount_cents, charged_at, created_at")
      .in("user_id", userIds)
      .eq("status", "succeeded")
      .order("charged_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });

    if (amountCentsQuery.error) {
      console.warn(
        "[Subscriptions API] billing_history query error:",
        amountCentsQuery.error,
      );
      return billingMap;
    }

    rows = (amountCentsQuery.data || []) as BillingAmountRow[];
  }

  rows.forEach((record) => {
    if (billingMap[record.user_id] !== undefined) {
      return;
    }

    const amount = toSafeNumber(record.amount);
    const amountCents = toSafeNumber(record.amount_cents);
    const resolved = amount ?? amountCents;

    if (resolved !== null) {
      billingMap[record.user_id] = resolved;
    }
  });

  return billingMap;
}

const escapeForLike = (value: string) => value.replace(/([%_])/g, "\\$1");

/**
 * GET /api/admin/subscriptions
 *
 * Query params:
 * - status: Filter by subscription status (optional)
 * - limit: Max results to return (default: 50)
 * - offset: Pagination offset (default: 0)
 *
 * Returns subscription list with metrics
 */
export async function GET(request: Request) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ error: auth.error || "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const searchTerm = searchParams.get("search")?.trim();
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuidSearch = !!searchTerm && uuidPattern.test(searchTerm);
    const profileSearchMap: Record<
      string,
      { display_name: string | null; email: string | null }
    > = {};
    let profileSearchUserIds: string[] = [];
    let searchWildcard = "";

    if (searchTerm) {
      searchWildcard = `%${escapeForLike(searchTerm)}%`;
      const profileFilters = [
        `name.ilike.${searchWildcard}`,
        `email.ilike.${searchWildcard}`,
      ];
      if (isUuidSearch) {
        profileFilters.push(`user_id.eq.${searchTerm}`);
      }

      console.log(
        `[Subscriptions API] Searching profiles with filters: ${profileFilters.join(", ")}`,
      );

      const { data: profileMatches, error: profileMatchesError } =
        await supabase
          .from("profiles")
          .select("user_id, name, email")
          .or(profileFilters.join(","))
          .limit(400);

      if (profileMatches) {
        profileSearchUserIds = Array.from(
          new Set(profileMatches.map((profile) => profile.user_id)),
        );
        console.log(
          `[Subscriptions API] Found ${profileMatches.length} matching profiles, unique user_ids: ${profileSearchUserIds.length}`,
        );

        profileMatches.forEach((profile) => {
          profileSearchMap[profile.user_id] = {
            display_name: profile.name || null,
            email: profile.email || null,
          };
        });
      } else if (profileMatchesError) {
        console.warn(
          "[Subscriptions API] Profile search error during search:",
          profileMatchesError,
        );
      }
    }

    // Build query for subscriptions (no join to profiles yet)
    let query = supabase
      .from("subscriptions")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });

    if (!searchTerm) {
      query = query.range(offset, offset + limit - 1);
    }

    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "cancelled") {
        // Cancelled means cancelled_at is not null (regardless of status field)
        query = query.not("cancelled_at", "is", null);
      } else {
        query = query.eq("status", statusFilter);
      }
    }

    let skipSubscriptionQuery = false;
    if (searchTerm) {
      const clauses: string[] = [];

      if (isUuidSearch) {
        clauses.push(`user_id.eq.${searchTerm}`);
      }

      for (const id of profileSearchUserIds.slice(0, 40)) {
        clauses.push(`user_id.eq.${id}`);
      }

      if (clauses.length === 0) {
        skipSubscriptionQuery = true;
      } else {
        console.log(
          `[Subscriptions API] Filtering subscriptions with ${clauses.length} ID clauses`,
        );
        query = query.or(clauses.join(","));
      }
    }

    let subscriptions: any[] = [];
    let count = 0;

    if (!skipSubscriptionQuery) {
      const { data, error, count: queryCount } = await query;

      if (error) {
        console.error("[Subscriptions API] Query error:", error);
        return NextResponse.json(
          { error: "Failed to fetch subscriptions", details: error.message },
          { status: 500 },
        );
      }

      subscriptions = data || [];
      count = queryCount || 0;
      console.log(
        `[Subscriptions API] Found ${subscriptions.length} subscriptions matching search criteria`,
      );

      // If we are searching, we need to manually apply pagination because we removed the .range() call
      if (searchTerm) {
        subscriptions = subscriptions.slice(offset, offset + limit);
      }
    }

    // Fetch profile data separately by joining via user_id
    const subscriptionIds = (subscriptions || []).map((s) => s.user_id);
    const profiles: Record<string, any> = { ...profileSearchMap };

    if (subscriptionIds.length > 0) {
      const missingProfileIds = subscriptionIds.filter((id) => !profiles[id]);

      if (missingProfileIds.length > 0) {
        console.log(
          `[Subscriptions API] Fetching details for ${missingProfileIds.length} missing profiles`,
        );
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, name, email")
          .in("user_id", missingProfileIds);

        if (profilesError) {
          console.warn(
            "[Subscriptions API] Profiles query error:",
            profilesError,
          );
        }

        if (profilesData && profilesData.length > 0) {
          console.log(
            `[Subscriptions API] Fetched ${profilesData.length} profiles for ${missingProfileIds.length} missing subscriptions`,
          );
          profilesData.forEach((profile) => {
            profiles[profile.user_id] = {
              display_name: profile.name || null,
              email: profile.email || null,
            };
          });
        }
      }
    }

    // Calculate metrics from all subscriptions (not just paginated)
    const { data: allSubscriptions } = await supabase
      .from("subscriptions")
      .select(
        "status, monthly_price_cents, last_payment_amount, cancelled_at, tier_id, cancel_reason",
      );

    const tierIds = Array.from(
      new Set(
        (allSubscriptions || [])
          .map((s) => s.tier_id)
          .filter((id): id is string => !!id),
      ),
    );

    const tierMap: Record<string, TierInfo> = {};

    if (tierIds.length > 0) {
      const { data: tierRows, error: tiersError } = await supabase
        .from("subscription_tiers")
        .select("id, display_name, price_cents, stripe_price_id")
        .in("id", tierIds);

      if (tiersError) {
        console.warn(
          "[Subscriptions API] subscription_tiers query error:",
          tiersError,
        );
      } else if (tierRows) {
        tierRows.forEach((tier) => {
          tierMap[tier.id] = {
            id: tier.id,
            display_name: tier.display_name,
            price_cents: tier.price_cents,
            stripe_price_id: tier.stripe_price_id,
          };
        });
      }
    }

    const metrics = calculateMetrics(allSubscriptions || [], tierMap);

    // Cancellation-reason breakdown (accurate): computed from a DEDICATED filtered
    // query rather than from `allSubscriptions`. That unbounded select is capped at
    // the PostgREST row limit (~1000), which would under-count reasons on a table
    // this large. Filtering to cancelled rows that carry a reason keeps the page
    // count tiny today, and it is paged so it stays exact as cancellations grow.
    {
      const reasonRows: { cancel_reason: string | null }[] = [];
      const PAGE = 1000;
      for (let offset = 0; offset < 20000; offset += PAGE) {
        const { data } = await supabase
          .from("subscriptions")
          .select("cancel_reason")
          .not("cancelled_at", "is", null)
          .not("cancel_reason", "is", null)
          .order("cancelled_at", { ascending: false })
          .range(offset, offset + PAGE - 1);
        const page = (data || []) as { cancel_reason: string | null }[];
        reasonRows.push(...page);
        if (page.length < PAGE) break;
      }
      metrics.cancellationsByReason = aggregateCancellationReasons(reasonRows);
    }

    const billingMap =
      await fetchLatestSuccessfulBillingAmounts(subscriptionIds);

    // Check if we should include Free users (those in profiles but NOT in subscriptions)
    const enrichedSubscriptions = (subscriptions || []).map((sub) => {
      const profile = profiles[sub.user_id];
      const tierEntry = sub.tier_id ? tierMap[sub.tier_id] : null;
      const displayPriceCents = resolveSubscriptionPrice(
        sub,
        tierMap,
        billingMap,
      );

      return {
        ...sub,
        display_price_cents: displayPriceCents,
        tier: tierEntry,
        profile: {
          user_id: sub.user_id,
          display_name: profile?.display_name || null,
          email: profile?.email || null,
        },
      };
    });

    // CRITICAL: Handle the "Free" user case where a user matches search but HAS NO subscription record
    if (searchTerm && (statusFilter === "all" || statusFilter === "free")) {
      const currentSubscriptionUserIds = new Set(
        subscriptions.map((s) => s.user_id),
      );

      // Find profiles that were matched but aren't in the subscription list
      const freeUsers = profileSearchUserIds
        .filter((userId) => !currentSubscriptionUserIds.has(userId))
        .map((userId) => {
          const profile = profileSearchMap[userId];
          return {
            user_id: userId,
            status: "free",
            created_at: null,
            updated_at: null,
            display_price_cents: 0,
            profile: {
              user_id: userId,
              display_name: profile?.display_name || null,
              email: profile?.email || null,
            },
          };
        });

      if (freeUsers.length > 0) {
        console.log(
          `[Subscriptions API] Appending ${freeUsers.length} 'Free' users to results`,
        );
        enrichedSubscriptions.push(...freeUsers);
        // Correct the count to include these free users
        count += freeUsers.length;
      }
    }

    return NextResponse.json({
      subscriptions: enrichedSubscriptions,
      metrics,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (err: any) {
    console.error("[Subscriptions API] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 },
    );
  }
}

/**
 * Calculate subscription metrics from raw data
 */
function calculateMetrics(
  subscriptions: any[],
  tierMap: Record<string, TierInfo> = {},
): any {
  const activeStatuses = ["trial", "active"];
  const activeOnly = subscriptions.filter((s) => s.status === "active");
  const trialOnly = subscriptions.filter((s) => s.status === "trial");
  const graceOnly = subscriptions.filter((s) => s.status === "grace_period");
  const expiredOnly = subscriptions.filter((s) => s.status === "expired");
  const cancelledOnly = subscriptions.filter((s) => s.cancelled_at !== null);
  const allActive = subscriptions.filter((s) =>
    activeStatuses.includes(s.status),
  );

  // MRR = sum of monthly_price_cents for active subscribers
  const mrr = activeOnly.reduce(
    (sum, s) => sum + (resolveSubscriptionPrice(s, tierMap) ?? 0),
    0,
  );

  // Churn rate = unique subscriptions that are expired OR cancelled / total
  const totalChurned = subscriptions.filter(
    (s) => s.status === "expired" || s.cancelled_at !== null,
  ).length;
  const churnRate =
    subscriptions.length > 0 ? (totalChurned / subscriptions.length) * 100 : 0;

  // Grace to resubscribe rate - would need historical data; placeholder for now
  const graceToResubscribeRate = 0; // TODO: Implement with historical tracking

  return {
    totalSubscribers: allActive.length,
    activeSubscribers: activeOnly.length,
    trialUsers: trialOnly.length,
    gracePeriodUsers: graceOnly.length,
    expiredUsers: expiredOnly.length,
    cancelledUsers: cancelledOnly.length,
    mrr,
    churnRate: Math.round(churnRate * 10) / 10,
    graceToResubscribeRate,
  };
}

/**
 * Group cancelled-subscription rows by cancel_reason into a frequency breakdown,
 * most common first. Blank/null reasons are excluded.
 */
function aggregateCancellationReasons(
  rows: { cancel_reason: string | null }[],
): { reason: string; count: number }[] {
  const reasonCounts = new Map<string, number>();
  rows.forEach((row) => {
    if (row.cancel_reason != null && String(row.cancel_reason).trim() !== "") {
      const reason = String(row.cancel_reason).trim();
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  });
  return Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
