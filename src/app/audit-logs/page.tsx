export default async function AuditLogsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Audit Logs</h1>
      <p className="text-gray-600 mb-6">Review system audit logs for admin actions and configuration changes.</p>

      <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
        <h3 className="font-semibold mb-2">Quick SQL</h3>
        <pre className="text-xs">{`-- View recent admin audit logs
SELECT id, actor_id, action_type, payload, created_at
FROM admin_audit_logs
ORDER BY created_at DESC
LIMIT 100;`}</pre>
      </div>
    </div>
  );
}
