import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@backend/(.*)$': '<rootDir>/$1',
    '^@models/(.*)$': '<rootDir>/models/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@controllers/(.*)$': '<rootDir>/controllers/$1',
    '^@routes/(.*)$': '<rootDir>/routes/$1',
    '^@middleware/(.*)$': '<rootDir>/middlewares/$1',
    '^@middlewares/(.*)$': '<rootDir>/middlewares/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json'
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  collectCoverageFrom: [
    'services/**/*.ts',
    'models/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};

export default config;
