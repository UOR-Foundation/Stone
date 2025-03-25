import { LoggerService } from '../services/logger-service';

/**
 * A request to be batched
 */
export interface BatchRequest<T, R> {
  id: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

/**
 * Configuration for the request batcher
 */
export interface BatcherConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  minWaitTimeMs?: number;
}

/**
 * Type for the batch processing function
 */
export type BatchProcessor<T, R> = (requests: BatchRequest<T, R>[]) => Promise<Record<string, R>>;

/**
 * Batches individual requests into grouped API calls for efficiency
 */
export class RequestBatcher<T, R> {
  private queue: BatchRequest<T, R>[] = [];
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private config: BatcherConfig;

  constructor(
    private processor: BatchProcessor<T, R>,
    private logger: LoggerService,
    config?: Partial<BatcherConfig>
  ) {
    // Default configuration
    this.config = {
      maxBatchSize: 25,
      maxWaitTimeMs: 100,
      minWaitTimeMs: 10,
      ...config
    };
  }

  /**
   * Add a request to the batch queue
   * @param id Unique identifier for the request
   * @param data Request data
   * @returns Promise that resolves with the result
   */
  public async add<Q extends T, S extends R>(id: string, data: Q): Promise<S> {
    return new Promise<S>((resolve, reject) => {
      // Add to queue
      this.queue.push({
        id,
        data: data as unknown as T,
        resolve: (result: R) => resolve(result as unknown as S),
        reject
      });
      
      this.logger.debug(`Added request to batch: ${id}`);
      
      // Schedule processing if not already scheduled
      this.scheduleProcessing();
    });
  }

  /**
   * Add multiple requests to the batch queue
   * @param items Array of [id, data] tuples
   * @returns Promise that resolves with an array of results
   */
  public async addMany<Q extends T, S extends R>(items: [string, Q][]): Promise<S[]> {
    if (items.length === 0) {
      return [];
    }
    
    return Promise.all(items.map(([id, data]) => this.add<Q, S>(id, data)));
  }

  /**
   * Get the current queue size
   * @returns Number of items in the queue
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Force immediate processing of the current queue
   */
  public async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    await this.processQueue();
  }

  /**
   * Schedule the processing of the queue
   */
  private scheduleProcessing(): void {
    // If already processing or timer is set, do nothing
    if (this.processing || this.timer) {
      return;
    }
    
    // If queue has reached max size, process immediately
    if (this.queue.length >= this.config.maxBatchSize) {
      this.logger.debug(`Queue reached max size (${this.config.maxBatchSize}), processing immediately`);
      this.processQueue();
      return;
    }
    
    // Otherwise schedule processing after the wait time
    this.timer = setTimeout(() => {
      this.timer = null;
      this.processQueue();
    }, this.calculateWaitTime());
  }

  /**
   * Calculate the appropriate wait time based on queue size
   * @returns Wait time in milliseconds
   */
  private calculateWaitTime(): number {
    const { maxBatchSize, maxWaitTimeMs, minWaitTimeMs = 10 } = this.config;
    
    // If queue is empty, use max wait time
    if (this.queue.length === 0) {
      return maxWaitTimeMs;
    }
    
    // Adjust wait time based on how full the queue is
    // Full queue = min wait time, empty queue = max wait time
    const queueRatio = this.queue.length / maxBatchSize;
    const waitTime = maxWaitTimeMs - (maxWaitTimeMs - minWaitTimeMs) * queueRatio;
    
    return Math.max(minWaitTimeMs, Math.min(maxWaitTimeMs, Math.round(waitTime)));
  }

  /**
   * Process the current queue of requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      // Take items from queue (up to max batch size)
      const batch = this.queue.splice(0, this.config.maxBatchSize);
      
      this.logger.debug(`Processing batch of ${batch.length} requests`);
      
      // Process the batch
      const results = await this.processor(batch);
      
      // Resolve promises for each request
      for (const request of batch) {
        if (request.id in results) {
          request.resolve(results[request.id]);
        } else {
          request.reject(new Error(`No result returned for request: ${request.id}`));
        }
      }
      
      this.logger.debug(`Batch processing complete, ${this.queue.length} requests remaining`);
    } catch (error) {
      this.logger.error('Error processing batch', { error: error.message });
      
      // Move failed requests back to the front of the queue
      // This is a simple retry strategy
      const failed = this.queue.splice(0, this.config.maxBatchSize);
      this.queue = [...failed, ...this.queue];
      
      // Reject all requests in case of catastrophic failure
      for (const request of this.queue) {
        request.reject(new Error(`Batch processing failed: ${error.message}`));
      }
      
      // Clear the queue
      this.queue = [];
    } finally {
      this.processing = false;
      
      // If there are more items in the queue, schedule processing
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }
}
