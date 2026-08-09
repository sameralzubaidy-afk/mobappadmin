// Unit Tests: SP Config Service
// filepath: p2p-kids-admin/src/lib/__tests__/spConfigService.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SPConfigService } from '../spConfigService';

// Mock fetch
global.fetch = vi.fn();

describe('SPConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all SP config items', async () => {
      const mockData = [
        {
          config_key: 'referral_reward_referrer_sp',
          config_value: '25',
          value_type: 'number',
          description: 'SP awarded to referrer',
          category: 'referral',
        },
        {
          config_key: 'referral_reward_referee_sp',
          config_value: '10',
          value_type: 'number',
          description: 'SP awarded to referee',
          category: 'referral',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      });

      const result = await SPConfigService.getAll();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/admin\/sp-config\?ts=\d+$/),
        { cache: 'no-store' }
      );
      expect(result).toEqual(mockData);
    });

    it('should filter by category', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await SPConfigService.getAll('referral');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/admin\/sp-config\?category=referral&ts=\d+$/),
        { cache: 'no-store' }
      );
    });

    it('should throw error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(SPConfigService.getAll()).rejects.toThrow('Internal server error');
    });
  });

  describe('get', () => {
    it('should fetch single config item by key', async () => {
      const mockItem = {
        config_key: 'referral_reward_referrer_sp',
        config_value: '25',
        value_type: 'number',
        description: 'SP awarded to referrer',
        category: 'referral',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockItem }),
      });

      const result = await SPConfigService.get('referral_reward_referrer_sp');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/admin\/sp-config\?key=referral_reward_referrer_sp&ts=\d+$/),
        { cache: 'no-store' }
      );
      expect(result).toEqual(mockItem);
    });

    it('should return null on 404', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await SPConfigService.get('nonexistent_key');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update config value with admin secret', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await SPConfigService.update('referral_reward_referrer_sp', '30', 'test-secret');

      expect(global.fetch).toHaveBeenCalledWith('/api/admin/sp-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': 'test-secret',
        },
        body: JSON.stringify({ key: 'referral_reward_referrer_sp', value: '30' }),
      });
    });

    it('should throw error on unauthorized', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(
        SPConfigService.update('referral_reward_referrer_sp', '30', 'wrong-secret')
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('getReferralConfig', () => {
    it('should return parsed referral config', async () => {
      const referralData = [
        { config_key: 'referral_reward_referrer_sp', config_value: '30', value_type: 'number' },
        { config_key: 'referral_reward_referee_sp', config_value: '15', value_type: 'number' },
        { config_key: 'referral_reward_referrer_listing_sp', config_value: '40', value_type: 'number' },
        { config_key: 'referral_reward_referee_listing_sp', config_value: '20', value_type: 'number' },
        { config_key: 'referral_program_enabled', config_value: 'true', value_type: 'boolean' },
      ];

      const starterPackData = [
        { config_key: 'starter_pack_amount', config_value: '12', value_type: 'number' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: referralData }),
      });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: starterPackData }),
      });

      const result = await SPConfigService.getReferralConfig();

      expect(result).toEqual({
        referrer_sp: 30,
        referee_sp: 15,
        referrer_listing_sp: 40,
        referee_listing_sp: 20,
        starter_pack_amount: 12,
        program_enabled: true,
        missingKeys: [],
      });
    });

    it('should report missing keys as null instead of hardcoded defaults', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const result = await SPConfigService.getReferralConfig();

      expect(result).toEqual({
        referrer_sp: null,
        referee_sp: null,
        referrer_listing_sp: null,
        referee_listing_sp: null,
        starter_pack_amount: null,
        program_enabled: null,
        missingKeys: [
          'referral_reward_referrer_sp',
          'referral_reward_referee_sp',
          'referral_reward_referrer_listing_sp',
          'referral_reward_referee_listing_sp',
          'referral_program_enabled',
          'starter_pack_amount',
        ],
      });
    });
  });
});
