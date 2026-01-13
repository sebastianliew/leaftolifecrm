import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

const config: Config = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.ts'],
  testTimeout: 10000,
  verbose: true,
  collectCoverageFrom: [
    'src/hooks/**/*.ts',
    'src/hooks/**/*.tsx',
    'src/components/inventory/**/*.tsx',
    'src/components/transactions/**/*.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ]
};

export default createJestConfig(config);
