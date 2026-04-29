// FILE: p2p-kids-admin/src/types/errors.ts
// ADMIN-V3-002: Typed error classes with stable error codes
// Module: MODULE-12-ADMIN-V3-CATEGORIES

/**
 * Base error class for category management errors
 */
abstract class CategoryError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when attempting to create/update a category with a duplicate name
 * (case-insensitive uniqueness violation)
 */
export class DuplicateNameError extends CategoryError {
  readonly code = 'DUPLICATE_NAME' as const;
  readonly existingCategoryId: string;

  constructor(name: string, existingCategoryId: string) {
    super(`A category named "${name}" already exists (case-insensitive).`);
    this.existingCategoryId = existingCategoryId;
  }
}

/**
 * Thrown when attempting to delete a category that still has items
 */
export class CategoryNotEmptyError extends CategoryError {
  readonly code = 'CATEGORY_NOT_EMPTY' as const;
  readonly categoryId: string;
  readonly itemCount: number;

  constructor(categoryId: string, itemCount: number) {
    const itemWord = itemCount === 1 ? 'item' : 'items';
    super(
      `Cannot delete category: ${itemCount} ${itemWord} still assigned. ` +
      `Reassign or delete ${itemWord} first.`
    );
    this.categoryId = categoryId;
    this.itemCount = itemCount;
  }
}

/**
 * Thrown when SP rate values are outside the legal bounds
 * (earning: 1.05–1.40, spending cap: 50–80)
 */
export class SPRateOutOfRangeError extends CategoryError {
  readonly code = 'SP_RATE_OUT_OF_RANGE' as const;
  readonly field: 'sp_earning_multiplier' | 'sp_spending_cap_percent';
  readonly value: number;
  readonly min: number;
  readonly max: number;

  constructor(
    field: 'sp_earning_multiplier' | 'sp_spending_cap_percent',
    value: number,
    min: number,
    max: number
  ) {
    const fieldName = field === 'sp_earning_multiplier' 
      ? 'SP Earning Multiplier' 
      : 'SP Spending Cap %';
    const minText = field === 'sp_earning_multiplier' ? min.toFixed(2) : String(min);
    const maxText = field === 'sp_earning_multiplier' ? max.toFixed(2) : String(max);
    super(
      `${fieldName} must be between ${minText} and ${maxText}, got ${value}.`
    );
    this.field = field;
    this.value = value;
    this.min = min;
    this.max = max;
  }
}

/**
 * Thrown when icon upload validation fails
 */
export class IconUploadError extends CategoryError {
  readonly code = 'ICON_UPLOAD_ERROR' as const;
  readonly reason: 'bad_type' | 'too_large' | 'too_small' | 'upload_failed';
  readonly details?: string;

  constructor(
    reason: 'bad_type' | 'too_large' | 'too_small' | 'upload_failed',
    details?: string
  ) {
    const messages = {
      bad_type: 'Only PNG and SVG files are allowed.',
      too_large: 'File size must be 500 KB or less.',
      too_small: 'Image must be at least 100×100 pixels.',
      upload_failed: 'Upload failed. Please try again.',
    };
    const message = details ? `${messages[reason]} ${details}` : messages[reason];
    super(message);
    this.reason = reason;
    this.details = details;
  }
}

/**
 * Thrown when a non-admin user attempts an admin-only action
 */
export class UnauthorizedError extends CategoryError {
  readonly code = 'UNAUTHORIZED' as const;
  readonly action: string;

  constructor(action: string = 'perform this action') {
    super(`Admin role required to ${action}.`);
    this.action = action;
  }
}

/**
 * Thrown when attempting to deactivate the "Other" category
 */
export class CannotDeactivateOtherError extends CategoryError {
  readonly code = 'CANNOT_DEACTIVATE_OTHER' as const;

  constructor() {
    super('The "Other" category cannot be deactivated.');
  }
}

/**
 * Thrown when a category suggestion is not found
 */
export class SuggestionNotFoundError extends CategoryError {
  readonly code = 'SUGGESTION_NOT_FOUND' as const;
  readonly suggestionId: string;

  constructor(suggestionId: string) {
    super(`Category suggestion ${suggestionId} not found.`);
    this.suggestionId = suggestionId;
  }
}

/**
 * Thrown when attempting to approve/reject/merge a suggestion that's not pending
 */
export class InvalidSuggestionStatusError extends CategoryError {
  readonly code = 'INVALID_SUGGESTION_STATUS' as const;
  readonly currentStatus: string;
  readonly expectedStatus: string;

  constructor(currentStatus: string, expectedStatus: string = 'pending') {
    super(
      `Cannot process suggestion: current status is "${currentStatus}", expected "${expectedStatus}".`
    );
    this.currentStatus = currentStatus;
    this.expectedStatus = expectedStatus;
  }
}

/**
 * Type guard to check if an error is a CategoryError
 */
export function isCategoryError(error: unknown): error is CategoryError {
  return error instanceof CategoryError;
}

/**
 * Extract error code from any error (returns 'UNKNOWN' for non-CategoryErrors)
 */
export function getErrorCode(error: unknown): string {
  if (isCategoryError(error)) {
    return error.code;
  }
  return 'UNKNOWN';
}
