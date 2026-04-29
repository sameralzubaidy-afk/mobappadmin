// FILE: p2p-kids-admin/src/types/__tests__/errors.test.ts
// ADMIN-V3-002: Unit tests for error classes
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import {
  DuplicateNameError,
  CategoryNotEmptyError,
  SPRateOutOfRangeError,
  IconUploadError,
  UnauthorizedError,
  CannotDeactivateOtherError,
  SuggestionNotFoundError,
  InvalidSuggestionStatusError,
  isCategoryError,
  getErrorCode,
} from '../errors';

describe('Category Error Classes', () => {
  describe('DuplicateNameError', () => {
    it('should create error with correct code and message', () => {
      const error = new DuplicateNameError('Books', 'category-123');

      expect(error.code).toBe('DUPLICATE_NAME');
      expect(error.message).toContain('Books');
      expect(error.message).toContain('already exists');
      expect(error.existingCategoryId).toBe('category-123');
      expect(error.name).toBe('DuplicateNameError');
    });

    it('should extend Error', () => {
      const error = new DuplicateNameError('Toys', 'category-456');

      expect(error instanceof Error).toBe(true);
      expect(error.stack).toBeDefined();
    });
  });

  describe('CategoryNotEmptyError', () => {
    it('should create error with singular item count', () => {
      const error = new CategoryNotEmptyError('category-123', 1);

      expect(error.code).toBe('CATEGORY_NOT_EMPTY');
      expect(error.message).toContain('1 item');
      expect(error.message).not.toContain('items');
      expect(error.categoryId).toBe('category-123');
      expect(error.itemCount).toBe(1);
    });

    it('should create error with plural item count', () => {
      const error = new CategoryNotEmptyError('category-456', 42);

      expect(error.code).toBe('CATEGORY_NOT_EMPTY');
      expect(error.message).toContain('42 items');
      expect(error.categoryId).toBe('category-456');
      expect(error.itemCount).toBe(42);
    });

    it('should include remediation guidance', () => {
      const error = new CategoryNotEmptyError('category-789', 10);

      expect(error.message).toContain('Reassign or delete items first');
    });
  });

  describe('SPRateOutOfRangeError', () => {
    it('should create error for earning multiplier out of range', () => {
      const error = new SPRateOutOfRangeError('sp_earning_multiplier', 1.50, 1.05, 1.40);

      expect(error.code).toBe('SP_RATE_OUT_OF_RANGE');
      expect(error.message).toContain('SP Earning Multiplier');
      expect(error.message).toContain('1.05');
      expect(error.message).toContain('1.40');
      expect(error.message).toContain('1.5');
      expect(error.field).toBe('sp_earning_multiplier');
      expect(error.value).toBe(1.50);
      expect(error.min).toBe(1.05);
      expect(error.max).toBe(1.40);
    });

    it('should create error for spending cap out of range', () => {
      const error = new SPRateOutOfRangeError('sp_spending_cap_percent', 90, 50, 80);

      expect(error.code).toBe('SP_RATE_OUT_OF_RANGE');
      expect(error.message).toContain('SP Spending Cap %');
      expect(error.message).toContain('50');
      expect(error.message).toContain('80');
      expect(error.message).toContain('90');
      expect(error.field).toBe('sp_spending_cap_percent');
      expect(error.value).toBe(90);
    });
  });

  describe('IconUploadError', () => {
    it('should create error for bad file type', () => {
      const error = new IconUploadError('bad_type');

      expect(error.code).toBe('ICON_UPLOAD_ERROR');
      expect(error.message).toContain('PNG and SVG');
      expect(error.reason).toBe('bad_type');
      expect(error.details).toBeUndefined();
    });

    it('should create error for file too large', () => {
      const error = new IconUploadError('too_large', 'File is 2 MB');

      expect(error.code).toBe('ICON_UPLOAD_ERROR');
      expect(error.message).toContain('500 KB');
      expect(error.message).toContain('File is 2 MB');
      expect(error.reason).toBe('too_large');
      expect(error.details).toBe('File is 2 MB');
    });

    it('should create error for dimensions too small', () => {
      const error = new IconUploadError('too_small', '50×50 px');

      expect(error.code).toBe('ICON_UPLOAD_ERROR');
      expect(error.message).toContain('100×100');
      expect(error.message).toContain('50×50 px');
      expect(error.reason).toBe('too_small');
    });

    it('should create error for upload failure', () => {
      const error = new IconUploadError('upload_failed', 'Network error');

      expect(error.code).toBe('ICON_UPLOAD_ERROR');
      expect(error.message).toContain('Upload failed');
      expect(error.message).toContain('Network error');
      expect(error.reason).toBe('upload_failed');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create error with default action', () => {
      const error = new UnauthorizedError();

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toContain('Admin role required');
      expect(error.message).toContain('perform this action');
      expect(error.action).toBe('perform this action');
    });

    it('should create error with custom action', () => {
      const error = new UnauthorizedError('delete categories');

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toContain('delete categories');
      expect(error.action).toBe('delete categories');
    });
  });

  describe('CannotDeactivateOtherError', () => {
    it('should create error with correct message', () => {
      const error = new CannotDeactivateOtherError();

      expect(error.code).toBe('CANNOT_DEACTIVATE_OTHER');
      expect(error.message).toContain('"Other" category');
      expect(error.message).toContain('cannot be deactivated');
    });
  });

  describe('SuggestionNotFoundError', () => {
    it('should create error with suggestion ID', () => {
      const error = new SuggestionNotFoundError('suggestion-123');

      expect(error.code).toBe('SUGGESTION_NOT_FOUND');
      expect(error.message).toContain('suggestion-123');
      expect(error.message).toContain('not found');
      expect(error.suggestionId).toBe('suggestion-123');
    });
  });

  describe('InvalidSuggestionStatusError', () => {
    it('should create error with default expected status', () => {
      const error = new InvalidSuggestionStatusError('approved');

      expect(error.code).toBe('INVALID_SUGGESTION_STATUS');
      expect(error.message).toContain('approved');
      expect(error.message).toContain('pending');
      expect(error.currentStatus).toBe('approved');
      expect(error.expectedStatus).toBe('pending');
    });

    it('should create error with custom expected status', () => {
      const error = new InvalidSuggestionStatusError('rejected', 'approved');

      expect(error.code).toBe('INVALID_SUGGESTION_STATUS');
      expect(error.message).toContain('rejected');
      expect(error.message).toContain('approved');
      expect(error.currentStatus).toBe('rejected');
      expect(error.expectedStatus).toBe('approved');
    });
  });

  describe('isCategoryError', () => {
    it('should return true for category errors', () => {
      const error1 = new DuplicateNameError('Test', 'id-123');
      const error2 = new UnauthorizedError();
      const error3 = new IconUploadError('bad_type');

      expect(isCategoryError(error1)).toBe(true);
      expect(isCategoryError(error2)).toBe(true);
      expect(isCategoryError(error3)).toBe(true);
    });

    it('should return false for non-category errors', () => {
      const error1 = new Error('Generic error');
      const error2 = new TypeError('Type error');
      const notError = { message: 'Not an error' };

      expect(isCategoryError(error1)).toBe(false);
      expect(isCategoryError(error2)).toBe(false);
      expect(isCategoryError(notError)).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('should return correct code for category errors', () => {
      const error1 = new DuplicateNameError('Test', 'id-123');
      const error2 = new UnauthorizedError();
      const error3 = new IconUploadError('bad_type');

      expect(getErrorCode(error1)).toBe('DUPLICATE_NAME');
      expect(getErrorCode(error2)).toBe('UNAUTHORIZED');
      expect(getErrorCode(error3)).toBe('ICON_UPLOAD_ERROR');
    });

    it('should return UNKNOWN for non-category errors', () => {
      const error1 = new Error('Generic error');
      const error2 = new TypeError('Type error');
      const notError = { message: 'Not an error' };

      expect(getErrorCode(error1)).toBe('UNKNOWN');
      expect(getErrorCode(error2)).toBe('UNKNOWN');
      expect(getErrorCode(notError)).toBe('UNKNOWN');
    });
  });

  describe('Error code stability', () => {
    it('should have stable const codes for switch statements', () => {
      // This test ensures error codes are const and can be used in switch/case
      const error = new DuplicateNameError('Test', 'id-123');
      
      let switchResult = '';
      switch (error.code) {
        case 'DUPLICATE_NAME':
          switchResult = 'duplicate';
          break;
        case 'CATEGORY_NOT_EMPTY':
          switchResult = 'not_empty';
          break;
        default:
          switchResult = 'unknown';
      }

      expect(switchResult).toBe('duplicate');
    });

    it('should have stable codes across all error types', () => {
      const codes = [
        new DuplicateNameError('', '').code,
        new CategoryNotEmptyError('', 1).code,
        new SPRateOutOfRangeError('sp_earning_multiplier', 1, 1, 1).code,
        new IconUploadError('bad_type').code,
        new UnauthorizedError().code,
        new CannotDeactivateOtherError().code,
        new SuggestionNotFoundError('').code,
        new InvalidSuggestionStatusError('', '').code,
      ];

      // All codes should be unique
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);

      // All codes should be uppercase snake_case
      codes.forEach((code) => {
        expect(code).toMatch(/^[A-Z_]+$/);
      });
    });
  });
});
