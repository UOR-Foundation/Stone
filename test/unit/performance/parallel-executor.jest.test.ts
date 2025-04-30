import { ParallelExecutor } from '../../../src/performance/parallel-executor';
import { LoggerService } from '../../../src/services/logger-service';

describe('ParallelExecutor', () => {
  let parallelExecutor: ParallelExecutor;
  let loggerStub: LoggerService;

  beforeEach(() => {
    loggerStub = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as unknown as LoggerService;
    
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
        throw new Error('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toEqual('One or more parallel tasks failed');
        expect(error.errors.length).toEqual(1);
        expect(error.errors[0].message).toEqual('Task 2 failed');
        expect(error.results).toStrictEqual(['Task 1', undefined, 'Task 3']);
      }
    });

    it('should handle empty task array', async () => {
      const results = await parallelExecutor.executeInParallel([]);
      expect(results).toStrictEqual([]);
      expect(results.length).toEqual(0);
    });

    it('should handle single task execution', async () => {
      const task = async () => 'Single Task';
      const results = await parallelExecutor.executeInParallel([task]);
      expect(results).toStrictEqual(['Single Task']);
    });
  });

  describe('executeWithConcurrencyControl', () => {
    it('should process items with controlled concurrency', async () => {
      const items = [1, 2, 3, 4, 5];
      
      let currentlyRunning = 0;
      let maxRunning = 0;
      
      const processorFn = async (item: number) => {
        currentlyRunning++;
        maxRunning = Math.max(maxRunning, currentlyRunning);
        
        await new Promise(resolve => setTimeout(resolve, item * 10));
        
        currentlyRunning--;
        return item * 2;
      };
      
      const results = await parallelExecutor.executeWithConcurrencyControl(
        items,
        processorFn,
        3  // maxConcurrent
      );
      
      expect(results).toStrictEqual([2, 4, 6, 8, 10]);
      expect(maxRunning).toEqual(3); // Should never exceed 3 concurrent tasks
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
        throw new Error('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toEqual('One or more parallel tasks failed');
        expect(error.errors.length).toEqual(1);
        expect(error.errors[0].message).toEqual('Item 3 failed');
        
        expect(error.results).toStrictEqual([2, 4, undefined, 8, 10]);
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
        throw new Error('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toEqual('One or more parallel tasks failed');
        expect(error.errors.length).toEqual(1);
        expect(error.errors[0].message).toEqual('Sync error');
      }
    });
  });

  describe('mapInParallel', () => {
    it('should map items in parallel', async () => {
      const items = [1, 2, 3, 4, 5];
      
      const mapperFn = async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, (6 - item) * 10));
        return item * 3;
      };
      
      const results = await parallelExecutor.mapInParallel(items, mapperFn);
      
      expect(results).toStrictEqual([3, 6, 9, 12, 15]);
    });

    it('should preserve order of results', async () => {
      const items = [5, 3, 1, 4, 2];
      
      const mapperFn = async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, (6 - item) * 10));
        return item * 2;
      };
      
      const results = await parallelExecutor.mapInParallel(items, mapperFn);
      
      expect(results).toStrictEqual([10, 6, 2, 8, 4]);
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
        throw new Error('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toEqual('One or more parallel tasks failed');
        expect(error.errors.length).toEqual(1);
        expect(error.errors[0].message).toEqual('Failed on item c');
        expect(error.results).toStrictEqual(['A', 'B', undefined, 'D']);
      }
    });

    it('should respect concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      let currentlyRunning = 0;
      let maxRunning = 0;
      
      const mapperFn = async (item: number) => {
        currentlyRunning++;
        maxRunning = Math.max(maxRunning, currentlyRunning);
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        currentlyRunning--;
        return item * 2;
      };
      
      await parallelExecutor.mapInParallel(items, mapperFn, 4);
      
      expect(maxRunning).toEqual(4); // Should never exceed 4 concurrent tasks
    });
  });

  describe('batch processing', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      const batchGroups: number[][] = [];
      
      const batchProcessor = async (batch: number[]) => {
        batchGroups.push([...batch]);
        
        return batch.map(item => item * 2);
      };
      
      const results = await parallelExecutor.processBatches(items, batchProcessor, 3);
      
      expect(batchGroups.length).toEqual(4);
      expect(batchGroups[0]).toStrictEqual([1, 2, 3]);
      expect(batchGroups[1]).toStrictEqual([4, 5, 6]);
      expect(batchGroups[2]).toStrictEqual([7, 8, 9]);
      expect(batchGroups[3]).toStrictEqual([10]);
      
      expect(results).toStrictEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
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
      
      expect(results.length).toEqual(30);
      expect(maxRunningBatches).toEqual(3); // Should never exceed 3 concurrent batches
      
      expect(processedBatches.length).toEqual(6);
      
      for (let i = 0; i < processedBatches.length - 1; i++) {
        expect(processedBatches[i].length).toEqual(5);
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
        throw new Error('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toEqual('One or more batch processing tasks failed');
        expect(error.errors.length).toEqual(1);
        expect(error.errors[0].message).toEqual('Failed on batch with item 6');
        
        expect(error.results).toContain(2);
        expect(error.results).toContain(4);
        expect(error.results).toContain(16);
        expect(error.results).toContain(18);
        
        const resultsArray = error.results;
        const hasSomeUndefined = resultsArray.some(r => r === undefined);
        expect(hasSomeUndefined).toEqual(true);
      }
    });
  });
});
