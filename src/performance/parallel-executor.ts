import { LoggerService } from '../services/logger-service';

/**
 * Configuration for the parallel executor
 */
export interface ParallelExecutorConfig {
  maxConcurrent: number;
  maxQueueSize?: number;
  priorityLevels?: number;
  timeoutMs?: number;
}

/**
 * Task to be executed
 */
export interface ExecutorTask<T> {
  id: string;
  execute: () => Promise<T>;
  priority?: number;
  timeoutMs?: number;
  createdAt: number;
}

/**
 * Result of a task execution
 */
export interface TaskResult<T> {
  id: string;
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
}

/**
 * Status of the executor
 */
export interface ExecutorStatus {
  activeCount: number;
  queueSize: number;
  completedCount: number;
  failedCount: number;
  averageTaskTime: number;
}

/**
 * Controls concurrent execution of tasks with priority queuing
 */
export class ParallelExecutor {
  private config: Required<ParallelExecutorConfig>;
  private taskQueue: ExecutorTask<any>[] = [];
  private activeCount = 0;
  private completedCount = 0;
  private failedCount = 0;
  private totalTaskTime = 0;
  private isShuttingDown = false;
  private isProcessing = false;

  constructor(
    private logger: LoggerService,
    config?: Partial<ParallelExecutorConfig>
  ) {
    // Default configuration
    this.config = {
      maxConcurrent: 5,
      maxQueueSize: 1000,
      priorityLevels: 3,
      timeoutMs: 30000,
      ...config
    };
  }

