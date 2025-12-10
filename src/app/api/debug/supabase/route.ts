import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  // dev-only guard
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden: Dev-only endpoint' }, { status: 403 })
  }

  try {
    const supabase = createServerClient()

    const { data: authUserData, error: authError } = await supabase.auth.getUser()
    const user = authUserData?.user || null

    let profile = null
    let profileError = null
    let isAdminRpc = null
    let isAdminError = null

    if (user?.id) {
      const { data: pData, error: pErr } = await supabase.from('users').select('id, email, role').eq('id', user.id).single()
      profile = pData
      profileError = pErr

      // call RPC is_admin
      const { data: rpcData, error: rpcErr } = await supabase.rpc('is_admin', { p_uid: user.id })
      isAdminRpc = rpcData
      isAdminError = rpcErr
    }

    const result = {
      user,
      profile,
      profileError: profileError?.message || null,
      isAdminRpc: isAdminRpc || null,
      isAdminError: isAdminError?.message || null,
      authError: authError?.message || null,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
        NODE_ENV: process.env.NODE_ENV || null,
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('DEBUG: /api/debug/supabase error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
