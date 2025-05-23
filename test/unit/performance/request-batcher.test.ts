import { RequestBatcher } from '../../../src/performance/request-batcher';
import { LoggerService } from '../../../src/services/logger-service';

const sinon = global.sinon;

declare global {
  namespace sinon {
    interface SinonStub {
      returns(obj: any): SinonStub;
      resolves(obj: any): SinonStub;
      rejects(obj: any): SinonStub;
      callsFake(fn: Function): SinonStub;
      calledOnce: boolean;
      callCount: number;
    }
    
    interface SinonFakeTimers {
      tick(ms: number): void;
      restore(): void;
    }
  }
}

interface SinonStub {
  returns(obj: any): SinonStub;
  resolves(obj: any): SinonStub;
  rejects(obj: any): SinonStub;
  callsFake(fn: Function): SinonStub;
  calledOnce: boolean;
  callCount: number;
}

interface SinonFakeTimers {
  tick(ms: number): void;
  restore(): void;
}

declare global {
  var sinon: {
    stub(): SinonStub;
    useFakeTimers(): SinonFakeTimers;
  };
}

describe('RequestBatcher', () => {
  let requestBatcher: RequestBatcher;
  let loggerStub: any;
  let execBatchStub: sinon.SinonStub;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    loggerStub = {
      info: sinon.stub().returns(undefined),
      warn: sinon.stub().returns(undefined),
      error: sinon.stub().returns(undefined),
      debug: sinon.stub().returns(undefined),
      log: sinon.stub().returns(undefined)
    };
    
    execBatchStub = sinon.stub().resolves([]);
    execBatchStub.callsFake((requests: any[]) => {
      return Promise.resolve(requests.map(req => ({ id: req.id, response: { status: 200 } })));
    });
    clock = sinon.useFakeTimers();
    
    const typedExecBatchStub = execBatchStub as unknown as (requests: any[]) => Promise<any[]>;
    const typedLoggerStub = loggerStub as unknown as LoggerService;
    
    requestBatcher = new RequestBatcher({
      maxBatchSize: 5,
      batchTimeoutMs: 100,
      executeBatch: typedExecBatchStub,
      logger: typedLoggerStub
    });
  });

  afterEach(() => {
    clock.restore();
  });

  describe('queueRequest', () => {
    it('should queue a request and return a promise', () => {
      const request = { id: 1, method: 'GET', url: '/api/users/1' };
      const promise = requestBatcher.queueRequest(request);
      
      expect(promise).toBeDefined();
      expect(requestBatcher.getQueueSize()).toEqual(1);
    });

    it('should execute batch when batch size is reached', async () => {
      execBatchStub.resolves([
        { id: 1, response: { status: 200, data: { id: 1, name: 'User 1' } } },
        { id: 2, response: { status: 200, data: { id: 2, name: 'User 2' } } },
        { id: 3, response: { status: 200, data: { id: 3, name: 'User 3' } } },
        { id: 4, response: { status: 200, data: { id: 4, name: 'User 4' } } },
        { id: 5, response: { status: 200, data: { id: 5, name: 'User 5' } } }
      ]);
      
      // Queue 5 requests (which is maxBatchSize)
      const promises: Promise<any>[] = [];
      for (let i = 1; i <= 5; i++) {
        promises.push(requestBatcher.queueRequest({ 
          id: i, 
          method: 'GET', 
          url: `/api/users/${i}` 
        }));
      }
      
      // Batch should be executed immediately when size is reached
      expect(execBatchStub.calledOnce).toBe(true);
      
      // Ensure all promises resolve
      const results = await Promise.all(promises);
      
      expect(results.length).toEqual(5);
      expect(results[0].status).toEqual(200);
      expect(results[0].data.name).toEqual('User 1');
    });

    it('should execute batch after timeout even if batch size not reached', async () => {
      execBatchStub.resolves([
        { id: 1, response: { status: 200, data: { id: 1, name: 'User 1' } } },
        { id: 2, response: { status: 200, data: { id: 2, name: 'User 2' } } }
      ]);
      
      // Queue 2 requests (less than maxBatchSize)
      const promise1 = requestBatcher.queueRequest({ 
        id: 1, 
        method: 'GET', 
        url: '/api/users/1' 
      });
      
      const promise2 = requestBatcher.queueRequest({ 
        id: 2, 
        method: 'GET', 
        url: '/api/users/2' 
      });
      
      // Batch should not execute yet
      expect(execBatchStub.callCount).toEqual(0);
      
      // Advance time to trigger timeout
      clock.tick(101);
      
      // Batch should be executed after timeout
      expect(execBatchStub.calledOnce).toBe(true);
      
      // Ensure promises resolve
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1.status).toEqual(200);
      expect(result1.data.name).toEqual('User 1');
      expect(result2.status).toEqual(200);
      expect(result2.data.name).toEqual('User 2');
    });
  });

  describe('cancelRequest', () => {
    it('should cancel a queued request', async () => {
      const testLogger = {
        info: sinon.stub().returns(undefined),
        warn: sinon.stub().returns(undefined),
        error: sinon.stub().returns(undefined),
        debug: sinon.stub().returns(undefined),
        log: sinon.stub().returns(undefined)
      };
      
      const testExecBatch = sinon.stub().resolves([]);
      
      const testBatcher = new RequestBatcher({
        maxBatchSize: 5,
        batchTimeoutMs: 100,
        executeBatch: testExecBatch as unknown as (requests: any[]) => Promise<any[]>,
        logger: testLogger as unknown as LoggerService
      });
      
      expect(testBatcher.getQueueSize()).toEqual(0);
      
      const request = { id: 1, method: 'GET', url: '/api/users/1' };
      const promise = testBatcher.queueRequest(request);
      
      expect(testBatcher.getQueueSize()).toEqual(1);
      
      // Cancel the request
      const canceled = testBatcher.cancelRequest(1);
      expect(canceled).toBe(true);
      
      // Queue should be empty
      expect(testBatcher.getQueueSize()).toEqual(0);
      
      // The promise should reject
      try {
        await promise;
        // Should not reach here
        fail('Promise should have been rejected');
      } catch (error) {
        expect(error.message).toContain('Request canceled');
      }
    });

    it('should return false if request not found', () => {
      const canceled = requestBatcher.cancelRequest(999);
      expect(canceled).toBe(false);
    });
  });

  describe('prioritizeRequest', () => {
    it('should move a request to the front of the queue', () => {
      // Queue several requests
      requestBatcher.queueRequest({ id: 1, method: 'GET', url: '/api/users/1' });
      requestBatcher.queueRequest({ id: 2, method: 'GET', url: '/api/users/2' });
      requestBatcher.queueRequest({ id: 3, method: 'GET', url: '/api/users/3' });
      
      // Prioritize the last request
      const prioritized = requestBatcher.prioritizeRequest(3);
      expect(prioritized).toBe(true);
      
      // Get the queue for inspection (using internal method for testing)
      const queue = requestBatcher['queue'];
      
      // Request with ID 3 should now be first
      expect(queue[0].id).toEqual(3);
    });

    it('should return false if request not found', () => {
      requestBatcher.queueRequest({ id: 1, method: 'GET', url: '/api/users/1' });
      
      const prioritized = requestBatcher.prioritizeRequest(999);
      expect(prioritized).toBe(false);
    });
  });

  describe('flushQueue', () => {
    it('should immediately execute all queued requests', async () => {
      execBatchStub.resolves([
        { id: 1, response: { status: 200, data: { id: 1 } } },
        { id: 2, response: { status: 200, data: { id: 2 } } },
        { id: 3, response: { status: 200, data: { id: 3 } } }
      ]);
      
      // Queue some requests
      const promise1 = requestBatcher.queueRequest({ id: 1, method: 'GET', url: '/api/users/1' });
      const promise2 = requestBatcher.queueRequest({ id: 2, method: 'GET', url: '/api/users/2' });
      const promise3 = requestBatcher.queueRequest({ id: 3, method: 'GET', url: '/api/users/3' });
      
      // Batch should not execute yet
      expect(execBatchStub.callCount).toEqual(0);
      
      // Flush the queue
      await requestBatcher.flushQueue();
      
      // Batch should be executed
      expect(execBatchStub.calledOnce).toBe(true);
      
      // Queue should be empty
      expect(requestBatcher.getQueueSize()).toEqual(0);
      
      // Promises should be resolved
      const results = await Promise.all([promise1, promise2, promise3]);
      expect(results.length).toEqual(3);
    });

    it('should do nothing if queue is empty', async () => {
      await requestBatcher.flushQueue();
      expect(execBatchStub.callCount).toEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors in individual requests', async () => {
      execBatchStub.resolves([
        { id: 1, response: { status: 200, data: { id: 1 } } },
        { id: 2, error: new Error('Request failed') },
        { id: 3, response: { status: 200, data: { id: 3 } } }
      ]);
      
      const promise1 = requestBatcher.queueRequest({ id: 1, method: 'GET', url: '/api/users/1' });
      const promise2 = requestBatcher.queueRequest({ id: 2, method: 'GET', url: '/api/users/2' });
      const promise3 = requestBatcher.queueRequest({ id: 3, method: 'GET', url: '/api/users/3' });
      
      // Flush the queue
      await requestBatcher.flushQueue();
      
      // First request should resolve
      const result1 = await promise1;
      expect(result1.status).toEqual(200);
      
      // Second request should reject
      try {
        await promise2;
        fail('Promise should have been rejected');
      } catch (error) {
        expect(error.message).toEqual('Request failed');
      }
      
      // Third request should resolve
      const result3 = await promise3;
      expect(result3.status).toEqual(200);
    });

    it('should handle errors in batch execution', async () => {
      execBatchStub.rejects(new Error('Batch execution failed'));
      
      const promise1 = requestBatcher.queueRequest({ id: 1, method: 'GET', url: '/api/users/1' });
      const promise2 = requestBatcher.queueRequest({ id: 2, method: 'GET', url: '/api/users/2' });
      
      // Flush the queue
      try {
        await requestBatcher.flushQueue();
        fail('Flush should have failed');
      } catch (error) {
        expect(error.message).toEqual('Batch execution failed');
      }
      
      // All promises should reject
      try {
        await promise1;
        fail('Promise should have been rejected');
      } catch (error) {
        expect(error.message).toContain('Batch execution failed');
      }
      
      try {
        await promise2;
        fail('Promise should have been rejected');
      } catch (error) {
        expect(error.message).toContain('Batch execution failed');
      }
    });
  });

  describe('batch timeout mechanism', () => {
    it('should automatically flush queue after timeout', async () => {
      execBatchStub.resolves([
        { id: 1, response: { status: 200, data: { id: 1 } } }
      ]);
      
      const promise = requestBatcher.queueRequest({ id: 1, method: 'GET', url: '/api/users/1' });
      
      // Batch should not execute yet
      expect(execBatchStub.callCount).toEqual(0);
      
      // Advance time to trigger timeout
      clock.tick(101);
      
      // Allow flush to happen
      await Promise.resolve();
      
      // Batch should be executed
      expect(execBatchStub.calledOnce).toBe(true);
      
      // Promise should be resolved
      const result = await promise;
      expect(result.status).toEqual(200);
    });

    it('should reset timeout when new request added', async () => {
      execBatchStub.resolves([
        { id: 1, response: { status: 200, data: { id: 1 } } },
        { id: 2, response: { status: 200, data: { id: 2 } } }
      ]);
      
      const promise1 = requestBatcher.queueRequest({ id: 1, method: 'GET', url: '/api/users/1' });
      
      // Advance time but not enough to trigger timeout
      clock.tick(50);
      
      // Add another request which should reset timeout
      const promise2 = requestBatcher.queueRequest({ id: 2, method: 'GET', url: '/api/users/2' });
      
      // Advance time to what would have been the first timeout
      clock.tick(51);
      
      // Batch should not be executed yet
      expect(execBatchStub.callCount).toEqual(0);
      
      // Advance more time to trigger the new timeout
      clock.tick(50);
      
      // Allow flush to happen
      await Promise.resolve();
      
      // Batch should now be executed
      expect(execBatchStub.calledOnce).toBe(true);
      
      // Both promises should be resolved
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1.status).toEqual(200);
      expect(result2.status).toEqual(200);
    });
  });
});
