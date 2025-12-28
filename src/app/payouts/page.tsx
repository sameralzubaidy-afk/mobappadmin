'use client';

// filepath: p2p-kids-admin/src/app/payouts/page.tsx
// Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-002)
// Description: Admin UI for managing payout fee configuration

import { useState, useEffect } from 'react';
import { 
  getPayoutFeeDescription, 
  getPayoutBreakdown,
  type PayoutFeeConfig,
  type PayoutMethodType 
} from '@/lib/payoutFees';

interface AdminConfigItem {
  key: string;
  value: string;
  description: string;
  category: string;
  value_type: string;
}

interface PayoutFeeConfigResponse {
  data: AdminConfigItem[];
  rpc_data: PayoutFeeConfig | null;
  can_write: boolean;
}

export default function PayoutFeesPage() {
  const [config, setConfig] = useState<AdminConfigItem[]>([]);
  const [rpcConfig, setRpcConfig] = useState<PayoutFeeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testAmount, setTestAmount] = useState('10000'); // $100 default

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/admin/payout-fees');
      const json: PayoutFeeConfigResponse = await res.json();
      
      if (json.error) throw new Error(json.error);
      
      setConfig(json.data || []);
      setRpcConfig(json.rpc_data);
      
      const initial: Record<string, string> = {};
      json.data.forEach((item) => (initial[item.key] = item.value));
      setEditValues(initial);
    } catch (err: any) {
      setError(err.message || 'Failed to load payout fee configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch('/api/admin/payout-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      
      const json = await res.json();
      
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to save');
      }
      
      setSuccess(`Saved ${key}`);
      await loadConfig();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (key: string) => {
    const item = config.find((c) => c.key === key);
    if (item) {
      setEditValues((prev) => ({ ...prev, [key]: item.value }));
    }
  };

  const renderConfigItem = (item: AdminConfigItem) => {
    const isEdited = editValues[item.key] !== item.value;
    const isSaving = saving === item.key;

    return (
      <div key={item.key} className="border rounded-lg p-4 bg-white">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{item.key}</h3>
            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
          </div>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{item.value_type}</span>
        </div>

        <div className="flex gap-2 mt-3">
          <input
            type={item.value_type === 'integer' ? 'number' : 'text'}
            value={editValues[item.key] || ''}
            onChange={(e) =>
              setEditValues((prev) => ({ ...prev, [item.key]: e.target.value }))
            }
            className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSaving}
            step={item.value_type === 'decimal' ? '0.01' : '1'}
            min="0"
          />
          
          <button
            onClick={() => handleSave(item.key)}
            disabled={!isEdited || isSaving}
            className={`px-4 py-2 rounded font-medium ${
              isEdited && !isSaving
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          
          <button
            onClick={() => handleReset(item.key)}
            disabled={!isEdited || isSaving}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>

        {isEdited && (
          <p className="text-sm text-amber-600 mt-2">
            ⚠️ Unsaved changes
          </p>
        )}
      </div>
    );
  };

  const renderFeePreview = () => {
    if (!rpcConfig) return null;

    const amountCents = parseInt(testAmount) || 10000;
    const methods: PayoutMethodType[] = ['stripe_connect', 'paypal', 'venmo', 'bank_ach'];

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-lg text-gray-900 mb-4">Fee Calculator</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Amount (cents)
          </label>
          <input
            type="number"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="10000"
            step="100"
            min="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            ${(parseInt(testAmount) / 100).toFixed(2)}
          </p>
        </div>

        <div className="space-y-3">
          {methods.map((method) => {
            const breakdown = getPayoutBreakdown(method, amountCents, rpcConfig);
            
            return (
              <div key={method} className="bg-white rounded p-3 border">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium capitalize">
                    {method.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-600">
                    {getPayoutFeeDescription(method, rpcConfig)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Gross:</span>
                    <span className="ml-1 font-semibold">{breakdown.grossFormatted}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fee:</span>
                    <span className="ml-1 font-semibold text-red-600">
                      -{breakdown.payoutFeeFormatted}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Net:</span>
                    <span className="ml-1 font-semibold text-green-600">
                      {breakdown.netFormatted}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payout Fee Configuration</h1>
        <p className="text-gray-600">
          Manage seller payout fees for different payment methods. Changes take effect immediately.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">❌ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">✅ {success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Configuration</h2>
          {config.map(renderConfigItem)}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
          {renderFeePreview()}
          
          <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-600">
            <h4 className="font-semibold mb-2">Policy Notes:</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Platform transaction fee is $0 (seller pays payout provider fees only)</li>
              <li>Stripe fees: percentage + fixed per payout</li>
              <li>PayPal/Venmo fees: percentage capped at maximum</li>
              <li>ACH fees: flat fee (Post-MVP)</li>
              <li>All fees displayed transparently to sellers</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="font-semibold text-gray-900 mb-3">Current Active Configuration (RPC)</h3>
        {rpcConfig ? (
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(rpcConfig, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-500">No RPC configuration loaded</p>
        )}
      </div>
    </div>
  );
}
