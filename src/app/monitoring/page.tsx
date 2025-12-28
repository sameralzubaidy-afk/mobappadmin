"use client";
import { useState, useEffect } from "react";

export default function MonitoringPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeDetail, setTradeDetail] = useState<any | null>(null);
  const [noteForId, setNoteForId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [showNoteModal, setShowNoteModal] = useState(false);

  async function runMonitor() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch('/api/monitoring/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // For local development you can set NEXT_PUBLIC_ADMIN_UI_SECRET in .env.local
          'x-admin-ui-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || ''
        },
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(json?.error || json || 'Unknown error'));
      setResult(JSON.stringify(json, null, 2));
      // Refresh logs after running monitor
      await fetchLogs();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    setError(null);
    try {
      const resp = await fetch('/api/monitoring/logs', {
        method: 'GET',
        headers: {
          'x-admin-ui-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || ''
        }
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(json?.error || json || 'Unknown error'));
      // handle warning case where table does not exist
      if (json.warning) {
        setError(json.warning);
        setLogs([]);
        return;
      }
      const data = json.data || [];
      // transform to ensure payload shorthand exists
      setLogs(data.map((r: any) => ({ ...r, payload: r.payload || r.payload })));
    } catch (err: any) {
      setError(err.message || String(err));
    }
  }

  async function acknowledgeLog(id: string, note?: string) {
    try {
      const resp = await fetch(`/api/monitoring/logs/${id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-ui-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' },
        body: JSON.stringify({ note: note || 'Acknowledged via UI' })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(json?.error || json || 'Unknown error'));
      await fetchLogs();
      // Clear modal/note state
      setNoteForId(null);
      setShowNoteModal(false);
    } catch (err: any) {
      setError(err.message || String(err));
    }
  }

  function openAddNote(id: string) {
    setNoteForId(id);
    const existing = logs.find((l: any) => l.id === id) as any | undefined;
    setNoteText(existing?.notes || '');
    setShowNoteModal(true);
  }

  async function submitNote() {
    if (!noteForId) return;
    await acknowledgeLog(noteForId, noteText || 'Note added via UI');
  }

  useEffect(() => {
    // initial load
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openTradeModal(tradeId: string) {
    setShowTradeModal(true);
    setTradeDetail(null);
    try {
      const resp = await fetch(`/api/monitoring/trade/${tradeId}`, { headers: { 'x-admin-ui-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' } });
      const json = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(json?.error || json || 'Unknown error'));
      setTradeDetail(json.data);
    } catch (err: any) {
      setError(err.message || String(err));
    }
  }

  function closeTradeModal() {
    setShowTradeModal(false);
    setTradeDetail(null);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Monitoring</h1>
      <p className="text-gray-600 mb-6">
        Re-run the subscription/trade monitoring function and view recent alerts. For production, this endpoint is protected by a server-side secret — set <code>ADMIN_UI_SECRET</code> on the server.
      </p>

      <div className="space-y-4">
        <button
          disabled={loading}
          onClick={runMonitor}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Re-run Monitor'}
        </button>

        <div className="flex items-center space-x-3">
          <button
            disabled={loading}
            onClick={runMonitor}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Running…' : 'Re-run Monitor'}
          </button>

          <button
            onClick={async () => {
              setError(null);
              try {
                const resp = await fetch('/api/monitoring/debug', { headers: { 'x-admin-ui-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '' } });
                const json = await resp.json();
                if (!resp.ok) throw new Error(JSON.stringify(json?.error || json || 'Unknown error'));
                setResult(JSON.stringify(json, null, 2));
                await fetchLogs();
              } catch (err: any) {
                setError(err.message || String(err));
              }
            }}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Run Diagnostics
          </button>
        </div>

        {result && (
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200 mt-4">
            <h3 className="font-semibold mb-2">Last run result / Diagnostics</h3>
            {(() => {
              try {
                const parsed = JSON.parse(result);
                const errors = parsed.data?.errors || parsed.errors;
                if (errors && errors.length > 0) {
                  return (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                      <strong>Warning:</strong> The monitor found alerts but failed to save some logs to the database. 
                      Check if the <code>admin_monitoring_logs</code> table exists and matches the schema.
                      <pre className="mt-1 text-xs">{JSON.stringify(errors, null, 2)}</pre>
                    </div>
                  );
                }
              } catch (e) {}
              return null;
            })()}
            <pre className="text-xs overflow-auto max-h-64">{result}</pre>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded">
            <div>Error: {error}</div>
            {error.includes('Invalid API key') || error.includes('Invalid JWT') ? (
              <div className="mt-2 text-sm text-gray-700">Hint: Double-check `SUPABASE_SERVICE_ROLE_KEY` is set on the Admin server and restart the dev server so env changes take effect. Also confirm the key belongs to the project shown in <code>NEXT_PUBLIC_SUPABASE_URL</code> (project ref prefix must match).</div>
            ) : null}
          </div>
        )}

        <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Recent Alerts</h3>
            <button onClick={fetchLogs} className="text-xs text-blue-600 underline">Refresh List</button>
          </div>
          {logs.length === 0 && <div className="text-sm text-gray-600">No alerts found.</div>}
          {logs.map((l: any) => (
            <div key={l.id} className="p-3 border rounded mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Trade:</strong> <button onClick={() => openTradeModal(l.trade_id)} className="text-left text-blue-600 underline">{l.trade_id || '—'}</button> <span className="ml-2 text-sm text-gray-500">{l.alert_type}</span>
                </div>
                <div className="text-sm text-gray-600">{new Date(l.created_at).toLocaleString()}</div>
              </div>
              <div className="text-sm text-gray-700 mt-2">
                <div><strong>From:</strong> {l.payload?.from || '—'} → <strong>To:</strong> {l.payload?.to || '—'}</div>
                <div className="mt-1"><strong>Detected:</strong> {l.payload?.detection_timestamp || '—'}</div>
                <div className="mt-1"><strong>Acknowledged:</strong> {l.acknowledged ? 'Yes' : 'No'}</div>
                {l.notes && (
                  <div className="mt-1"><strong>Notes:</strong> {l.notes}</div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => acknowledgeLog(l.id)} className="px-3 py-1 bg-green-600 text-white rounded">Acknowledge</button>
                <button onClick={() => openAddNote(l.id)} className="px-3 py-1 bg-yellow-500 text-white rounded">Add note</button>
                <button onClick={() => runMonitor()} className="px-3 py-1 bg-gray-200 rounded">Re-run Monitor</button>
                <a href={`/trades/${l.trade_id}`} className="text-blue-600 underline">Open full page</a>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-2">Monitoring Queries (SQL)</h3>
          <p className="text-sm text-gray-700 mb-2">Run the following query to locate trades flagged by the monitor:</p>
          <pre className="text-xs overflow-auto">{`SELECT id, status, metadata->>'mid_trade_sub_change' AS mid_trade_sub_change,
  metadata->>'buyer_subscription_status_at_initiation' AS buyer_sub_init,
  metadata->>'buyer_subscription_status_current' AS buyer_sub_current
FROM trades
WHERE metadata->>'mid_trade_sub_change' = 'true'
ORDER BY updated_at DESC
LIMIT 50;`}</pre>
        </div>

        {/* Trade details modal */}
        {showTradeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white max-w-2xl w-full p-6 rounded shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Trade Details</h3>
                <button onClick={closeTradeModal} className="text-gray-500">Close</button>
              </div>
              {tradeDetail ? (
                <div>
                  <p><strong>Id:</strong> {tradeDetail.id}</p>
                  <p><strong>Status:</strong> {tradeDetail.status}</p>
                  <p><strong>Buyer:</strong> {tradeDetail.buyer_id}</p>
                  <p><strong>Seller:</strong> {tradeDetail.seller_id}</p>

                  <div className="mt-3 bg-gray-50 p-3 rounded">
                    <h4 className="font-medium">Metadata</h4>
                    <pre className="text-xs overflow-auto max-h-48">{JSON.stringify(tradeDetail.metadata, null, 2)}</pre>
                    <div className="mt-2">
                      <p><strong>Snapshot (at initiation):</strong> {tradeDetail.metadata?.buyer_subscription_status_at_initiation || '—'}</p>
                      <p><strong>Current (detected):</strong> {tradeDetail.metadata?.buyer_subscription_status_current || '—'}</p>
                      <p><strong>Detection timestamp:</strong> {tradeDetail.metadata?.detection_timestamp || '—'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button onClick={() => { acknowledgeLog(tradeDetail.id, 'Acknowledged via Trade modal') }} className="px-3 py-1 bg-green-600 text-white rounded">Acknowledge trade</button>
                    <a className="text-blue-600 underline" href={`/subscriptions?user_id=${tradeDetail.buyer_id}`}>View buyer subscriptions</a>
                    <button onClick={runMonitor} className="px-3 py-1 bg-gray-200 rounded ml-auto">Re-run Monitor</button>
                  </div>
                </div>
              ) : (
                <div>Loading…</div>
              )}
            </div>
          </div>
        )}

        {/* Add Note Modal */}
        {showNoteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white max-w-md w-full p-6 rounded shadow">
              <h3 className="font-semibold mb-4">Add Admin Note</h3>
              <textarea
                className="w-full border p-2 rounded mb-4 h-32"
                placeholder="Enter note here..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={submitNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Save Note & Acknowledge
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
