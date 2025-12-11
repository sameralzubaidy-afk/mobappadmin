import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()

  const { data } = await supabase.auth.getUser()
  if (!data?.user) return redirect('/login')

  // check role
  const { data: userData } = await supabase.from('users').select('role').eq('id', data.user.id).single()
  if ((((userData as unknown) as { role?: string })?.role) !== 'admin') return redirect('/login')

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="font-semibold">P2P Admin</div>
          <div>
            <a href="/" className="text-sm text-gray-600 mr-4">Home</a>
            <a href="/dashboard" className="text-sm text-indigo-600">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
