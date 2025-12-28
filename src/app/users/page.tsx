export default async function UsersPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <p className="text-gray-600 mb-6">Search and manage user accounts. Use Supabase SQL or the API to locate users by email or id.</p>

      <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
        <h3 className="font-semibold mb-2">Quick SQL</h3>
        <pre className="text-xs">{`-- Find a user by email
SELECT id, email, created_at FROM auth.users WHERE email = 'someone@example.com';`}</pre>
      </div>
    </div>
  );
}
