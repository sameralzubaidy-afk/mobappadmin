type Props = { searchParams?: { user_id?: string } };

export default async function SubscriptionsPage({ searchParams }: Props) {
  const userId = searchParams?.user_id;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return <div className="p-6">Missing server configuration for Supabase</div>;
  }

  let subs = [];
  if (userId) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=*`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      cache: 'no-store'
    });
    if (resp.ok) subs = await resp.json();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Subscriptions</h1>
      <p className="text-gray-600 mb-6">{userId ? `Subscriptions for user ${userId}` : 'Provide ?user_id=... to view subscriptions'}</p>

      {subs.length === 0 && <div className="bg-white p-4 rounded border text-sm">No subscriptions found.</div>}

      {subs.map((s: any) => (
        <div key={s.id} className="bg-white p-4 rounded border mb-3">
          <p><strong>Id:</strong> {s.id}</p>
          <p><strong>Status:</strong> {s.status}</p>
          <p><strong>Stripe:</strong> {s.stripe_subscription_id || '—'}</p>
          <p><strong>Period:</strong> {s.current_period_start} → {s.current_period_end}</p>
        </div>
      ))}
    </div>
  );
}
