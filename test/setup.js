// Using explicit import because Chai is an ESM module
import { expect as chaiExpect } from 'chai';
import sinon from 'sinon';

// Setup global objects for test compatibility
global.expect = chaiExpect;
global.sinon = sinon;

// Set up test environment variables
process.env.NODE_ENV = 'test';