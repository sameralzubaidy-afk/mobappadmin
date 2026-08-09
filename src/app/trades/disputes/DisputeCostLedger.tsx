// File: p2p-kids-admin/src/app/trades/disputes/DisputeCostLedger.tsx
// R4 (2026-08-09): Stripe Connect Direct charges & dispute loss accounting.
//
// Server component — read-only "Dispute Cost Ledger" for the finance/admin
// surface. Queries `admin_dispute_costs_view` (text-cast UUIDs, BP-45) directly
// via PostgREST with the service-role key (server-side only; same pattern as the
// parent disputes page). Shows per-dispute cost (fee + AOV x (1 - recovery_rate))
// plus recovery status and totals.

export const dynamic = 'force-dynamic';

interface DisputeCostRow {
  id: string;
  dispute_id: string | null;
  charge_id: string | null;
  payment_intent_id: string | null;
  trade_id_text: string | null;
  seller_name: string | null;
  seller_email: string | null;
  status: string;
  dispute_fee_cents: number;
  aov_cents: number;
  recovery_rate: number;
  loss_amount_cents: number;
  total_cost_cents: number;
  recovery_status: string;
  recovered_cents: number;
  outstanding_cents: number;
  closed_at: string | null;
  created_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  withdrawn: 'Withdrawn',
};

const RECOVERY_LABEL: Record<string, string> = {
  none: '—',
  pending: 'Pending',
  partial: 'Partial',
  recovered: 'Recovered',
  written_off: 'Written off',
};

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function badgeClass(base: string, tone: string): string {
  const tones: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-800',
  };
  return `${base} ${tones[tone] ?? tones.gray}`;
}

export default async function DisputeCostLedger() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let rows: DisputeCostRow[] = [];
  let loadError: string | null = null;

  if (supabaseUrl && serviceRoleKey) {
    const restUrl =
      `${supabaseUrl}/rest/v1/admin_dispute_costs_view?select=*&order=created_at.desc&limit=200`;
    const res = await fetch(restUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (res.ok) {
      rows = (await res.json()) as DisputeCostRow[];
    } else {
      loadError = `Failed to load dispute cost ledger: HTTP ${res.status}`;
    }
  } else {
    loadError = 'Missing Supabase server configuration';
  }

  const totalCost = rows.reduce((s, r) => s + r.total_cost_cents, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding_cents, 0);
  const totalRecovered = rows.reduce((s, r) => s + r.recovered_cents, 0);
  const lostCount = rows.filter((r) => r.status === 'lost').length;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Dispute Cost Ledger</h2>
          <p className="text-sm text-gray-500">
            R4 — Stripe Connect Direct charges. Dispute cost = $15 fee + (AOV × (1 − recovery_rate)). Lost disputes record a seller loss; outstanding is the negative-balance equivalent recovered from future payouts.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
            <div className="text-gray-500 text-xs">Total dispute cost</div>
            <div className="font-semibold">{fmtUsd(totalCost)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
            <div className="text-gray-500 text-xs">Outstanding (unrecovered)</div>
            <div className="font-semibold text-red-700">{fmtUsd(totalOutstanding)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
            <div className="text-gray-500 text-xs">Recovered</div>
            <div className="font-semibold text-green-700">{fmtUsd(totalRecovered)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
            <div className="text-gray-500 text-xs">Lost disputes</div>
            <div className="font-semibold">{lostCount}</div>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{loadError}</div>
      ) : rows.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-gray-600">
          No dispute-cost records yet. Dispute costs are recorded automatically when Stripe sends charge.dispute.* events.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left">Dispute</th>
                <th className="px-4 py-3 text-left">Seller</th>
                <th className="px-4 py-3 text-right">AOV</th>
                <th className="px-4 py-3 text-right">Fee</th>
                <th className="px-4 py-3 text-right">Loss</th>
                <th className="px-4 py-3 text-right">Total cost</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Recovery</th>
                <th className="px-4 py-3 text-right">Recovered</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-left">Closed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="bg-white hover:bg-gray-50 border-b border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{r.dispute_id ?? '—'}</div>
                    <div className="text-xs text-gray-500">trade {r.trade_id_text?.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.seller_name ?? 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{r.seller_email ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{fmtUsd(r.aov_cents)}</td>
                  <td className="px-4 py-3 text-right">{fmtUsd(r.dispute_fee_cents)}</td>
                  <td className="px-4 py-3 text-right">{fmtUsd(r.loss_amount_cents)}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtUsd(r.total_cost_cents)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={badgeClass(
                        'inline-block px-2 py-1 rounded text-xs font-medium',
                        r.status === 'lost'
                          ? 'red'
                          : r.status === 'won'
                            ? 'green'
                            : r.status === 'open'
                              ? 'yellow'
                              : 'gray'
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={badgeClass(
                        'inline-block px-2 py-1 rounded text-xs font-medium',
                        r.recovery_status === 'recovered'
                          ? 'green'
                          : r.recovery_status === 'pending'
                            ? 'yellow'
                            : r.recovery_status === 'partial'
                              ? 'blue'
                              : 'gray'
                      )}
                    >
                      {RECOVERY_LABEL[r.recovery_status] ?? r.recovery_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{fmtUsd(r.recovered_cents)}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-700">{fmtUsd(r.outstanding_cents)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.closed_at ? new Date(r.closed_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                <td className="px-4 py-3" colSpan={5}>
                  Totals ({rows.length} disputes)
                </td>
                <td className="px-4 py-3 text-right">{fmtUsd(totalCost)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">{fmtUsd(totalRecovered)}</td>
                <td className="px-4 py-3 text-right text-red-700">{fmtUsd(totalOutstanding)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
