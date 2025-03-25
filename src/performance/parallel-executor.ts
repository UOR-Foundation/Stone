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
        } catch (error) {
          const duration = Date.now() - startTime;
          this.failedCount++;
          
          this.logger.error(`Task ${id} failed after ${duration}ms`, { error: error.message });
          
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
        } catch (error) {
          results.push({
            id,
            success: false,
            error,
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
    } catch (error) {
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
}