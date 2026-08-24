/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.e2e.test.ts',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/.next/'],
  // Playwright-based E2E suites must run via `npm run test:playwright`, never
  // Jest — @playwright/test throws "needs to be invoked via 'npx playwright
  // test'" under Jest. Exclude them here so `npm run test:e2e` (Jest) only
  // collects the Jest-based E2E suites (id-badge-admin, payout-fees,
  // review-moderation, e2e/id-badge-messages, e2e/items-flagged-status,
  // src/__tests__/integration, src/app/badges).
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/__tests__/admin-payouts-earnings\\.e2e\\.test\\.ts$',
    '/__tests__/group-l-listing-approval\\.e2e\\.test\\.ts$',
    '/__tests__/nodes\\.e2e\\.test\\.ts$',
    '/__tests__/e2e/(bulk-deactivate|cart-admin-config|category-crud|category-reorder|category-suggestion-approve|sp-config-category|sub-011-subscription-management|tax-admin-config|trade-disputes)\\.e2e\\.test\\.ts$',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        types: ['jest', '@testing-library/jest-dom', 'node'],
      },
    },
  },
};

module.exports = config;
