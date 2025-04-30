module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/test/**/*.test.ts'],
  testPathIgnorePatterns: [
    'node_modules/',
    '/test/unit/performance/',
    '/test/unit/scalability/'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
  coverageThreshold: {
    global: {
      lines: 80,
      statements: 75,
      functions: 75,
      branches: 70
    }
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest']
  },
  // Removed extensionsToTreatAsEsm: ['.ts', '.tsx', '.mjs'] to fix the error
  transformIgnorePatterns: [
    // Tell Jest to transform node_modules packages using ESM
    'node_modules/(?!(node-fetch|octokit|@octokit|chalk|react)/)'
  ],
  moduleNameMapper: {
    // Mock ESM modules for compatibility with Jest
    'node-fetch': '<rootDir>/test/mocks/node-fetch.js',
    'octokit': '<rootDir>/test/mocks/octokit.js',
    'chalk': '<rootDir>/test/mocks/chalk.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/test/mocks/style-mock.js',
  },
  // Setup Jest test environment
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  ...(process.env.CI && { maxWorkers: '50%' }),
};
