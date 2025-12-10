import { createServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createServerClient()

  const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true })
  const { count: itemsCount } = await supabase.from('items').select('*', { count: 'exact', head: true })
  const { count: tradesCount } = await supabase.from('trades').select('*', { count: 'exact', head: true })

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">Users<br /><strong>{usersCount ?? 0}</strong></div>
        <div className="bg-white p-4 rounded shadow">Items<br /><strong>{itemsCount ?? 0}</strong></div>
        <div className="bg-white p-4 rounded shadow">Trades<br /><strong>{tradesCount ?? 0}</strong></div>
      </div>
    </div>
  )
}
