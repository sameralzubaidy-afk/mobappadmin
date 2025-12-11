module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'tsx', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  roots: ['<rootDir>/src'],
  collectCoverage: false,
};
