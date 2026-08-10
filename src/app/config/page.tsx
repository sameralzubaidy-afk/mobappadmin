"use client";

// filepath: p2p-kids-admin/src/app/config/page.tsx

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import type { AdminConfigItem, SMSRateLimitStats } from "@/types/config";
import { resolveAdminEmails } from "@/lib/settingsAudit";
import SettingsLinkBanner from "@/components/settings/SettingsLinkBanner";
import LastUpdatedLabel from "@/components/settings/LastUpdatedLabel";

/**
 * KEY_PAGE_LINKS — single source for which standalone settings page owns a
 * given admin_config key. Used to render cross-link banners on the matching
 * /config tab so an admin never edits a setting here and silently diverges
 * from the standalone page (both surfaces read/write the SAME admin_config row).
 */
const KEY_PAGE_LINKS: Record<
  string,
  { href: string; label: string; message: string }
> = {
  // Tax (Config → Tax tab ↔ /tax/settings)
  sales_tax_enabled: {
    href: "/tax/settings",
    label: "Open Sales Tax Settings",
    message:
      "These global sales-tax settings are also managed on the Sales Tax page.",
  },
  default_sales_tax_rate: {
    href: "/tax/settings",
    label: "Open Sales Tax Settings",
    message:
      "These global sales-tax settings are also managed on the Sales Tax page.",
  },
  subscription_fee_taxable: {
    href: "/tax/settings",
    label: "Open Sales Tax Settings",
    message:
      "These global sales-tax settings are also managed on the Sales Tax page.",
  },
  tax_remittance_jurisdiction: {
    href: "/tax/settings",
    label: "Open Sales Tax Settings",
    message:
      "These global sales-tax settings are also managed on the Sales Tax page.",
  },
  include_fee_in_tax_base: {
    href: "/tax/settings",
    label: "Open Sales Tax Settings",
    message:
      "These global sales-tax settings are also managed on the Sales Tax page.",
  },
  // Cart (Config → Feature Flags tab ↔ /settings/cart)
  cart_min_value_cents: {
    href: "/settings/cart",
    label: "Open Cart Settings",
    message: "Cart settings are also managed on the Cart Settings page.",
  },
  cart_max_saved_carts: {
    href: "/settings/cart",
    label: "Open Cart Settings",
    message: "Cart settings are also managed on the Cart Settings page.",
  },
  cart_saved_expiry_days: {
    href: "/settings/cart",
    label: "Open Cart Settings",
    message: "Cart settings are also managed on the Cart Settings page.",
  },
  // Trade timing (Config → Trade / Feature Flags ↔ /settings/trade-timing)
  offer_timeout_hours: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  offer_notif_1_hours_before: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  offer_notif_2_hours_before: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  auto_complete_hours: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  auto_complete_notif_hours_before: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  pending_sp_release_days: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  transaction_fee_subscriber_cents: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  transaction_fee_non_subscriber_cents: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  max_pending_offers_per_seller: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message:
      "Trade timing settings are also managed on the Trade Timing page.",
  },
  pickup_window_hours: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message: "Pickup countdown is also managed on the Trade Timing page.",
  },
  payout_buffer_days: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message: "Payout buffering is also managed on the Trade Timing page.",
  },
  platform_fee_buyer_fixed_cents: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message: "Buyer fee parameters are also managed on the Trade Timing page.",
  },
  platform_fee_buyer_percentage: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message: "Buyer fee parameters are also managed on the Trade Timing page.",
  },
  charge_one_fee_per_bundle: {
    href: "/settings/trade-timing",
    label: "Open Trade Timing Settings",
    message: "The bundle fee toggle is also managed on the Trade Timing page.",
  },
  // Node settings (Config → Feature Flags ↔ /settings/nodes)
  default_radius_miles: {
    href: "/settings/nodes",
    label: "Open Node Settings",
    message: "Node settings are also managed on the Node Settings page.",
  },
  max_assignment_distance_miles: {
    href: "/settings/nodes",
    label: "Open Node Settings",
    message: "Node settings are also managed on the Node Settings page.",
  },
  allow_user_radius_adjustment: {
    href: "/settings/nodes",
    label: "Open Node Settings",
    message: "Node settings are also managed on the Node Settings page.",
  },
  min_user_radius_miles: {
    href: "/settings/nodes",
    label: "Open Node Settings",
    message: "Node settings are also managed on the Node Settings page.",
  },
  max_user_radius_miles: {
    href: "/settings/nodes",
    label: "Open Node Settings",
    message: "Node settings are also managed on the Node Settings page.",
  },
  distance_warning_threshold_miles: {
    href: "/settings/nodes",
    label: "Open Node Settings",
    message: "Node settings are also managed on the Node Settings page.",
  },
};