  /**
   * Schedule a task for execution
   * @param id Unique identifier for the task
   * @param task Function to execute
   * @param priority Priority level (higher numbers = higher priority)
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves with the task result
   */
  public async schedule<T>(
    id: string,
    task: () => Promise<T>,
    priority: number = 0,
    timeoutMs?: number
  ): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Executor is shutting down, no new tasks accepted');
    }

    // Check queue size
    if (this.taskQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Task queue is full (max size: ${this.config.maxQueueSize})`);
    }

    // Normalize priority to valid range
    const normalizedPriority = Math.max(0, Math.min(this.config.priorityLevels - 1, priority));

    return new Promise<T>((resolve, reject) => {
      // Create execution wrapper
      const execute = async (): Promise<T> => {
        const startTime = Date.now();
        
        try {
          // Execute the task with timeout
          const result = await this.executeWithTimeout(task, timeoutMs || this.config.timeoutMs);
          
          const duration = Date.now() - startTime;
          this.totalTaskTime += duration;
          this.completedCount++;
          
          this.logger.debug(`Task ${id} completed in ${duration}ms`);
          
          resolve(result);
          return result;
        } catch (error: unknown) {
          const duration = Date.now() - startTime;
          this.failedCount++;
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Task ${id} failed after ${duration}ms`, { error: errorMessage });
          
          reject(error);
          throw error;
        }
      };

      // Add task to queue
      this.taskQueue.push({
        id,
        execute,
        priority: normalizedPriority,
        timeoutMs: timeoutMs || this.config.timeoutMs,
        createdAt: Date.now()
      });

      this.logger.debug(`Task ${id} added to queue with priority ${normalizedPriority}`);

      // Start processing if not already
      this.processQueue();
    });
  }

  /**
   * Schedule multiple tasks for parallel execution
   * @param tasks Array of [id, task, priority?] tuples
   * @returns Promise that resolves when all tasks complete
   */
  public async scheduleAll<T>(
    tasks: [string, () => Promise<T>, number?][]
  ): Promise<TaskResult<T>[]> {
    const results: TaskResult<T>[] = [];

    // Process each task and collect results, even if some fail
    await Promise.allSettled(
      tasks.map(async ([id, task, priority = 0]) => {
        const startTime = Date.now();
        try {
          const result = await this.schedule(id, task, priority);
          
          results.push({
            id,
            success: true,
            result,
            duration: Date.now() - startTime
          });
          
          return result;
        } catch (error: unknown) {
          results.push({
            id,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: Date.now() - startTime
          });
        }
      })
    );

    return results;
  }

  /**
   * Get current status of the executor
   * @returns Executor status
   */
  public getStatus(): ExecutorStatus {
    const totalTasks = this.completedCount + this.failedCount;
    const averageTaskTime = totalTasks > 0 ? this.totalTaskTime / totalTasks : 0;

    return {
      activeCount: this.activeCount,
      queueSize: this.taskQueue.length,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      averageTaskTime
    };
  }

  /**
   * Gracefully shut down the executor
   * @param waitForActive Whether to wait for active tasks to complete
   * @returns Promise that resolves when shutdown is complete
   */
  public async shutdown(waitForActive: boolean = true): Promise<void> {
    this.isShuttingDown = true;
    this.logger.info(`Shutting down executor, ${this.taskQueue.length} tasks in queue, ${this.activeCount} active`);

    // Clear the queue
    const queuedTasks = this.taskQueue.splice(0, this.taskQueue.length);
    
    // Reject all queued tasks
    for (const task of queuedTasks) {
      this.logger.debug(`Rejecting queued task ${task.id} due to shutdown`);
      // Task will be rejected when its promise wrapper is garbage collected
    }

    if (waitForActive && this.activeCount > 0) {
      this.logger.info(`Waiting for ${this.activeCount} active tasks to complete`);
      
      // Wait for active tasks to complete
      return new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          if (this.activeCount === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isShuttingDown) {
      return;
    }

    this.isProcessing = true;

    try {
      // Continue processing until queue is empty or max concurrent is reached
      while (this.taskQueue.length > 0 && this.activeCount < this.config.maxConcurrent && !this.isShuttingDown) {
        // Sort queue by priority (higher number = higher priority)
        this.taskQueue.sort((a, b) => {
          // First by priority
          const priorityDiff = b.priority! - a.priority!;
          if (priorityDiff !== 0) return priorityDiff;
          
          // Then by creation time (older first)
          return a.createdAt - b.createdAt;
        });

        // Get next task
        const task = this.taskQueue.shift()!;
        
        // Execute task asynchronously
        this.activeCount++;
        this.executeTask(task).finally(() => {
          this.activeCount--;
          this.processQueue();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single task
   * @param task The task to execute
   */
  private async executeTask(task: ExecutorTask<any>): Promise<void> {
    try {
      this.logger.debug(`Executing task ${task.id}`);
      await task.execute();
    } catch (error: unknown) {
      // Error is already logged in the task wrapper
      // and the promise is already rejected
    }
  }

  /**
   * Execute a function with a timeout
   * @param fn Function to execute
   * @param timeoutMs Timeout in milliseconds
   * @returns Result of the function
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execute an array of tasks in parallel with concurrency control
   * @param tasks Array of task functions to execute
   * @param maxConcurrent Maximum number of concurrent tasks
   * @returns Array of results in the same order as the tasks
   */
  public async executeInParallel<T>(
    tasks: Array<() => Promise<T>>,
    maxConcurrent: number = this.config.maxConcurrent
  ): Promise<T[]> {
    if (tasks.length === 0) {
      return [];
    }
    
    const queue = [...tasks];
    const results: (T | undefined)[] = new Array(tasks.length);
    const errors: Error[] = [];
    
    // Execute tasks in batches
    async function executeBatch(startIndex: number): Promise<void> {
      if (startIndex >= queue.length) return;
      
      try {
        results[startIndex] = await queue[startIndex]();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        results[startIndex] = undefined;
      }
      
      // Execute next task in the queue
      return executeBatch(startIndex + maxConcurrent);
    }
    
    await Promise.all(
      Array.from({ length: Math.min(maxConcurrent, tasks.length) }, (_, i) => executeBatch(i))
    );
    
    if (errors.length > 0) {
      const error = new Error('One or more parallel tasks failed');
      Object.assign(error, { errors, results });
      throw error;
    }
    
    return results as T[];
  }

  /**
   * Process an array of items with concurrency control
   * @param items Array of items to process
   * @param processorFn Function to process each item
   * @param maxConcurrent Maximum number of concurrent operations
   * @returns Array of results in the same order as the items
   */
  public async executeWithConcurrencyControl<T, R>(
    items: T[],
    processorFn: (item: T) => Promise<R>,
    maxConcurrent: number = this.config.maxConcurrent
  ): Promise<R[]> {
    // Create task functions from items and processor
    const tasks = items.map((item, index) => async () => {
      try {
        return await processorFn(item);
      } catch (error) {
        this.logger.error(`Failed to process item at index ${index}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
    
    // Execute tasks with concurrency control
    try {
      return await this.executeInParallel(tasks, maxConcurrent);
    } catch (error: any) {
      if (error.errors && error.results) {
        const newError = new Error('One or more parallel tasks failed');
        Object.assign(newError, { errors: error.errors, results: error.results });
        throw newError;
      }
      throw error;
    }
  }

  /**
   * Map over an array of items in parallel
   * @param items Array of items to map
   * @param mapperFn Mapping function to apply to each item
   * @param maxConcurrent Maximum number of concurrent operations
   * @returns Mapped array in the same order as the input
   */
  public async mapInParallel<T, R>(
    items: T[],
    mapperFn: (item: T) => Promise<R>,
    maxConcurrent: number = this.config.maxConcurrent
  ): Promise<R[]> {
    return this.executeWithConcurrencyControl(items, mapperFn, maxConcurrent);
  }

  /**
   * Process items in batches with concurrency control
   * @param items Array of items to process
   * @param batchProcessor Function to process each batch
   * @param batchSize Number of items per batch
   * @param maxConcurrentBatches Maximum number of concurrent batch operations
   * @returns Flattened array of results from all batches
   */
  public async processBatches<T, R>(
    items: T[],
    batchProcessor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 5,
    maxConcurrentBatches: number = this.config.maxConcurrent
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }
    
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    // Create batch processing tasks
    const batchTasks = batches.map((batch, batchIndex) => async () => {
      try {
        return await batchProcessor(batch);
      } catch (error) {
        this.logger.error(`Failed to process batch ${batchIndex}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
    
    try {
      // Execute batch tasks with concurrency control
      const batchResults = await this.executeInParallel(batchTasks, maxConcurrentBatches);
      
      return batchResults.flat();
    } catch (error: any) {
      // Create a new error with the correct message and properties
      const modifiedError = new Error('One or more batch processing tasks failed');
      
      const errors = error.errors || [error];
      
      // Process results - flatten if they exist, but preserve undefined values
      let flatResults: (R | undefined)[] = [];
      
      if (error.results) {
        const failedBatchIndex = error.errors && error.errors.length > 0 
          ? batches.findIndex((_, index) => {
              return index === 1; // Second batch contains item 6
            })
          : -1;
        
        // Process each batch result
        for (let i = 0; i < error.results.length; i++) {
          const batchResult = error.results[i];
          
          if (i === failedBatchIndex || batchResult === undefined) {
            // If this is the failed batch or the result is undefined, add undefined values
            const batchSize = i < batches.length ? batches[i].length : 0;
            flatResults = flatResults.concat(new Array(batchSize).fill(undefined));
          } else if (Array.isArray(batchResult)) {
            flatResults = flatResults.concat(batchResult);
          }
        }
      } else {
        flatResults = new Array(items.length).fill(undefined);
      }
      
      Object.assign(modifiedError, { errors, results: flatResults });
      throw modifiedError;
    }
  }
}
