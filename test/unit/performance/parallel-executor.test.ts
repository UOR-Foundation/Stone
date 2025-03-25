import sinon from 'sinon';
import { ParallelExecutor } from '../../../src/performance/parallel-executor';
import { LoggerService } from '../../../src/services/logger-service';

describe('ParallelExecutor', () => {
  let parallelExecutor: ParallelExecutor;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };
    
    parallelExecutor = new ParallelExecutor(loggerStub);
  });

  describe('executeInParallel', () => {
    it('should execute tasks in parallel', async () => {
      const tasks = [
        () => Promise.resolve('Task 1'),
        () => Promise.resolve('Task 2'),
        () => Promise.resolve('Task 3')
      ];
      
      const results = await parallelExecutor.executeInParallel(tasks);
      
      expect(results).toEqual(['Task 1', 'Task 2', 'Task 3']);
    });

    it('should respect maxConcurrent limit', async () => {
      // Create a way to track which tasks are running in parallel
      let runningCount = 0;
      let maxRunning = 0;
      
      const createTask = (delay: number, id: number) => {
        return async () => {
          runningCount++;
          maxRunning = Math.max(maxRunning, runningCount);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          runningCount--;
          return `Task ${id}`;
        };
      };
      
      const tasks = [
        createTask(50, 1),
        createTask(30, 2),
        createTask(10, 3),
        createTask(40, 4),
        createTask(20, 5)
      ];
      
      // Set max concurrent to 2
      const results = await parallelExecutor.executeInParallel(tasks, 2);
      
      expect(results.length).toBe(5);
      expect(results).toContain('Task 1');
      expect(results).toContain('Task 2');
      expect(maxRunning).toBe(2); // Should never exceed 2 concurrent tasks
    });

    it('should handle task failures gracefully', async () => {
      const tasks = [
        () => Promise.resolve('Task 1'),
        () => Promise.reject(new Error('Task 2 failed')),
        () => Promise.resolve('Task 3')
      ];
      
      try {
        await parallelExecutor.executeInParallel(tasks);
        // Should not reach here
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('One or more parallel tasks failed');
        expect(error.errors.length).toBe(1);
        expect(error.errors[0].message).toBe('Task 2 failed');
        expect(error.results).toEqual(['Task 1', undefined, 'Task 3']);
      }
    });

    it('should handle empty task array', async () => {
      const results = await parallelExecutor.executeInParallel([]);
      expect(results).toEqual([]);
    });

    it('should handle single task execution', async () => {
      const task = async () => 'Single Task';
      const results = await parallelExecutor.executeInParallel([task]);
      expect(results).toEqual(['Single Task']);
    });
  });

  describe('executeWithConcurrencyControl', () => {
    it('should process items with controlled concurrency', async () => {
      const items = [1, 2, 3, 4, 5];
      
      // Track concurrent executions
      let currentlyRunning = 0;
      let maxRunning = 0;
      
      const processorFn = async (item: number) => {
        currentlyRunning++;
        maxRunning = Math.max(maxRunning, currentlyRunning);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, item * 10));
        
        currentlyRunning--;
        return item * 2;
      };
      
      const results = await parallelExecutor.executeWithConcurrencyControl(
        items,
        processorFn,
        3  // maxConcurrent
      );
      
      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(maxRunning).toBe(3); // Should never exceed 3 concurrent tasks
    });

    it('should handle errors in processor function', async () => {
      const items = [1, 2, 3, 4, 5];
      
      const processorFn = async (item: number) => {
        if (item === 3) {
          throw new Error('Item 3 failed');
        }
        return item * 2;
      };
      
      try {
        await parallelExecutor.executeWithConcurrencyControl(items, processorFn, 2);
        // Should not reach here
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('One or more parallel tasks failed');
        expect(error.errors.length).toBe(1);
        expect(error.errors[0].message).toBe('Item 3 failed');
        
        // Should still have results for successful items
        expect(error.results).toEqual([2, 4, undefined, 8, 10]);
      }
    });

    it('should handle processor function throwing synchronously', async () => {
      const items = [1, 2, 3];
      
      const processorFn = (item: number) => {
        if (item === 2) {
          throw new Error('Sync error');
        }
        return Promise.resolve(item * 2);
      };
      
      try {
        await parallelExecutor.executeWithConcurrencyControl(items, processorFn, 2);
        // Should not reach here
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('One or more parallel tasks failed');
        expect(error.errors.length).toBe(1);
        expect(error.errors[0].message).toBe('Sync error');
      }
    });
  });

  describe('mapInParallel', () => {
    it('should map items in parallel', async () => {
      const items = [1, 2, 3, 4, 5];
      
      const mapperFn = async (item: number) => {
        // Simulate different processing times
        await new Promise(resolve => setTimeout(resolve, (6 - item) * 10));
        return item * 3;
      };
      
      const results = await parallelExecutor.mapInParallel(items, mapperFn);
      
      expect(results).toEqual([3, 6, 9, 12, 15]);
    });

    it('should preserve order of results', async () => {
      const items = [5, 3, 1, 4, 2];
      
      const mapperFn = async (item: number) => {
        // Delay inversely proportional to item value
        await new Promise(resolve => setTimeout(resolve, (6 - item) * 10));
        return item * 2;
      };
      
      const results = await parallelExecutor.mapInParallel(items, mapperFn);
      
      // Results should be in the same order as input items
      expect(results).toEqual([10, 6, 2, 8, 4]);
    });

    it('should handle errors in mapper function', async () => {
      const items = ['a', 'b', 'c', 'd'];
      
      const mapperFn = async (item: string) => {
        if (item === 'c') {
          throw new Error('Failed on item c');
        }
        return item.toUpperCase();
      };
      
      try {
        await parallelExecutor.mapInParallel(items, mapperFn);
        // Should not reach here
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('One or more parallel tasks failed');
        expect(error.errors.length).toBe(1);
        expect(error.errors[0].message).toBe('Failed on item c');
        expect(error.results).toEqual(['A', 'B', undefined, 'D']);
      }
    });

    it('should respect concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      // Track concurrent executions
      let currentlyRunning = 0;
      let maxRunning = 0;
      
      const mapperFn = async (item: number) => {
        currentlyRunning++;
        maxRunning = Math.max(maxRunning, currentlyRunning);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        
        currentlyRunning--;
        return item * 2;
      };
      
      await parallelExecutor.mapInParallel(items, mapperFn, 4);
      
      expect(maxRunning).toBe(4); // Should never exceed 4 concurrent tasks
    });
  });

  describe('batch processing', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      // Keep track of which items are processed together
      const batchGroups: number[][] = [];
      
      const batchProcessor = async (batch: number[]) => {
        batchGroups.push([...batch]);
        
        // Process each item in the batch
        return batch.map(item => item * 2);
      };
      
      const results = await parallelExecutor.processBatches(items, batchProcessor, 3);
      
      // Should have split into 4 batches
      expect(batchGroups.length).toBe(4);
      expect(batchGroups[0]).toEqual([1, 2, 3]);
      expect(batchGroups[1]).toEqual([4, 5, 6]);
      expect(batchGroups[2]).toEqual([7, 8, 9]);
      expect(batchGroups[3]).toEqual([10]);
      
      // Results should be correctly mapped
      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    });

    it('should process batches in parallel with controlled concurrency', async () => {
      const items = Array.from({ length: 30 }, (_, i) => i + 1);
      
      let runningBatches = 0;
      let maxRunningBatches = 0;
      const processedBatches: number[][] = [];
      
      const batchProcessor = async (batch: number[]) => {
        runningBatches++;
        maxRunningBatches = Math.max(maxRunningBatches, runningBatches);
        
        processedBatches.push([...batch]);
        
        // Simulate async work with variable duration
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
        
        runningBatches--;
        return batch.map(item => item * 2);
      };
      
      const results = await parallelExecutor.processBatches(
        items,
        batchProcessor,
        5,   // batchSize
        3    // maxConcurrentBatches
      );
      
      expect(results.length).toBe(30);
      expect(maxRunningBatches).toBe(3); // Should never exceed 3 concurrent batches
      
      // Should have created 6 batches
      expect(processedBatches.length).toBe(6);
      
      // Each batch should have 5 items (except maybe the last one)
      for (let i = 0; i < processedBatches.length - 1; i++) {
        expect(processedBatches[i].length).toBe(5);
      }
    });

    it('should handle errors in batch processing', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      const batchProcessor = async (batch: number[]) => {
        if (batch.includes(6)) {
          throw new Error('Failed on batch with item 6');
        }
        return batch.map(item => item * 2);
      };
      
      try {
        await parallelExecutor.processBatches(items, batchProcessor, 3);
        // Should not reach here
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('One or more batch processing tasks failed');
        expect(error.errors.length).toBe(1);
        expect(error.errors[0].message).toBe('Failed on batch with item 6');
        
        // Should have partial results
        expect(error.results).toContain(2);
        expect(error.results).toContain(4);
        expect(error.results).toContain(16);
        expect(error.results).toContain(18);
        
        // Results from failed batch should be undefined
        const resultsArray = error.results;
        const hasSomeUndefined = resultsArray.some(r => r === undefined);
        expect(hasSomeUndefined).toBe(true);
      }
    });
  });
});