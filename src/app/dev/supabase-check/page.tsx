import React, { useEffect, useState } from 'react'

export default function SupabaseDevCheckPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/debug/supabase')
        const json = await res.json()
        setData(json)
      } catch (err) {
        setData({ error: String(err) })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Supabase Dev Check</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <pre className="whitespace-pre-wrap break-words bg-gray-50 p-4 rounded border">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  )
}
