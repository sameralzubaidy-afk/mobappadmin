'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  if (process.env.NODE_ENV === 'development') {
    try {
      console.debug('DEBUG: NEXT_PUBLIC_SUPABASE_URL=', process.env.NEXT_PUBLIC_SUPABASE_URL)
      console.debug('DEBUG: NEXT_PUBLIC_SUPABASE_ANON_KEY first 6 chars=', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0,6))
    } catch (err) {
      console.debug('DEBUG: env read error', err)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      console.debug('DEBUG: Attempting signInWithPassword for', email)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      console.debug('DEBUG: auth.signIn result', { data, error })
      if (error) throw error

      // Verify admin role on users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user?.id)
        .single()
      console.debug('DEBUG: users.select result', { userData, userError })

      if (userError) throw userError
      if ((((userData as unknown) as { role?: string })?.role) !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('Unauthorized: Admin access only')
      }

      toast.success('Login successful')
      router.push('/dashboard')
    } catch (err: unknown) {
      // Show full error in dev; show only message in prod
      console.error('DEBUG: login error', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (process.env.NODE_ENV === 'development') {
        toast.error(`Login failed: ${errorMessage}`)
      } else {
        toast.error(errorMessage || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Admin Login</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="w-full border px-3 py-2 rounded" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" className="w-full border px-3 py-2 rounded" />
          <div className="flex justify-end">
            <button disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded">{loading ? 'Signing in...' : 'Sign in'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
