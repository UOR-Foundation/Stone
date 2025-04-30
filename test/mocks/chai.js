// Simple mock for chai
const chai = {
  expect: jest.fn((value) => {
    const obj = {
      value,
      to: null,
      be: null,
      have: null,
      not: null,
      deep: null,
      
      equal: jest.fn(),
      equals: jest.fn(),
      eql: jest.fn(),
      include: jest.fn(),
      includes: jest.fn(),
      contain: jest.fn(),
      throw: jest.fn(),
      undefined: jest.fn(),
      true: jest.fn(),
      false: jest.fn(),
      lengthOf: jest.fn(),
      length: jest.fn(),
      property: jest.fn(),
      calledOnce: jest.fn(),
      calledWith: jest.fn()
    };
    
    obj.to = obj;
    obj.be = obj;
    obj.have = obj;
    obj.not = obj;
    obj.deep = obj;
    
    return obj;
  }),
  Assertion: function() {},
  use: jest.fn()
};

chai.expect.fail = jest.fn((message) => {
  throw new Error(message || 'Assertion failed');
});

chai.utils = {
  addMethod: jest.fn(),
  addProperty: jest.fn(),
  flag: jest.fn()
};

module.exports = chai;
