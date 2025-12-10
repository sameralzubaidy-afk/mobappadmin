#!/usr/bin/env node
/*
  Test Anonymous Sign-in (using anon key and password grant) - Dev only
  Usage:
    NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT>.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON> node scripts/test-auth.js <email> <password>
*/
const [,, email, password] = process.argv

if (!email || !password) {
  console.error('Usage: node scripts/test-auth.js <email> <password>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in env')
  process.exit(1)
}

(async () => {
  try {
    const res = await fetch(`${url}/auth/v1/token`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ grant_type: 'password', email, password })
    })
    const json = await res.json()
    console.log('status:', res.status)
    console.log('response:', JSON.stringify(json, null, 2))
  } catch (err) {
    console.error('Network error:', err)
    process.exit(1)
  }
})()
