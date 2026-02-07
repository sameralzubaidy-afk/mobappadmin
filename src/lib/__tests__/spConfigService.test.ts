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

      expect(global.fetch).toHaveBeenCalledWith('/api/admin/sp-config');
      expect(result).toEqual(mockData);
    });

    it('should filter by category', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await SPConfigService.getAll('referral');

      expect(global.fetch).toHaveBeenCalledWith('/api/admin/sp-config?category=referral');
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
        '/api/admin/sp-config?key=referral_reward_referrer_sp'
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
      const mockData = [
        { config_key: 'referral_reward_referrer_sp', config_value: '30', value_type: 'number' },
        { config_key: 'referral_reward_referee_sp', config_value: '15', value_type: 'number' },
        { config_key: 'max_referral_extensions', config_value: '5', value_type: 'number' },
        { config_key: 'referral_extension_days', config_value: '10', value_type: 'number' },
        { config_key: 'referral_program_enabled', config_value: 'true', value_type: 'boolean' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      });

      const result = await SPConfigService.getReferralConfig();

      expect(result).toEqual({
        referrer_sp: 30,
        referee_sp: 15,
        max_extensions: 5,
        extension_days: 10,
        program_enabled: true,
      });
    });

    it('should return defaults if config missing', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const result = await SPConfigService.getReferralConfig();

      expect(result).toEqual({
        referrer_sp: 25,
        referee_sp: 10,
        max_extensions: 3,
        extension_days: 7,
        program_enabled: true,
      });
    });
  });
});
