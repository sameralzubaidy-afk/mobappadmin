export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Welcome to Admin Portal</h1>
      <p className="text-gray-600 mb-8">
        Manage system configuration, users, and review audit logs.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/config"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Configuration</h2>
          <p className="text-gray-600 text-sm">
            Manage SMS rate limits, verification settings, and system parameters.
          </p>
        </a>
        
        <a
          href="/users"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <p className="text-gray-600 text-sm">
            View and manage user accounts, verification status, and permissions.
          </p>
        </a>
        
        <a
          href="/audit-logs"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Audit Logs</h2>
          <p className="text-gray-600 text-sm">
            Review system changes, configuration updates, and admin actions.
          </p>
        </a>
      </div>
    </div>
  )
}
