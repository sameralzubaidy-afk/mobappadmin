export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-3xl text-center">
        <h1 className="text-3xl font-bold mb-4">P2P Kids Marketplace — Admin</h1>
        <p className="text-gray-600">This repository contains the admin portal (Next.js + TypeScript + Tailwind + Supabase).</p>
        <div className="mt-6">
          <a href="/login" className="inline-block px-4 py-2 bg-indigo-600 text-white rounded">Go to login</a>
        </div>
      </div>
    </main>
  )
}
