module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      useESM: true
    }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mjs'],
  transformIgnorePatterns: [
    // Tell Jest to transform node_modules packages using ESM
    'node_modules/(?!(node-fetch|octokit|@octokit|chalk|chai|sinon)/)'
  ],
  moduleNameMapper: {
    // Mock ESM modules for compatibility with Jest
    'node-fetch': '<rootDir>/test/mocks/node-fetch.js',
    'octokit': '<rootDir>/test/mocks/octokit.js',
    'chalk': '<rootDir>/test/mocks/chalk.js',
  },
  // Setup Jest to handle chai and sinon integration
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
};