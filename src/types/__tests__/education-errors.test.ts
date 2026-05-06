// FILE: admin-portal/src/types/__tests__/education-errors.test.ts
// MODULE-18 V1 EDU-002: Unit tests for admin education error classes

import {
  ContentValidationError,
  UnauthorizedError,
  DuplicatePublishedSectionError,
} from '../education-errors';

describe('Admin Education Error Classes', () => {
  describe('ContentValidationError', () => {
    it('should have correct code and name', () => {
      const error = new ContentValidationError('Title is too short');

      expect(error.code).toBe('CONTENT_VALIDATION');
      expect(error.name).toBe('ContentValidationError');
      expect(error.message).toBe('Title is too short');
    });

    it('should include field when provided', () => {
      const error = new ContentValidationError('Must be between 3-100 characters', 'title');

      expect(error.field).toBe('title');
      expect(error.message).toBe('Must be between 3-100 characters');
    });

    it('should extend Error correctly', () => {
      const error = new ContentValidationError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ContentValidationError);
    });

    it('should be throwable and catchable', () => {
      const throwError = () => {
        throw new ContentValidationError('Body exceeds 2000 characters', 'body');
      };

      expect(throwError).toThrow(ContentValidationError);
      expect(throwError).toThrow('Body exceeds 2000 characters');

      try {
        throwError();
      } catch (err) {
        if (err instanceof ContentValidationError) {
          expect(err.code).toBe('CONTENT_VALIDATION');
          expect(err.field).toBe('body');
        }
      }
    });
  });

  describe('UnauthorizedError', () => {
    it('should have correct code and name', () => {
      const error = new UnauthorizedError('Admin role required');

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('UnauthorizedError');
      expect(error.message).toBe('Admin role required');
    });

    it('should include requiredRole when provided', () => {
      const error = new UnauthorizedError('Insufficient permissions', 'admin');

      expect(error.requiredRole).toBe('admin');
      expect(error.message).toBe('Insufficient permissions');
    });

    it('should allow undefined requiredRole', () => {
      const error = new UnauthorizedError('Access denied');

      expect(error.requiredRole).toBeUndefined();
    });

    it('should extend Error correctly', () => {
      const error = new UnauthorizedError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('should have proper stack trace', () => {
      const error = new UnauthorizedError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('UnauthorizedError');
    });

    it('should be throwable for non-admin operations', () => {
      const checkAdminRole = (isAdmin: boolean) => {
        if (!isAdmin) {
          throw new UnauthorizedError('Only admins can publish sections', 'admin');
        }
      };

      expect(() => checkAdminRole(false)).toThrow(UnauthorizedError);
      expect(() => checkAdminRole(false)).toThrow('Only admins can publish sections');

      try {
        checkAdminRole(false);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          expect(err.code).toBe('UNAUTHORIZED');
          expect(err.requiredRole).toBe('admin');
        }
      }
    });
  });

  describe('DuplicatePublishedSectionError', () => {
    it('should have correct code and name', () => {
      const error = new DuplicatePublishedSectionError('Section already published');

      expect(error.code).toBe('DUPLICATE_PUBLISHED_SECTION');
      expect(error.name).toBe('DuplicatePublishedSectionError');
      expect(error.message).toBe('Section already published');
    });

    it('should include sectionType when provided', () => {
      const error = new DuplicatePublishedSectionError(
        'A published section of type "sp_definition" already exists',
        'sp_definition'
      );

      expect(error.sectionType).toBe('sp_definition');
      expect(error.message).toContain('sp_definition');
    });

    it('should allow undefined sectionType', () => {
      const error = new DuplicatePublishedSectionError('Duplicate section detected');

      expect(error.sectionType).toBeUndefined();
    });

    it('should extend Error correctly', () => {
      const error = new DuplicatePublishedSectionError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DuplicatePublishedSectionError);
    });

    it('should have proper stack trace', () => {
      const error = new DuplicatePublishedSectionError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DuplicatePublishedSectionError');
    });

    it('should be throwable when violating partial unique index', () => {
      const publishSection = (existingPublished: boolean, sectionType: string) => {
        if (existingPublished) {
          throw new DuplicatePublishedSectionError(
            `Cannot publish: another "${sectionType}" section is already published`,
            sectionType
          );
        }
      };

      expect(() => publishSection(true, 'sp_earning')).toThrow(DuplicatePublishedSectionError);
      expect(() => publishSection(true, 'sp_earning')).toThrow('sp_earning');

      try {
        publishSection(true, 'safety');
      } catch (err) {
        if (err instanceof DuplicatePublishedSectionError) {
          expect(err.code).toBe('DUPLICATE_PUBLISHED_SECTION');
          expect(err.sectionType).toBe('safety');
        }
      }
    });
  });

  describe('Error class type guards', () => {
    it('should distinguish between all three error types', () => {
      const contentError = new ContentValidationError('Invalid title', 'title');
      const authError = new UnauthorizedError('Admin role required', 'admin');
      const duplicateError = new DuplicatePublishedSectionError(
        'Duplicate section',
        'sp_definition'
      );

      const handleError = (err: Error) => {
        if (err instanceof ContentValidationError) {
          return { type: 'content', code: err.code, field: err.field };
        } else if (err instanceof UnauthorizedError) {
          return { type: 'unauthorized', code: err.code, requiredRole: err.requiredRole };
        } else if (err instanceof DuplicatePublishedSectionError) {
          return { type: 'duplicate', code: err.code, sectionType: err.sectionType };
        }
        return { type: 'unknown' };
      };

      expect(handleError(contentError)).toEqual({
        type: 'content',
        code: 'CONTENT_VALIDATION',
        field: 'title',
      });

      expect(handleError(authError)).toEqual({
        type: 'unauthorized',
        code: 'UNAUTHORIZED',
        requiredRole: 'admin',
      });

      expect(handleError(duplicateError)).toEqual({
        type: 'duplicate',
        code: 'DUPLICATE_PUBLISHED_SECTION',
        sectionType: 'sp_definition',
      });
    });
  });

  describe('HTTP status code mapping (for admin API)', () => {
    it('should map to appropriate HTTP status codes', () => {
      const getHttpStatus = (err: Error): number => {
        if (err instanceof ContentValidationError) return 400; // Bad Request
        if (err instanceof UnauthorizedError) return 403; // Forbidden
        if (err instanceof DuplicatePublishedSectionError) return 409; // Conflict
        return 500; // Internal Server Error
      };

      expect(getHttpStatus(new ContentValidationError('Invalid'))).toBe(400);
      expect(getHttpStatus(new UnauthorizedError('No permission'))).toBe(403);
      expect(getHttpStatus(new DuplicatePublishedSectionError('Duplicate'))).toBe(409);
      expect(getHttpStatus(new Error('Unknown'))).toBe(500);
    });
  });
});
