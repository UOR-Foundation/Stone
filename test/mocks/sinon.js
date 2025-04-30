// Mock for sinon
const createStubMethods = () => {
  return {
    returns: jest.fn().mockReturnThis(),
    resolves: jest.fn().mockReturnThis(),
    rejects: jest.fn().mockReturnThis(),
    callsFake: jest.fn().mockReturnThis(),
    withArgs: jest.fn().mockReturnThis(),
    onCall: jest.fn().mockReturnThis(),
    resetHistory: jest.fn(),
    calledOnce: true,
    calledTwice: false,
    calledThrice: false,
    called: true,
    callCount: 0
  };
};

const createStub = () => {
  const fn = jest.fn();
  const methods = createStubMethods();
  
  Object.keys(methods).forEach(key => {
    if (typeof methods[key] === 'function') {
      fn[key] = methods[key];
    } else {
      fn[key] = methods[key];
    }
  });
  
  fn.returns = jest.fn().mockImplementation((val) => {
    fn.mockReturnValue(val);
    return fn;
  });
  
  fn.resolves = jest.fn().mockImplementation((val) => {
    fn.mockResolvedValue(val);
    return fn;
  });
  
  fn.rejects = jest.fn().mockImplementation((err) => {
    fn.mockRejectedValue(err);
    return fn;
  });
  
  return fn;
};

const createLoggerStub = () => {
  return {
    info: createStub(),
    warn: createStub(),
    error: createStub(),
    debug: createStub()
  };
};

const sinon = {
  stub: jest.fn().mockImplementation(() => createStub()),
  spy: jest.fn().mockImplementation(() => createStub()),
  mock: jest.fn(),
  createStubInstance: jest.fn((constructor) => {
    if (constructor && constructor.name === 'LoggerService') {
      return createLoggerStub();
    }
    
    return {
      // Basic stub methods
      execGitCommand: jest.fn().mockResolvedValue({ output: '', exitCode: 0 }),
      writeFile: jest.fn().mockResolvedValue(undefined),
      fileExists: jest.fn().mockResolvedValue(true),
      isGitRepository: jest.fn().mockResolvedValue(true),
      hasUncommittedChanges: jest.fn().mockResolvedValue(false),
      ...createLoggerStub()
    };
  }),
  match: {
    any: jest.fn(() => true),
    string: jest.fn(() => true),
    number: jest.fn(() => true),
    object: jest.fn(() => true),
    array: jest.fn(() => true)
  },
  assert: {
    called: jest.fn(),
    calledWith: jest.fn(),
    calledOnce: jest.fn(),
    notCalled: jest.fn()
  }
};

sinon.SinonStub = createStub();
sinon.SinonStubbedInstance = function(constructor) {
  return sinon.createStubInstance(constructor);
};
sinon.SinonFakeTimers = function() {};

let timeoutCallbacks = [];
let currentTime = 0;

sinon.useFakeTimers = jest.fn().mockReturnValue({
  restore: jest.fn(),
  tick: jest.fn((ms) => {
    jest.advanceTimersByTime(ms);
    return undefined;
  })
});

global.setTimeout = jest.fn((fn, delay) => {
  const id = Math.random().toString(36).substr(2, 9);
  timeoutCallbacks.push({
    id,
    fn,
    time: currentTime + (delay || 0)
  });
  return id;
});

global.clearTimeout = jest.fn((id) => {
  timeoutCallbacks = timeoutCallbacks.filter(cb => cb.id !== id);
});

module.exports = sinon;
