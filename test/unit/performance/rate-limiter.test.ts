import { expect } from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import { RateLimiter } from '../../../src/performance/rate-limiter';
import { LoggerService } from '../../../src/services/logger-service';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };
    
    clock = sinon.useFakeTimers();
    
    rateLimiter = new RateLimiter(loggerStub);
  });

  afterEach(() => {
    clock.restore();
  });

  describe('registerLimit', () => {
    it('should register a rate limit with a key', () => {
      rateLimiter.registerLimit('github-api', 5000, 60);
      
      const limits = rateLimiter.getLimits();
      expect(limits).to.have.property('github-api');
      expect(limits['github-api'].maxRequests).to.equal(5000);
      expect(limits['github-api'].windowSeconds).to.equal(60);
    });

    it('should override existing limits with the same key', () => {
      rateLimiter.registerLimit('github-api', 5000, 60);
      rateLimiter.registerLimit('github-api', 3000, 30);
      
      const limits = rateLimiter.getLimits();
      expect(limits['github-api'].maxRequests).to.equal(3000);
      expect(limits['github-api'].windowSeconds).to.equal(30);
    });
  });

  describe('acquireToken', () => {
    it('should return true when request is within rate limit', async () => {
      rateLimiter.registerLimit('search-api', 30, 60);
      
      // First 30 requests should be successful
      for (let i = 0; i < 30; i++) {
        const result = await rateLimiter.acquireToken('search-api');
        expect(result.success).to.be.true;
        expect(result.remaining).to.equal(30 - i - 1);
      }
    });

    it('should return false when rate limit is exceeded', async () => {
      rateLimiter.registerLimit('search-api', 3, 60);
      
      // First 3 requests should be successful
      for (let i = 0; i < 3; i++) {
        const result = await rateLimiter.acquireToken('search-api');
        expect(result.success).to.be.true;
      }
      
      // Next request should be denied
      const result = await rateLimiter.acquireToken('search-api');
      expect(result.success).to.be.false;
      expect(result.retryAfter).to.be.a('number');
    });

    it('should return false with retryAfter when limit is exceeded', async () => {
      rateLimiter.registerLimit('api', 2, 60);
      
      // Use up the limit
      await rateLimiter.acquireToken('api');
      await rateLimiter.acquireToken('api');
      
      // Next request should fail with retryAfter
      const result = await rateLimiter.acquireToken('api');
      expect(result.success).to.be.false;
      expect(result.retryAfter).to.be.at.least(1);
      expect(result.remaining).to.equal(0);
    });

    it('should reset token count after window time has passed', async () => {
      rateLimiter.registerLimit('api', 2, 60);
      
      // Use up the limit
      await rateLimiter.acquireToken('api');
      await rateLimiter.acquireToken('api');
      
      // Next request should fail
      let result = await rateLimiter.acquireToken('api');
      expect(result.success).to.be.false;
      
      // Advance time past the window
      clock.tick(61 * 1000);
      
      // Next request should succeed after reset
      result = await rateLimiter.acquireToken('api');
      expect(result.success).to.be.true;
      expect(result.remaining).to.equal(1);
    });

    it('should handle unknown limit keys by creating a default limit', async () => {
      // No limit registered for 'unknown-api'
      const result = await rateLimiter.acquireToken('unknown-api');
      
      // Should create a default limit and succeed
      expect(result.success).to.be.true;
      
      const limits = rateLimiter.getLimits();
      expect(limits).to.have.property('unknown-api');
    });
  });

  describe('isRateLimited', () => {
    it('should return false if limit is not reached', async () => {
      rateLimiter.registerLimit('api', 2, 60);
      
      // No requests yet
      const result = rateLimiter.isRateLimited('api');
      expect(result.limited).to.be.false;
      expect(result.remaining).to.equal(2);
    });

    it('should return true if limit is reached', async () => {
      rateLimiter.registerLimit('api', 2, 60);
      
      // Use up the limit
      await rateLimiter.acquireToken('api');
      await rateLimiter.acquireToken('api');
      
      // Check if limited
      const result = rateLimiter.isRateLimited('api');
      expect(result.limited).to.be.true;
      expect(result.remaining).to.equal(0);
      expect(result.retryAfter).to.be.a('number');
    });
  });

  describe('resetLimits', () => {
    it('should reset usage counters for a specific limit', async () => {
      rateLimiter.registerLimit('api1', 2, 60);
      rateLimiter.registerLimit('api2', 5, 60);
      
      // Use up both limits
      await rateLimiter.acquireToken('api1');
      await rateLimiter.acquireToken('api1');
      await rateLimiter.acquireToken('api2');
      await rateLimiter.acquireToken('api2');
      
      // Reset only api1
      rateLimiter.resetLimit('api1');
      
      // api1 should be reset
      const result1 = rateLimiter.isRateLimited('api1');
      expect(result1.limited).to.be.false;
      expect(result1.remaining).to.equal(2);
      
      // api2 should still have usage
      const result2 = rateLimiter.isRateLimited('api2');
      expect(result2.remaining).to.equal(3);
    });

    it('should reset all limits when called without key', async () => {
      rateLimiter.registerLimit('api1', 2, 60);
      rateLimiter.registerLimit('api2', 2, 60);
      
      // Use up both limits
      await rateLimiter.acquireToken('api1');
      await rateLimiter.acquireToken('api1');
      await rateLimiter.acquireToken('api2');
      await rateLimiter.acquireToken('api2');
      
      // Reset all
      rateLimiter.resetAllLimits();
      
      // Both should be reset
      const result1 = rateLimiter.isRateLimited('api1');
      expect(result1.limited).to.be.false;
      expect(result1.remaining).to.equal(2);
      
      const result2 = rateLimiter.isRateLimited('api2');
      expect(result2.limited).to.be.false;
      expect(result2.remaining).to.equal(2);
    });
  });

  describe('waitForToken', () => {
    it('should return immediately if limit is not reached', async () => {
      rateLimiter.registerLimit('api', 2, 60);
      
      const start = Date.now();
      clock.tick(start);
      
      await rateLimiter.waitForToken('api');
      
      // Should not have advanced the clock
      expect(Date.now() - start).to.equal(0);
    });

    it('should wait until token is available', async () => {
      rateLimiter.registerLimit('api', 1, 5); // 1 request per 5 seconds
      
      // Use the token
      await rateLimiter.acquireToken('api');
      
      // Start waiting for next token with a 10 second timeout
      const tokenPromise = rateLimiter.waitForToken('api', 10);
      
      // Advance time to just before reset
      clock.tick(4900);
      
      // Promise should not be resolved yet
      const isResolved = await Promise.race([
        tokenPromise.then(() => true),
        Promise.resolve(false)
      ]);
      expect(isResolved).to.be.false;
      
      // Advance time past reset
      clock.tick(200); // total 5.1 seconds
      
      // Now the promise should resolve
      await tokenPromise;
      
      // Should be able to get a token now
      const result = await rateLimiter.acquireToken('api');
      expect(result.success).to.be.true;
    });

    it('should time out if token does not become available', async () => {
      rateLimiter.registerLimit('api', 1, 60); // 1 request per minute
      
      // Use the token
      await rateLimiter.acquireToken('api');
      
      // Try to wait with a 5 second timeout
      try {
        await rateLimiter.waitForToken('api', 5);
        // Should not reach here
        expect.fail('Should have timed out');
      } catch (error) {
        expect(error.message).to.include('Timeout waiting for rate limit token');
      }
    });
  });

  describe('updateLimitFromResponse', () => {
    it('should update rate limit based on response headers', () => {
      // Initial limit guess
      rateLimiter.registerLimit('github-api', 1000, 3600);
      
      // Update from response headers
      rateLimiter.updateLimitFromResponse('github-api', {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4990',
        'x-ratelimit-reset': `${Math.floor(Date.now() / 1000) + 3600}`
      });
      
      const limits = rateLimiter.getLimits();
      expect(limits['github-api'].maxRequests).to.equal(5000);
      expect(limits['github-api'].used).to.equal(10); // 5000 - 4990
    });

    it('should handle different header formats', () => {
      rateLimiter.registerLimit('api-a', 100, 60);
      rateLimiter.registerLimit('api-b', 100, 60);
      
      // GitHub-style headers
      rateLimiter.updateLimitFromResponse('api-a', {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4900',
        'x-ratelimit-reset': `${Math.floor(Date.now() / 1000) + 3600}`
      });
      
      // Generic headers
      rateLimiter.updateLimitFromResponse('api-b', {
        'rate-limit': '1000',
        'rate-limit-remaining': '950',
        'rate-limit-reset': `${Date.now() + 60000}`
      });
      
      const limits = rateLimiter.getLimits();
      expect(limits['api-a'].maxRequests).to.equal(5000);
      expect(limits['api-a'].used).to.equal(100);
      
      expect(limits['api-b'].maxRequests).to.equal(1000);
      expect(limits['api-b'].used).to.equal(50);
    });

    it('should auto-register a new limit when one does not exist', () => {
      // No existing limit for 'new-api'
      rateLimiter.updateLimitFromResponse('new-api', {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '995',
        'x-ratelimit-reset': `${Math.floor(Date.now() / 1000) + 60}`
      });
      
      const limits = rateLimiter.getLimits();
      expect(limits).to.have.property('new-api');
      expect(limits['new-api'].maxRequests).to.equal(1000);
      expect(limits['new-api'].used).to.equal(5);
      expect(limits['new-api'].windowSeconds).to.be.at.least(60);
    });
  });
});