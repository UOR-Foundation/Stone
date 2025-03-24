// Mock for node-fetch
module.exports = jest.fn();
module.exports.Response = jest.fn();
module.exports.Headers = jest.fn();
module.exports.Request = jest.fn();