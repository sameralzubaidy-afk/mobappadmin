// File: p2p-kids-admin/__tests__/theme/design-tokens.test.ts
import { describe, it, expect } from 'vitest';
import { theme } from '@/styles/theme';

describe('Design Tokens', () => {
  describe('Color Palette', () => {
    it('should define all sidebar colors', () => {
      expect(theme.colors.sidebar.bg).toBe('#3D1073');
      expect(theme.colors.sidebar.active).toBe('#5A2D9C');
      expect(theme.colors.sidebar.text).toBe('#FFFFFF');
      expect(theme.colors.sidebar.muted).toBe('#C4A8E8');
    });

    it('should define all brand colors', () => {
      expect(theme.colors.brand.primary).toBe('#6C3CE1');
      expect(theme.colors.brand.accent).toBe('#FF6B35');
      expect(theme.colors.brand.green).toBe('#28A745');
      expect(theme.colors.brand.blue).toBe('#17A2B8');
    });

    it('should define all text colors', () => {
      expect(theme.colors.text.primary).toBe('#2D2D4E');
      expect(theme.colors.text.secondary).toBe('#6B6B8F');
      expect(theme.colors.text.muted).toBe('#9B97B5');
    });

    it('should define card colors', () => {
      expect(theme.colors.card.bg).toBe('#FFFFFF');
      expect(theme.colors.card.border).toBe('#F0EDF9');
    });
  });

  describe('Spacing', () => {
    it('should define layout spacing', () => {
      expect(theme.spacing.sidebarWidth).toBe('256px');
      expect(theme.spacing.topbarHeight).toBe('64px');
      expect(theme.spacing.cardPadding).toBe('24px');
      expect(theme.spacing.sectionGap).toBe('24px');
    });
  });

  describe('Shadows', () => {
    it('should define card shadow', () => {
      expect(theme.shadow.card).toBeTruthy();
      expect(theme.shadow.card).toContain('rgba');
    });

    it('should define sidebar shadow', () => {
      expect(theme.shadow.sidebar).toBeTruthy();
      expect(theme.shadow.sidebar).toContain('rgba');
    });
  });

  describe('Icon Colors', () => {
    it('should define all icon color variants', () => {
      expect(theme.iconColors.purple).toBeDefined();
      expect(theme.iconColors.orange).toBeDefined();
      expect(theme.iconColors.green).toBeDefined();
      expect(theme.iconColors.blue).toBeDefined();
    });

    it('should have bg and icon properties for each variant', () => {
      Object.values(theme.iconColors).forEach((color) => {
        expect(color.bg).toBeTruthy();
        expect(color.icon).toBeTruthy();
        expect(color.bg).toMatch(/^#[0-9A-F]{6}$/i);
        expect(color.icon).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });
  });

  describe('Subscription Colors', () => {
    it('should define all subscription status colors', () => {
      expect(theme.subscriptionColors.trial).toBeDefined();
      expect(theme.subscriptionColors.active).toBeDefined();
      expect(theme.subscriptionColors.grace_period).toBeDefined();
      expect(theme.subscriptionColors.cancelled).toBeDefined();
      expect(theme.subscriptionColors.none).toBeDefined();
    });

    it('should have bg and text properties for each status', () => {
      Object.values(theme.subscriptionColors).forEach((color) => {
        expect(color.bg).toBeTruthy();
        expect(color.text).toBeTruthy();
      });
    });
  });

  describe('Account Status Colors', () => {
    it('should define all account status colors', () => {
      expect(theme.accountStatusColors.active).toBeDefined();
      expect(theme.accountStatusColors.suspended).toBeDefined();
      expect(theme.accountStatusColors.banned).toBeDefined();
    });

    it('should have bg and text properties for each status', () => {
      Object.values(theme.accountStatusColors).forEach((color) => {
        expect(color.bg).toBeTruthy();
        expect(color.text).toBeTruthy();
      });
    });
  });
});