// SINGLE-SOURCE (2026-08-09): keys that /settings/trade-timing renders as editable
// fields. The /config hub still lists them via cross-link banners but never renders
// an editable duplicate — so two admin surfaces with different fallback defaults
// can never silently flip the same admin_config row.
const TRADE_TIMING_OWNED_KEYS = new Set([
  // Transaction / platform fees (Trade Timing → Transaction Fees)
  "transaction_fee_subscriber_cents",
  "transaction_fee_non_subscriber_cents",
  "platform_fee_seller_percentage",
  "platform_fee_seller_discount_percentage_kids_club_plus",
  "platform_fee_buyer_fixed_cents",
  "platform_fee_buyer_percentage",
  "charge_one_fee_per_bundle",
  // R1 — Tiered Buyer-Fee Engine (Trade Timing → Tiered Buyer Fee)
  "buyer_fee_active_member_cents",
  "buyer_fee_first_trade_cents",
  "buyer_fee_subsequent_percentage",
  "buyer_fee_subsequent_fixed_cents",
  "buyer_fee_subsequent_max_cents",
  "buyer_fee_label",
  // Legacy fee keys (Trade Timing → Transaction Fees → Legacy fee keys)
  "transaction_fee_member_cents",
  "transaction_fee_non_member_cents",
  "platform_fee_seller_discount_percentage_freemium",
]);

