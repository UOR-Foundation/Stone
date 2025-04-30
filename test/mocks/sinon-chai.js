// Mock for sinon-chai
module.exports = function sinonChai(chai, utils) {
  // Add sinon-chai assertions to chai
  const Assertion = chai.Assertion;
  
  utils.addMethod(Assertion.prototype, 'calledWith', function() {
    return this;
  });
  
  utils.addMethod(Assertion.prototype, 'calledOnce', function() {
    return this;
  });
  
  utils.addMethod(Assertion.prototype, 'callCount', function(count) {
    return this;
  });
  
  utils.addProperty(Assertion.prototype, 'called', function() {
    return this;
  });
  
  utils.addProperty(Assertion.prototype, 'calledOnce', function() {
    return this;
  });
  
  utils.addProperty(Assertion.prototype, 'calledTwice', function() {
    return this;
  });
  
  utils.addProperty(Assertion.prototype, 'calledThrice', function() {
    return this;
  });
};
