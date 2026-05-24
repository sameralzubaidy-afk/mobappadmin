import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Jest compatibility shim for legacy test files that still use jest.fn/jest.mock.
(globalThis as any).jest = vi;
