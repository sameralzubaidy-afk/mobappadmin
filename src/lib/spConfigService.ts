// SP Config Service - Client for reading/writing sp_config table
// filepath: p2p-kids-admin/src/lib/spConfigService.ts

export interface SPConfigItem {
  config_key: string;
  // NOTE: sp_config.config_value is jsonb in DB, so runtime may be string/number/boolean/object.
  config_value: any;
  value_type: 'number' | 'string' | 'boolean';
  description: string;
  category: string;
}

export class SPConfigService {
  private static withCacheBust(url: string) {
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}ts=${Date.now()}`;
  }

  private static normalizeConfigValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    // JSONB objects/arrays: keep stable string representation
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Get all SP config items (or filtered by category)
   */
  static async getAll(category?: string): Promise<SPConfigItem[]> {
    const url = category 
      ? `/api/admin/sp-config?category=${encodeURIComponent(category)}`
      : `/api/admin/sp-config`;
    
    const res = await fetch(this.withCacheBust(url), { cache: 'no-store' });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to load config' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    const json = await res.json();
    return (json.data || []) as SPConfigItem[];
  }

  /**
   * Get all SP config items matching a key prefix (recommended; avoids category mismatches)
   */
  static async getByPrefix(prefix: string): Promise<SPConfigItem[]> {
    const url = `/api/admin/sp-config?prefix=${encodeURIComponent(prefix)}`;
    const res = await fetch(this.withCacheBust(url), { cache: 'no-store' });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to load config' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    const json = await res.json();
    return (json.data || []) as SPConfigItem[];
  }

  /**
   * Get a single config value by key
   * Returns null if key doesn't exist (graceful degradation)
   */
  static async get(key: string): Promise<SPConfigItem | null> {
    try {
      const url = `/api/admin/sp-config?key=${encodeURIComponent(key)}`;
      const res = await fetch(this.withCacheBust(url), { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) return null;
        const error = await res.json().catch(() => ({ error: 'Failed to load config' }));
        throw new Error(error.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      return json.data || null;
    } catch (error: any) {
      // Graceful degradation: log warning but return null instead of throwing
      console.warn(`[SPConfigService] Failed to get config key "${key}":`, error.message);
      return null;
    }
  }

  /**
   * Update a config value
   */
  static async update(key: string, value: string, adminSecret: string): Promise<void> {
    const res = await fetch('/api/admin/sp-config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify({ key, value }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to update config' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
  }

  /**
   * Get referral config values (helper)
   */
  static async getReferralConfig(): Promise<{
    referrer_sp: number | null;
    referee_sp: number | null;
    referrer_listing_sp: number | null;
    referee_listing_sp: number | null;
    starter_pack_amount: number | null;
    program_enabled: boolean | null;
    missingKeys: string[];
  }> {
    // IMPORTANT: Do NOT rely on category.
    // In this repo, many referral keys are stored in sp_config with category='general',
    // so category filtering returns empty and the UI falls back to defaults.
    const [referralItems, starterPackItems] = await Promise.all([
      this.getByPrefix('referral_'),
      this.getByPrefix('starter_pack_'),
    ]);

    const items = [...referralItems, ...starterPackItems].map((item) => ({
      ...item,
      config_value: this.normalizeConfigValue(item.config_value),
    }));

    // No hardcoded fallbacks: an absent key returns { found: false, value: null }.
    const getValue = (
      key: string
    ): { found: boolean; value: number | boolean | string | null } => {
      const item = items.find((i) => i.config_key === key);
      if (!item) return { found: false, value: null };
      if (item.value_type === 'number') {
        const parsed = parseInt(item.config_value, 10);
        return Number.isFinite(parsed) ? { found: true, value: parsed } : { found: false, value: null };
      }
      if (item.value_type === 'boolean') return { found: true, value: item.config_value === 'true' };
      return { found: true, value: item.config_value };
    };

    const REQUIRED_KEYS = [
      'referral_reward_referrer_sp',
      'referral_reward_referee_sp',
      'referral_reward_referrer_listing_sp',
      'referral_reward_referee_listing_sp',
      'referral_program_enabled',
      'starter_pack_amount',
    ];

    return {
      referrer_sp: getValue('referral_reward_referrer_sp').value as number | null,
      referee_sp: getValue('referral_reward_referee_sp').value as number | null,
      referrer_listing_sp: getValue('referral_reward_referrer_listing_sp').value as number | null,
      referee_listing_sp: getValue('referral_reward_referee_listing_sp').value as number | null,
      starter_pack_amount: getValue('starter_pack_amount').value as number | null,
      program_enabled: getValue('referral_program_enabled').value as boolean | null,
      missingKeys: REQUIRED_KEYS.filter((key) => !getValue(key).found),
    };
  }
}
