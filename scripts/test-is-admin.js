#!/usr/bin/env node
/*
  Test public.is_admin() RPC using service_role key via REST endpoint (no Supabase SDK required)
  Usage:
    SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE> SUPABASE_URL=https://<PROJECT>.supabase.co node scripts/test-is-admin.js <user_uuid>
*/
const [,, p_uid] = process.argv

if (!p_uid) {
  console.error('Usage: node scripts/test-is-admin.js <user_uuid>')
  process.exit(1)
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

// Also fetch the user's role from public.users using service_role key (via REST)
(async () => {
  try {
    // fetch role via REST
    const roleRes = await fetch(`${url}/rest/v1/users?id=eq.${p_uid}&select=role,email`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
      }
    })
    const roleJson = await roleRes.text()
    console.log('role status:', roleRes.status)
    console.log('role response:', roleJson)

    // call RPC is_admin
    const res = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_uid })
    })
    const text = await res.text()
    console.log('rpc status:', res.status)
    console.log('rpc response:', text)
  } catch (err) {
    console.error('Network error:', err)
    process.exit(1)
  }
})()
