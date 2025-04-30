// Basic Jest testing setup
const sinon = require('sinon');

// Setup global testing objects
global.sinon = sinon;

// Set up test environment variables
process.env.NODE_ENV = 'test';
