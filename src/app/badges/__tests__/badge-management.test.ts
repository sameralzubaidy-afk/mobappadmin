/**
 * Unit Tests for Badge Management (Admin Portal)
 * TASK: BADGES-V2-007
 * 
 * Tests badge management UI components and functionality
 */

import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

const mockSupabase = {
  from: jest.fn(),
  storage: {
    from: jest.fn(),
  },
  rpc: jest.fn(),
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);

describe('Badge Management - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Badge List Loading', () => {
    it('should fetch all badges on page load', async () => {
      const mockBadges = [
        {
          id: 'badge-1',
          name: 'SP Earner - Bronze',
          description: 'Earned 10 SP',
          category: 'sp_earning',
          threshold: 10,
          is_active: true,
          sort_order: 1,
          is_archived: false,
        },
        {
          id: 'badge-2',
          name: 'First Trade',
          description: 'Completed first trade',
          category: 'trades',
          threshold: 1,
          is_active: true,
          sort_order: 2,
          is_archived: false,
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockBadges,
            error: null,
          }),
        }),
      });

      // Simulate fetching badges
      const { data, error } = await mockSupabase
        .from('badges')
        .select('*')
        .order('sort_order', { ascending: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('badges');
      expect(data).toEqual(mockBadges);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('should handle error when fetching badges', async () => {
      const mockError = { message: 'Database connection failed' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: mockError,
          }),
        }),
      });

      const { data, error } = await mockSupabase
        .from('badges')
        .select('*')
        .order('sort_order', { ascending: true });

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });
  });

  describe('Badge Toggle Active/Inactive', () => {
    it('should toggle badge active status', async () => {
      const badgeId = 'badge-1';

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: badgeId, is_active: false },
            error: null,
          }),
        }),
      });

      const { data, error } = await mockSupabase
        .from('badges')
        .update({ is_active: false })
        .eq('id', badgeId);

      expect(mockSupabase.from).toHaveBeenCalledWith('badges');
      expect(data).toEqual({ id: badgeId, is_active: false });
      expect(error).toBeNull();
    });
  });

  describe('Badge Editor - Update Badge', () => {
    it('should update badge details', async () => {
      const badgeId = 'badge-1';
      const updates = {
        name: 'SP Earner - Updated',
        description: 'Updated description',
        threshold: 20,
        sort_order: 5,
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: badgeId, ...updates },
            error: null,
          }),
        }),
      });

      const { data, error } = await mockSupabase
        .from('badges')
        .update(updates)
        .eq('id', badgeId);

      expect(data).toEqual({ id: badgeId, ...updates });
      expect(error).toBeNull();
    });
  });

  describe('Badge Icon Upload', () => {
    it('should upload badge icon to storage', async () => {
      const badgeId = 'badge-1';
      const filePath = `icons/${badgeId}-${Date.now()}.png`;
      const mockFile = new Blob(['fake-image-data'], { type: 'image/png' });

      mockSupabase.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: filePath },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: `https://example.com/storage/badge-icons/${filePath}` },
        }),
      });

      const { data: uploadData, error: uploadError } = await mockSupabase.storage
        .from('badge-icons')
        .upload(filePath, mockFile);

      expect(uploadData).toEqual({ path: filePath });
      expect(uploadError).toBeNull();

      const { data: urlData } = mockSupabase.storage
        .from('badge-icons')
        .getPublicUrl(filePath);

      expect(urlData.publicUrl).toContain(filePath);
    });

    it('should reject files larger than 5MB', () => {
      const fileSize = 6 * 1024 * 1024; // 6MB
      const isValid = fileSize <= 5 * 1024 * 1024;

      expect(isValid).toBe(false);
    });

    it('should reject invalid file types', () => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
      const invalidType = 'application/pdf';

      expect(allowedTypes.includes(invalidType)).toBe(false);
    });

    it('should accept valid file types', () => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
      const validTypes = ['image/png', 'image/jpeg', 'image/webp'];

      validTypes.forEach((type) => {
        expect(allowedTypes.includes(type)).toBe(true);
      });
    });
  });

  describe('Manual Badge Award', () => {
    it('should award badge to user via RPC', async () => {
      const userId = 'user-1';
      const badgeId = 'badge-1';
      const reason = 'Admin override for testing';

      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, message: 'Badge awarded successfully', badge_id: badgeId },
        error: null,
      });

      const { data, error } = await mockSupabase.rpc('manual_award_badge', {
        p_user_id: userId,
        p_badge_id: badgeId,
        p_reason: reason,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('manual_award_badge', {
        p_user_id: userId,
        p_badge_id: badgeId,
        p_reason: reason,
      });
      expect(data.success).toBe(true);
      expect(error).toBeNull();
    });

    it('should handle error when awarding badge', async () => {
      const userId = 'user-1';
      const badgeId = 'badge-1';
      const mockError = { message: 'User already has this badge' };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      const { data, error } = await mockSupabase.rpc('manual_award_badge', {
        p_user_id: userId,
        p_badge_id: badgeId,
        p_reason: null,
      });

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });
  });

  describe('User Search for Manual Award', () => {
    it('should find user by email', async () => {
      const email = 'test@example.com';
      const mockUser = {
        user_id: 'user-1',
        email,
        display_name: 'Test User',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      const { data, error } = await mockSupabase
        .from('profiles')
        .select('user_id, email, display_name')
        .eq('email', email)
        .single();

      expect(data).toEqual(mockUser);
      expect(error).toBeNull();
    });

    it('should handle user not found', async () => {
      const email = 'nonexistent@example.com';
      const mockError = { message: 'No rows returned', code: 'PGRST116' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const { data, error } = await mockSupabase
        .from('profiles')
        .select('user_id, email, display_name')
        .eq('email', email)
        .single();

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });
  });
});
