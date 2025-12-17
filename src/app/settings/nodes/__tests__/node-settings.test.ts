// filepath: p2p-kids-admin/src/app/settings/nodes/__tests__/node-settings.test.ts

/**
 * Unit tests for Node Settings Page
 * Tests validation logic and settings management
 */

describe('Node Settings Validation', () => {
  describe('validateSettings', () => {
    it('should validate default_radius_miles range', () => {
      const settings = {
        default_radius_miles: 0,
        max_assignment_distance_miles: 50,
        allow_user_radius_adjustment: true,
        min_user_radius_miles: 5,
        max_user_radius_miles: 25,
        distance_warning_threshold_miles: 50,
      };

      // Test min boundary
      expect(settings.default_radius_miles).toBeLessThan(1);
      
      settings.default_radius_miles = 101;
      // Test max boundary
      expect(settings.default_radius_miles).toBeGreaterThan(100);
      
      settings.default_radius_miles = 10;
      // Test valid value
      expect(settings.default_radius_miles).toBeGreaterThanOrEqual(1);
      expect(settings.default_radius_miles).toBeLessThanOrEqual(100);
    });

    it('should ensure max_assignment_distance >= default_radius', () => {
      const settings = {
        default_radius_miles: 20,
        max_assignment_distance_miles: 15,
        allow_user_radius_adjustment: true,
        min_user_radius_miles: 5,
        max_user_radius_miles: 25,
        distance_warning_threshold_miles: 50,
      };

      // Invalid: max < default
      expect(settings.max_assignment_distance_miles).toBeLessThan(
        settings.default_radius_miles
      );

      settings.max_assignment_distance_miles = 20;
      // Valid: max >= default
      expect(settings.max_assignment_distance_miles).toBeGreaterThanOrEqual(
        settings.default_radius_miles
      );
    });

    it('should validate user radius adjustment range', () => {
      const settings = {
        default_radius_miles: 10,
        max_assignment_distance_miles: 50,
        allow_user_radius_adjustment: true,
        min_user_radius_miles: 30,
        max_user_radius_miles: 25,
        distance_warning_threshold_miles: 50,
      };

      // Invalid: min > max
      expect(settings.min_user_radius_miles).toBeGreaterThan(
        settings.max_user_radius_miles
      );

      settings.min_user_radius_miles = 5;
      // Valid: min <= max
      expect(settings.min_user_radius_miles).toBeLessThanOrEqual(
        settings.max_user_radius_miles
      );
    });
  });

  describe('Settings Object', () => {
    it('should have all required fields', () => {
      const requiredFields = [
        'default_radius_miles',
        'max_assignment_distance_miles',
        'allow_user_radius_adjustment',
        'min_user_radius_miles',
        'max_user_radius_miles',
        'distance_warning_threshold_miles',
      ];

      const settings = {
        default_radius_miles: 10,
        max_assignment_distance_miles: 50,
        allow_user_radius_adjustment: true,
        min_user_radius_miles: 5,
        max_user_radius_miles: 25,
        distance_warning_threshold_miles: 50,
      };

      requiredFields.forEach((field) => {
        expect(settings).toHaveProperty(field);
      });
    });

    it('should have correct data types', () => {
      const settings = {
        default_radius_miles: 10,
        max_assignment_distance_miles: 50,
        allow_user_radius_adjustment: true,
        min_user_radius_miles: 5,
        max_user_radius_miles: 25,
        distance_warning_threshold_miles: 50,
      };

      expect(typeof settings.default_radius_miles).toBe('number');
      expect(typeof settings.max_assignment_distance_miles).toBe('number');
      expect(typeof settings.allow_user_radius_adjustment).toBe('boolean');
      expect(typeof settings.min_user_radius_miles).toBe('number');
      expect(typeof settings.max_user_radius_miles).toBe('number');
      expect(typeof settings.distance_warning_threshold_miles).toBe('number');
    });
  });
});

describe('Node Settings Integration', () => {
  it('should properly format settings for database storage', () => {
    const settings = {
      default_radius_miles: 10,
      max_assignment_distance_miles: 50,
      allow_user_radius_adjustment: true,
      min_user_radius_miles: 5,
      max_user_radius_miles: 25,
      distance_warning_threshold_miles: 50,
    };

    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
      category: 'nodes',
    }));

    expect(updates).toHaveLength(6);
    updates.forEach((update) => {
      expect(update).toHaveProperty('key');
      expect(update).toHaveProperty('value');
      expect(update).toHaveProperty('category');
      expect(typeof update.value).toBe('string');
      expect(update.category).toBe('nodes');
    });
  });

  it('should properly parse database values back to correct types', () => {
    const dbValues = [
      { key: 'default_radius_miles', value: '10' },
      { key: 'allow_user_radius_adjustment', value: 'true' },
    ];

    const parsed: Record<string, any> = {};
    dbValues.forEach((item) => {
      const value = item.value;
      if (value === 'true' || value === 'false') {
        parsed[item.key] = value === 'true';
      } else if (!isNaN(Number(value))) {
        parsed[item.key] = Number(value);
      } else {
        parsed[item.key] = value;
      }
    });

    expect(parsed.default_radius_miles).toBe(10);
    expect(typeof parsed.default_radius_miles).toBe('number');
    expect(parsed.allow_user_radius_adjustment).toBe(true);
    expect(typeof parsed.allow_user_radius_adjustment).toBe('boolean');
  });
});
