'use client';

// Referral Configuration Tab
// filepath: p2p-kids-admin/src/app/referrals/configuration-tab.tsx

import { useState, useEffect } from 'react';
import { SPConfigService } from '@/lib/spConfigService';

export default function ConfigurationTab() {
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Not-loaded sentinel: empty fields + toggles off. If the config fetch fails,
  // the form never presents hardcoded 25/10 values as if they were the live
  // config (REF-V2-008 requires configured amounts only — no hardcoded fallback).
  const [referrerSP, setReferrerSP] = useState('');
  const [refereeSP, setRefereeSP] = useState('');
  const [referrerListingSP, setReferrerListingSP] = useState('');
  const [refereeListingSP, setRefereeListingSP] = useState('');
  const [starterPackSP, setStarterPackSP] = useState('');
  const [programEnabled, setProgramEnabled] = useState(false);
  const [firstTradeEnabled, setFirstTradeEnabled] = useState(false);
  const [firstListingEnabled, setFirstListingEnabled] = useState(false);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '';

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setMissingKeys([]);
    try {
      const config = await SPConfigService.getReferralConfig();
      setReferrerSP(config.referrer_sp?.toString() ?? '');
      setRefereeSP(config.referee_sp?.toString() ?? '');
      setReferrerListingSP(config.referrer_listing_sp?.toString() ?? '');
      setRefereeListingSP(config.referee_listing_sp?.toString() ?? '');
      setStarterPackSP(config.starter_pack_amount?.toString() ?? '');
      if (config.program_enabled !== null) setProgramEnabled(config.program_enabled);

      // Feature toggles — report a missing key instead of silently enabling.
      const firstTradeToggle = await SPConfigService.get('referral_first_trade_enabled');
      if (firstTradeToggle) {
        setFirstTradeEnabled(firstTradeToggle.config_value !== 'false');
      } else {
        setMissingKeys((prev) => Array.from(new Set([...prev, 'referral_first_trade_enabled'])));
      }

      const firstListingToggle = await SPConfigService.get('referral_first_listing_enabled');
      if (firstListingToggle) {
        setFirstListingEnabled(firstListingToggle.config_value !== 'false');
      } else {
        setMissingKeys((prev) => Array.from(new Set([...prev, 'referral_first_listing_enabled'])));
      }

      if (config.missingKeys && config.missingKeys.length > 0) {
        setMissingKeys((prev) => Array.from(new Set([...prev, ...config.missingKeys])));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: string) => {
    setSavingField(key);
    setError(null);
    setSuccess(null);
    try {
      await SPConfigService.update(key, value, adminSecret);
      setSuccess(`Successfully updated ${key}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSavingField(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Referral Program Configuration</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure SP bonus rewards settings for the referral program.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {missingKeys.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-amber-800 text-sm font-medium">
              Missing configuration: {missingKeys.join(', ')}
            </p>
            <p className="text-amber-700 text-xs mt-1">
              These referral settings are not present in the database. Add them below, or the
              referral program will fail loudly until they are configured.
            </p>
          </div>
        )}

        <div className="space-y-8">
          {/* First Trade Bonuses */}
          <div>
            <h3 className="text-lg font-medium mb-3 border-b pb-1">First Trade Bonuses</h3>
            <p className="text-xs text-gray-500 mb-4 italic">
              Awarded when the person you referred completes their first successful trade.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Referrer SP (First Trade) */}
              <div className="border rounded-lg p-4 bg-gray-50/30">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referrer SP Bonus
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="ref-config-first-trade-referrer-sp"
                    type="number"
                    min="0"
                    step="1"
                    value={referrerSP}
                    onChange={(e) => setReferrerSP(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!!savingField}
                  />
                  <button
                    data-testid="btn-save-first-trade-referrer-sp"
                    onClick={() => handleSave('referral_reward_referrer_sp', referrerSP)}
                    disabled={!!savingField}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                  >
                    {savingField === 'referral_reward_referrer_sp' ? '...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Referee SP (First Trade) */}
              <div className="border rounded-lg p-4 bg-gray-50/30">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referee SP Bonus
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="ref-config-first-trade-referee-sp"
                    type="number"
                    min="0"
                    step="1"
                    value={refereeSP}
                    onChange={(e) => setRefereeSP(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!!savingField}
                  />
                  <button
                    data-testid="btn-save-first-trade-referee-sp"
                    onClick={() => handleSave('referral_reward_referee_sp', refereeSP)}
                    disabled={!!savingField}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                  >
                    {savingField === 'referral_reward_referee_sp' ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* First Listing Approved Bonuses */}
          <div>
            <h3 className="text-lg font-medium mb-3 border-b pb-1">First Approved Listing Bonuses</h3>
            <p className="text-xs text-gray-500 mb-4 italic">
              Awarded when the person you referred has their very first item approved by an admin.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Referrer SP (First Listing) */}
              <div className="border rounded-lg p-4 bg-gray-50/30">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referrer SP Bonus
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="ref-config-first-listing-referrer-sp"
                    type="number"
                    min="0"
                    step="1"
                    value={referrerListingSP}
                    onChange={(e) => setReferrerListingSP(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!!savingField}
                  />
                  <button
                    data-testid="btn-save-first-listing-referrer-sp"
                    onClick={() => handleSave('referral_reward_referrer_listing_sp', referrerListingSP)}
                    disabled={!!savingField}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                  >
                    {savingField === 'referral_reward_referrer_listing_sp' ? '...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Referee SP (First Listing) */}
              <div className="border rounded-lg p-4 bg-gray-50/30">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referee SP Bonus
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="ref-config-first-listing-referee-sp"
                    type="number"
                    min="0"
                    step="1"
                    value={refereeListingSP}
                    onChange={(e) => setRefereeListingSP(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!!savingField}
                  />
                  <button
                    data-testid="btn-save-first-listing-referee-sp"
                    onClick={() => handleSave('referral_reward_referee_listing_sp', refereeListingSP)}
                    disabled={!!savingField}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                  >
                    {savingField === 'referral_reward_referee_listing_sp' ? '...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Starter Pack SP (System Bonus) */}
              <div className="border rounded-lg p-4 bg-gray-50/30">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Starter Pack Bonus (All Users)
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="ref-config-starter-pack-sp"
                    type="number"
                    min="0"
                    step="1"
                    value={starterPackSP}
                    onChange={(e) => setStarterPackSP(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!!savingField}
                  />
                  <button
                    data-testid="btn-save-starter-pack-sp"
                    onClick={() => handleSave('starter_pack_amount', starterPackSP)}
                    disabled={!!savingField}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                  >
                    {savingField === 'starter_pack_amount' ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div>
            <h3 className="text-lg font-medium mb-3 border-b pb-1">Feature Toggles</h3>
            <p className="text-xs text-gray-500 mb-4 italic">
              Enable or disable specific referral bonus rewards independently.
            </p>
            
            <div className="space-y-3">
              {/* First Trade Bonus Toggle */}
              <div className="border rounded-lg p-4 bg-gray-50/30">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      🎯 First Trade Bonus Active
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Award SP when referee completes their first successful trade.
                    </p>
                  </div>
                  <div className="ios-toggle-container">
                    <label className="ios-toggle">
                      <input
                        data-testid="toggle-first-trade-enabled"
                        type="checkbox"
                        checked={firstTradeEnabled}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setFirstTradeEnabled(newValue);
                          handleSave('referral_first_trade_enabled', newValue.toString());
                        }}
                        disabled={!!savingField}
                      />
                      <span className="ios-toggle-slider"></span>
                    </label>
                  </div>
                </label>
              </div>

              {/* First Listing Bonus Toggle */}
              <div className="border rounded-lg p-4 bg-gray-50/30">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      📝 First Approved Listing Bonus Active
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Award SP when referee's first item is approved by admin.
                    </p>
                  </div>
                  <div className="ios-toggle-container">
                    <label className="ios-toggle">
                      <input
                        data-testid="toggle-first-listing-enabled"
                        type="checkbox"
                        checked={firstListingEnabled}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setFirstListingEnabled(newValue);
                          handleSave('referral_first_listing_enabled', newValue.toString());
                        }}
                        disabled={!!savingField}
                      />
                      <span className="ios-toggle-slider"></span>
                    </label>
                  </div>
                </label>
              </div>

              {/* Overall Referral Program Toggle */}
              <div className="border rounded-lg p-4 bg-gray-50/30 mt-4 pt-4 border-t-2">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      🌐 Entire Referral Program Active
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Toggle entire referral system on or off globally. When disabled, both trade and listing bonuses are paused.
                    </p>
                  </div>
                  <div className="ios-toggle-container">
                    <label className="ios-toggle">
                      <input
                        data-testid="toggle-program-enabled"
                        type="checkbox"
                        checked={programEnabled}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setProgramEnabled(newValue);
                          handleSave('referral_program_enabled', newValue.toString());
                        }}
                        disabled={!!savingField}
                      />
                      <span className="ios-toggle-slider"></span>
                    </label>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-yellow-800">Important Note</h4>
                <p className="text-xs text-yellow-700 mt-1">
                  Bonus values are fetched at the time of awarding. Changes take effect immediately 
                  for any rewards not yet processed by the system triggers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// iOS-style toggle switch styles
const toggleStyles = `
  .ios-toggle {
    position: relative;
    display: inline-block;
    width: 51px;
    height: 31px;
    flex-shrink: 0;
  }

  .ios-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .ios-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.3s;
    border-radius: 31px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .ios-toggle-slider:before {
    position: absolute;
    content: "";
    height: 25px;
    width: 25px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .ios-toggle input:checked + .ios-toggle-slider {
    background-color: #2196F3;
  }

  .ios-toggle input:checked + .ios-toggle-slider:before {
    transform: translateX(20px);
  }

  .ios-toggle input:disabled + .ios-toggle-slider {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ios-toggle-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('ios-toggle-styles')) {
  const style = document.createElement('style');
  style.id = 'ios-toggle-styles';
  style.innerHTML = toggleStyles;
  document.head.appendChild(style);
}
