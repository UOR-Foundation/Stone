import { LoggerService } from '../services/logger-service';

/**
 * Performance metrics for an operation
 */
export interface PerformanceMetrics {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
  p50Time: number; // Median
  p90Time: number; // 90th percentile
  p99Time: number; // 99th percentile
  failureCount: number;
  failureRate: number;
}

/**
 * Timer for measuring operation duration
 */
export interface PerformanceTimer {
  /** 
   * Mark the operation as completed and record metrics
   * @param options Options for recording the completion
   */
  end(options?: { failed?: boolean }): void;
}

/**
 * Configuration for a monitored operation
 */
export interface OperationConfig {
  sampleRate?: number; // 0-1, percentage of operations to sample
  historyLimit?: number; // Number of timing samples to keep
}

/**
 * Options for retrieving metrics
 */
export interface MetricsOptions {
  resetAfterGet?: boolean;
  includeHistory?: boolean;
}

/**
 * Tracks and reports on system performance metrics
 */
export class PerformanceMonitor {
  private operations: Map<string, {
    config: Required<OperationConfig>;
    timings: number[];
    startTimes: Map<string, number>;
    failureCount: number;
  }> = new Map();

  constructor(private logger: LoggerService) {}

  /**
   * Register an operation to be monitored
   * @param name Name of the operation
   * @param config Configuration for the operation
   */
  public registerOperation(name: string, config?: OperationConfig): void {
    if (this.operations.has(name)) {
      this.logger.debug(`Operation ${name} already registered, updating config`);
    }

    this.operations.set(name, {
      config: {
        sampleRate: 1.0,
        historyLimit: 1000,
        ...config
      },
      timings: [],
      startTimes: new Map(),
      failureCount: 0
    });

    this.logger.debug(`Registered operation ${name} for performance monitoring`);
  }

  /**
   * Start timing an operation
   * @param name Name of the operation
   * @param id Optional identifier for the operation instance
   * @returns Timer object with end() method
   */
  public startTimer(name: string, id: string = Math.random().toString(36).substring(2)): PerformanceTimer {
    // Register operation if it doesn't exist
    if (!this.operations.has(name)) {
      this.registerOperation(name);
    }

    const operation = this.operations.get(name)!;
    
    // Record start time
    operation.startTimes.set(id, Date.now());

    // Return timer object
    return {
      end: (options = {}) => {
        const startTime = operation.startTimes.get(id);
        if (!startTime) {
          this.logger.warn(`No start time found for operation ${name} with id ${id}`);
          return;
        }

        const duration = Date.now() - startTime;
        operation.startTimes.delete(id);

        // Sample based on the configured rate
        if (Math.random() <= operation.config.sampleRate) {
          // Add to timings array
          operation.timings.push(duration);
          
          // Trim history if needed
          if (operation.timings.length > operation.config.historyLimit) {
            operation.timings.shift();
          }
        }

        // Record failures
        if (options.failed) {
          operation.failureCount++;
        }

        this.logger.debug(`Operation ${name} completed in ${duration}ms${options.failed ? ' (failed)' : ''}`);
      }
    };
  }

  /**
   * Track a completed operation with known duration
   * @param name Name of the operation
   * @param duration Duration in milliseconds
   * @param failed Whether the operation failed
   */
  public recordOperation(name: string, duration: number, failed: boolean = false): void {
    // Register operation if it doesn't exist
    if (!this.operations.has(name)) {
      this.registerOperation(name);
    }

    const operation = this.operations.get(name)!;
    
    // Sample based on the configured rate
    if (Math.random() <= operation.config.sampleRate) {
      // Add to timings array
      operation.timings.push(duration);
      
      // Trim history if needed
      if (operation.timings.length > operation.config.historyLimit) {
        operation.timings.shift();
      }
    }

    // Record failures
    if (failed) {
      operation.failureCount++;
    }

    this.logger.debug(`Recorded operation ${name} with duration ${duration}ms${failed ? ' (failed)' : ''}`);
  }

