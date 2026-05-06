// FILE: admin-portal/src/types/education-errors.ts
// MODULE-18 V1 EDU-002: Education error classes (admin-facing)

/**
 * Thrown when content validation fails (title/body length, invalid URL, etc.)
 */
export class ContentValidationError extends Error {
  public readonly code = 'CONTENT_VALIDATION';
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ContentValidationError';
    this.field = field;

    // Maintains proper stack trace for where our error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContentValidationError);
    }
  }
}

/**
 * Thrown when a non-admin user attempts an admin-only operation
 */
export class UnauthorizedError extends Error {
  public readonly code = 'UNAUTHORIZED';
  public readonly requiredRole?: string;

  constructor(message: string, requiredRole?: string) {
    super(message);
    this.name = 'UnauthorizedError';
    this.requiredRole = requiredRole;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedError);
    }
  }
}

/**
 * Thrown when attempting to publish a section when another section
 * of the same type is already published (violates partial unique index)
 */
export class DuplicatePublishedSectionError extends Error {
  public readonly code = 'DUPLICATE_PUBLISHED_SECTION';
  public readonly sectionType?: string;

  constructor(message: string, sectionType?: string) {
    super(message);
    this.name = 'DuplicatePublishedSectionError';
    this.sectionType = sectionType;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DuplicatePublishedSectionError);
    }
  }
}
