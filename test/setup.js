// Basic Jest testing setup
const sinon = require('./mocks/sinon');
const chai = require('./mocks/chai');
const sinonChai = require('./mocks/sinon-chai');
const mocha = require('./mocks/mocha');

const jestExpect = global.expect;

// Setup global testing objects
global.sinon = sinon;
global.describe = mocha.describe;
global.it = mocha.it;
global.beforeEach = mocha.beforeEach;
global.afterEach = mocha.afterEach;

global.expect = jestExpect;

global.fail = (message) => {
  throw new Error(message);
};

// Set up test environment variables
process.env.NODE_ENV = 'test';

module.exports = {
  jestExpect
};