  /**
   * Get metrics for an operation
   * @param name Name of the operation
   * @param options Options for retrieving metrics
   * @returns Performance metrics or null if operation not found
   */
  public getMetrics(name: string, options: MetricsOptions = {}): PerformanceMetrics | null {
    if (!this.operations.has(name)) {
      return null;
    }

    const operation = this.operations.get(name)!;
    
    // Create a copy of the timings array for calculations
    const timings = [...operation.timings];
    const count = timings.length;
    const failureCount = operation.failureCount;
    
    if (count === 0) {
      return {
        count: 0,
        totalTime: 0,
        minTime: 0,
        maxTime: 0,
        avgTime: 0,
        p50Time: 0,
        p90Time: 0,
        p99Time: 0,
        failureCount,
        failureRate: count > 0 ? failureCount / count : 0
      };
    }

    // Sort timings for percentile calculation
    timings.sort((a, b) => a - b);

    // Calculate metrics
    const totalTime = timings.reduce((sum, time) => sum + time, 0);
    const minTime = timings[0];
    const maxTime = timings[timings.length - 1];
    const avgTime = totalTime / count;
    
    // Calculate percentiles
    const p50Index = Math.floor(count * 0.5);
    const p90Index = Math.floor(count * 0.9);
    const p99Index = Math.floor(count * 0.99);
    
    const p50Time = timings[p50Index];
    const p90Time = timings[p90Index];
    const p99Time = timings[p99Index];
    
    // Reset metrics if requested
    if (options.resetAfterGet) {
      this.resetOperationMetrics(name);
    }
    
    return {
      count,
      totalTime,
      minTime,
      maxTime,
      avgTime,
      p50Time,
      p90Time,
      p99Time,
      failureCount,
      failureRate: count > 0 ? failureCount / count : 0
    };
  }

  /**
   * Get metrics for all registered operations
   * @param options Options for retrieving metrics
   * @returns Map of operation names to their metrics
   */
  public getAllMetrics(options: MetricsOptions = {}): Record<string, PerformanceMetrics> {
    const metrics: Record<string, PerformanceMetrics> = {};
    
    for (const name of this.operations.keys()) {
      const operationMetrics = this.getMetrics(name, options);
      if (operationMetrics) {
        metrics[name] = operationMetrics;
      }
    }
    
    return metrics;
  }

  /**
   * Reset metrics for an operation
   * @param name Name of the operation
   * @returns True if operation existed and was reset, false otherwise
   */
  public resetOperationMetrics(name: string): boolean {
    if (!this.operations.has(name)) {
      return false;
    }
    
    const operation = this.operations.get(name)!;
    operation.timings = [];
    operation.failureCount = 0;
    
    this.logger.debug(`Reset metrics for operation ${name}`);
    return true;
  }

  /**
   * Reset metrics for all operations
   */
  public resetAllMetrics(): void {
    for (const name of this.operations.keys()) {
      this.resetOperationMetrics(name);
    }
    
    this.logger.debug('Reset all performance metrics');
  }

  /**
   * Async measurement of an operation
   * @param name Name of the operation
   * @param fn Function to measure
   * @param id Optional identifier for the operation instance
   * @returns Result of the function
   */
  public async measure<T>(
    name: string,
    fn: () => Promise<T>,
    id?: string
  ): Promise<T> {
    const timer = this.startTimer(name, id);
    
    try {
      const result = await fn();
      timer.end();
      return result;
    } catch (error) {
      timer.end({ failed: true });
      throw error;
    }
  }

  /**
   * Synchronous measurement of an operation
   * @param name Name of the operation
   * @param fn Function to measure
   * @param id Optional identifier for the operation instance
   * @returns Result of the function
   */
  public measureSync<T>(
    name: string,
    fn: () => T,
    id?: string
  ): T {
    const timer = this.startTimer(name, id);
    
    try {
      const result = fn();
      timer.end();
      return result;
    } catch (error) {
      timer.end({ failed: true });
      throw error;
    }
  }
}