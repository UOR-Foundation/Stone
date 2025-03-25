module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest']
  },
  // Removed extensionsToTreatAsEsm: ['.ts', '.tsx', '.mjs'] to fix the error
  transformIgnorePatterns: [
    // Tell Jest to transform node_modules packages using ESM
    'node_modules/(?!(node-fetch|octokit|@octokit|chalk)/)'
  ],
  moduleNameMapper: {
    // Mock ESM modules for compatibility with Jest
    'node-fetch': '<rootDir>/test/mocks/node-fetch.js',
    'octokit': '<rootDir>/test/mocks/octokit.js',
    'chalk': '<rootDir>/test/mocks/chalk.js',
  },
  // Setup Jest test environment
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
};