export default function ConfigPage() {
  const [config, setConfig] = useState<AdminConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [editorEmails, setEditorEmails] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<string>(() => {
    // Support deep links like /config?tab=tax so cross-link banners from the
    // standalone settings pages land on the matching tab.
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      return tab || "general";
    }
    return "general";
  });

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  const loadConfigFromApi = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cache-bust to avoid any browser/CDN caching of the API response
      const res = await fetch(`/api/admin/config?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Filter out any invalid items (missing key or value)
      const validConfig = (json.data || []).filter(
        (item: any) => item && item.key && item.value !== undefined,
      );

      // Ensure critical moderation settings are always present in UI
      // (RPC upsert will create them on save if missing).
      const moderationFallbacks: AdminConfigItem[] = [
        {
          key: "moderation_ai_enabled",
          value: "true",
          data_type: "boolean",
          category: "moderation",
          description:
            "Enable or disable Google Vision AI image moderation on listing photo upload.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          key: "moderation_appeal_max_attempts",
          value: "3",
          data_type: "number",
          category: "moderation",
          description:
            "Maximum number of appeal attempts a seller can submit for a rejected listing.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          key: "moderation_appeal_window_days",
          value: "14",
          data_type: "number",
          category: "moderation",
          description:
            "Number of days after rejection during which a seller may submit an appeal.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      moderationFallbacks.forEach((fallback) => {
        if (
          !validConfig.some(
            (item: AdminConfigItem) => item.key === fallback.key,
          )
        ) {
          validConfig.push(fallback);
        }
      });

      setConfig(validConfig);
      // read can_write flag from server
      setCanWrite(!!json.can_write);
      const initial: Record<string, string> = {};
      validConfig.forEach(
        (item: AdminConfigItem) =>
          (initial[item.key] = String(item.value ?? "")),
      );
      setEditValues(initial);

      // Resolve editor emails for the "Last updated by" labels (same audit
      // source as the standalone settings pages).
      const editorIds = Array.from(
        new Set(
          validConfig
            .map((item: AdminConfigItem) => (item as any).updated_by)
            .filter(Boolean) as string[]
        )
      );
      if (editorIds.length) {
        const emails = await resolveAdminEmails(supabase, editorIds);
        setEditorEmails(emails);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigFromApi();
  }, []);

  const handleSave = async (key: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      console.log(
        `[Config Save] Attempting to save ${key} with value:`,
        editValues[key],
      );

      // Record which admin made the edit so admin_config.updated_by is set
      // (same audit source as the standalone settings pages).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id || null;

      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ key, value: editValues[key], user_id: userId }),
      });

      console.log(`[Config Save] Response status:`, res.status);
      const json = await res.json();
      console.log(`[Config Save] Response body:`, json);

      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setSuccess(`Successfully updated ${key}`);
      console.log(
        `[Config Save] ✅ Success! Updated: ${key} = ${editValues[key]}`,
      );

      // Reload config from API
      await loadConfigFromApi();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to save configuration";
      console.error(`[Config Save] ❌ Error:`, errorMsg, err);
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const getConfigDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      sms_rate_limit_per_hour:
        "Maximum number of SMS verification codes that can be sent per hour per phone number. Helps prevent SMS spam and abuse.",
      verification_code_expiry_minutes:
        "How long verification codes remain valid before expiring (in minutes).",
      max_verification_attempts:
        "Maximum number of incorrect code attempts before requiring a new code.",
      minimum_withdrawal_amount_cents:
        "Minimum seller withdrawal amount in cents (e.g., 500 = $5.00). Set to 0 to disable the minimum requirement entirely.",
      max_trial_uses:
        "Lifetime number of free-trial starts allowed per user. Set to 1 to allow one trial ever; set to 0 or negative for unlimited.",
      moderation_ai_enabled:
        "Enable or disable Google Vision AI image moderation on listing photo upload. Disable only for maintenance or troubleshooting.",
      moderation_appeal_max_attempts:
        "Maximum number of seller appeal attempts allowed for a rejected listing.",
      moderation_appeal_window_days:
        "Allowed appeal window, in days, after a listing is rejected by admin moderation.",
      cpsc_recall_check_enabled:
        'Enable automatic CPSC recall matching for new listings. When enabled, item titles/descriptions are checked against the CPSC recalls database. Set to "true" to enable or "false" to disable.',
      cpsc_match_threshold:
        "Confidence threshold (0.0 to 1.0) for automatic item flagging. Items with similarity score >= this value will be flagged for review. Recommended: 0.5 (50%). Lower values increase sensitivity (more false positives).",
      charge_one_fee_per_bundle:
        "When enabled, bundles charge the platform fee once instead of per item. Single-item trades are unaffected. Applies to both free-tier and subscriber fixed fees. Also managed on Trade Timing → Transaction Fees.",
      pickup_window_hours:
        "Pickup countdown window (hours): how long a buyer has to confirm pickup/meetup once a trade is ready. Shared dependency for pickup-deadline requirements.",
      payout_buffer_days:
        "Payout buffer (days): how long a completed trade payout sits as a buffer before release to the seller (0 = immediate). Shared dependency for payout requirements.",
      platform_fee_buyer_fixed_cents:
        "Fixed buyer platform fee in cents (e.g. 25 = $0.25). Also managed on Trade Timing → Transaction Fees.",
      platform_fee_buyer_percentage:
        "Buyer platform fee as a % of item price (e.g. 2.5 = 2.5%). Also managed on Trade Timing → Transaction Fees.",
    };
    return descriptions[key] || "";
  };

  const isBooleanConfig = (item: AdminConfigItem): boolean => {
    if (item.data_type === "boolean") {
      return true;
    }

    const value = String(
      editValues[item.key] ?? item.value ?? "",
    ).toLowerCase();
    return value === "true" || value === "false";
  };

  const getDisplayValue = (item: AdminConfigItem): string => {
    return editValues[item.key] ?? String(item.value ?? "");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-[32px] font-bold leading-10 mb-8" style={{ letterSpacing: '-0.5px' }}>System Configuration</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        Manage system-wide settings and rate limits
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      {/* Read-only banner when service key missing */}
      {canWrite === false && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 font-medium">Read-Only Mode</p>
          <p className="text-sm text-yellow-700 mb-3">
            Server is not configured with a Supabase <code>service_role</code>{" "}
            key. Changes will not persist to the production project.
          </p>

          <p className="text-sm text-yellow-700 mb-3">
            To enable authoritative writes:
          </p>
          <ol className="list-decimal list-inside text-sm text-yellow-700 mb-3">
            <li>
              Set <code>SUPABASE_SERVICE_ROLE_KEY</code> (server env) to your
              Supabase service role key.
            </li>
            <li>
              Set <code>ADMIN_UI_SECRET</code> (server env) to a long random
              string.
            </li>
            <li>
              Restart the admin server (or redeploy) to pick up environment
              variables.
            </li>
          </ol>

          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                const snippet = `# SERVER (DO NOT COMMIT)\nSUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here\nADMIN_UI_SECRET=some-long-secret\n# (Local dev only) optionally: NEXT_PUBLIC_ADMIN_UI_SECRET=some-long-secret`;
                try {
                  await navigator.clipboard.writeText(snippet);
                  alert("Setup snippet copied to clipboard");
                } catch (e) {
                  // fallback: open a small prompt
                  prompt(
                    "Copy and paste the following into your admin server env (.env.local):",
                    snippet,
                  );
                }
              }}
              className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Copy setup snippet
            </button>
            <a
              href="https://supabase.com/docs/guides/auth#service-role"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-yellow-800 underline"
            >
              Supabase service role docs
            </a>
          </div>
        </div>
      )}

      {/* SMS Rate Limit Stats */}
      <SMSRateLimitStats />

      {/* Configuration Items - Grouped by Category */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Configuration Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            {config.length} settings organized by category
          </p>
        </div>

        {(() => {
          const groupedConfig = config.reduce(
            (acc, item) => {
              const category = (item as any).category || "general";
              if (!acc[category]) acc[category] = [];
              acc[category].push(item);
              return acc;
            },
            {} as Record<string, AdminConfigItem[]>,
          );

          const categories = Object.keys(groupedConfig).sort();
          // Ensure the active tab defaults to something that exists
          const currentTab = categories.includes(activeTab) ? activeTab : categories[0];

          // Which standalone settings pages own keys in the current tab?
          // Renders the "also managed on ..." cross-link banners.
          const relatedByHref = new Map<
            string,
            { href: string; label: string; message: string }
          >();
          (groupedConfig[currentTab] || []).forEach((i: AdminConfigItem) => {
            const link = KEY_PAGE_LINKS[i.key];
            if (link && !relatedByHref.has(link.href)) {
              relatedByHref.set(link.href, link);
            }
          });
          const relatedPages = Array.from(relatedByHref.values());
          // Editable list = current tab minus the keys owned by Trade Timing
          // (they're edited only there; /config keeps the cross-link banner).
          const visibleItems = (groupedConfig[currentTab] || []).filter(
            (item) => item && !TRADE_TIMING_OWNED_KEYS.has(item.key),
          );

          return (
            <div className="flex flex-col md:flex-row min-h-[600px]">
              {/* Sidebar Navigation */}
              <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/30">
                <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible py-0 md:py-4 hide-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveTab(cat)}
                      className={`text-left whitespace-nowrap md:whitespace-normal px-4 py-3 font-medium text-sm transition-colors border-b-2 md:border-b-0 md:border-l-4 ${
                        currentTab === cat
                          ? "border-blue-600 bg-blue-50/80 text-blue-700"
                          : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      {cat.replace(/_/g, " ").toUpperCase()}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              {currentTab && groupedConfig[currentTab] && (
                <div className="flex-1 divide-y divide-gray-100 bg-white">
                  <div className="px-6 py-4 bg-gray-50/50">
                    <h3 className="text-xl font-semibold text-gray-900 capitalize">
                      {currentTab.replace(/_/g, " ")}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {visibleItems.length} settings
                    </p>
                  </div>

                  {/* Cross-link banners to standalone settings pages that share
                      these admin_config keys (same underlying rows). */}
                  {relatedPages.length > 0 && (
                    <div className="px-6 pt-4 space-y-3">
                      {relatedPages.map((link) => (
                        <SettingsLinkBanner
                          key={link.href}
                          message={link.message}
                          href={link.href}
                          linkLabel={link.label}
                          testId={`config-link-${link.href
                            .replace(/[^a-z0-9]+/gi, "-")
                            .replace(/^-|-$/g, "")}`}
                        />
                      ))}
                    </div>
                  )}

                  {visibleItems.map((item) => {
                    if (!item || !item.key) return null;
                    const displayValue = getDisplayValue(item);
                    const isBoolean = isBooleanConfig(item);
                    return (
                      <div key={item.key} className="p-6 transition-all hover:bg-gray-50/50">
                        <div className="flex flex-col sm:flex-row items-start justify-between">
                          <div className="flex-1 w-full mr-4">
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                              {item.key
                                .split("_")
                                .map(
                                  (word: string) =>
                                    word.charAt(0).toUpperCase() + word.slice(1),
                                )
                                .join(" ")}
                            </label>
                            <p className="text-sm text-gray-600 mb-3">
                              {getConfigDescription(item.key) || item.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              {isBoolean ? (
                                <label className="inline-flex items-center gap-3 rounded-md border border-gray-300 px-3 py-2 bg-white">
                                  <input
                                    type="checkbox"
                                    checked={displayValue === "true"}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        [item.key]: e.target.checked
                                          ? "true"
                                          : "false",
                                      })
                                    }
                                    disabled={saving || canWrite === false}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                                  />
                                  <span className="text-sm font-medium text-gray-800">
                                    {displayValue === "true"
                                      ? "Enabled"
                                      : "Disabled"}
                                  </span>
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  value={displayValue}
                                  onChange={(e) =>
                                    setEditValues({
                                      ...editValues,
                                      [item.key]: e.target.value,
                                    })
                                  }
                                  className="flex-1 min-w-[200px] max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                  disabled={saving || canWrite === false}
                                />
                              )}
                              <button
                                onClick={() => handleSave(item.key)}
                                disabled={
                                  saving ||
                                  displayValue === String(item.value ?? "") ||
                                  canWrite === false
                                }
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                              >
                                {saving
                                  ? "Saving..."
                                  : canWrite === false
                                    ? "Read-only"
                                    : "Save"}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <svg className="w-4 h-4" style={{ color: "#4D4D4D" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <LastUpdatedLabel
                            updatedAt={item.updated_at}
                            editor={
                              editorEmails[(item as any).updated_by] ||
                              (item as any).updated_by ||
                              null
                            }
                            testId={`last-updated-${item.key}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Configuration Guidelines
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>
            • <strong>SMS Rate Limit:</strong> Recommended range is 5-15 per
            hour. Too low may frustrate users, too high risks abuse.
          </li>
          <li>
            • <strong>Code Expiry:</strong> Standard is 10 minutes. Shorter
            times increase security but may inconvenience users.
          </li>
          <li>
            • <strong>Max Attempts:</strong> 3 attempts is industry standard.
            Prevents brute force while allowing for typos.
          </li>
          <li>
            • <strong>AI Image Moderation:</strong> Controls Google Vision
            moderation on listing image upload. Use Disabled only for controlled
            maintenance/testing windows.
          </li>
          <li>
            • <strong>CPSC Check Enabled:</strong> Safety feature that checks
            listings against recalled products. Disable only for testing or if
            CPSC database is unavailable.
          </li>
          <li>
            • <strong>CPSC Match Threshold:</strong> Higher values (0.7-0.9)
            reduce false positives but may miss some recalls. Lower values
            (0.3-0.5) catch more recalls but require more admin review.
          </li>
          <li>
            • All changes are logged in the audit trail for compliance and
            security review.
          </li>
        </ul>
      </div>
    </div>
  );
}

function SMSRateLimitStats() {
  const [stats, setStats] = useState<SMSRateLimitStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatsFromApi = async () => {
    try {
      const res = await fetch(`/api/admin/sms-stats?ts=${Date.now()}`, {
        cache: "no-store",
        // BP-49: /api/admin/* routes authenticate via the x-admin-secret header
        // (no middleware injects it). Without it the API returns 401
        // "No valid authentication provided" and the stats silently show zeros.
        headers: {
          "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || "",
        },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStats(json);
    } catch (err) {
      console.error("Failed to load SMS stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatsFromApi();
    const interval = setInterval(loadStatsFromApi, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">SMS Usage Statistics</h2>
        <button
          onClick={loadStatsFromApi}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium mb-1">Today Total</p>
          <p className="text-3xl font-bold text-blue-900">
            {stats?.totalSentToday || 0}
          </p>
          <p className="text-xs text-blue-600 mt-1">SMS sent today</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium mb-1">Last Hour</p>
          <p className="text-3xl font-bold text-green-900">
            {stats?.totalSentThisHour || 0}
          </p>
          <p className="text-xs text-green-600 mt-1">SMS sent this hour</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium mb-1">
            Unique Phones
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {stats?.uniquePhonesThisHour || 0}
          </p>
          <p className="text-xs text-gray-600 mt-1">This hour</p>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-600 font-medium mb-1">Rate Limited</p>
          <p className="text-3xl font-bold text-red-900">
            {stats?.rateLimitedAttempts || 0}
          </p>
          <p className="text-xs text-red-600 mt-1">Blocked attempts</p>
        </div>
      </div>
    </div>
  );
}
