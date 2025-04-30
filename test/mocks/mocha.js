// Mock for mocha
const beforeEachFns = [];
const afterEachFns = [];

module.exports = {
  describe: jest.fn((name, fn) => {
    fn();
  }),
  it: jest.fn((name, fn) => {
    beforeEachFns.forEach(beforeFn => beforeFn());
    
    const result = fn();
    
    afterEachFns.forEach(afterFn => afterFn());
    
    return result;
  }),
  beforeEach: jest.fn(fn => {
    beforeEachFns.push(fn);
  }),
  afterEach: jest.fn(fn => {
    afterEachFns.push(fn);
  })
};
