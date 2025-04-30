import { LoggerService } from '../services/logger-service';
type Timeout = ReturnType<typeof setTimeout>;

/**
 * Request in the batch queue
 */
export interface BatchRequest<T, R> {
  id: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

/**
 * Configuration for the batcher
 */
export interface BatcherConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  minWaitTimeMs?: number;
}

/**
 * Batches individual requests into grouped API calls for efficiency
 */
export class RequestBatcher {
  private queue: BatchRequest<any, any>[] = [];
  private timer: Timeout | null = null;
  private processing = false;
  private maxBatchSize: number;
  private batchTimeoutMs: number;
  private executeBatch: (requests: any[]) => Promise<any[]>;
  private logger: LoggerService;

  constructor(
    config: {
      maxBatchSize: number;
      batchTimeoutMs: number;
      executeBatch: (requests: any[]) => Promise<any[]>;
      logger: LoggerService;
    }
  ) {
    this.maxBatchSize = config.maxBatchSize || 25;
    this.batchTimeoutMs = config.batchTimeoutMs || 100;
    this.executeBatch = config.executeBatch;
    this.logger = config.logger;
  }

  /**
   * Queue a request for batch processing
   * @param request Request object with id, method, and url
   * @returns Promise that resolves with the response
   */
  public queueRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const batchRequest: BatchRequest<any, any> = {
        id: request.id,
        data: request,
        resolve,
        reject
      };
      
      // Add to queue
      this.queue.push(batchRequest);
      
      if (this.logger && this.logger.debug) {
        this.logger.debug(`Queued request: ${request.id}, queue size: ${this.queue.length}`);
      }
      
      // Schedule processing if not already scheduled
      this.scheduleProcessing();
      
      // If queue has reached max size, process immediately
      if (this.queue.length >= this.maxBatchSize) {
        this.processQueue();
      }
    });
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
  public async flushQueue(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    await this.processQueue();
  }
  
  /**
   * Cancel a request by ID
   * @param id ID of the request to cancel
   * @returns True if request was found and canceled, false otherwise
   */
  public cancelRequest(id: number | string): boolean {
    const idStr = String(id);
    
    const index = this.queue.findIndex((req) => {
      return req.data && String(req.data.id) === idStr;
    });
    
    if (index === -1) {
      return false;
    }
    
    // Get the request
    const request = this.queue[index];
    
    // Remove the request from the queue
    this.queue.splice(index, 1);
    
    // Reject the promise
    request.reject(new Error('Request canceled'));
    
    return true;
  }
  
  /**
   * Move a request to the front of the queue
   * @param id ID of the request to prioritize
   * @returns True if request was found and prioritized, false otherwise
   */
  public prioritizeRequest(id: number | string): boolean {
    const idStr = String(id);
    
    const index = this.queue.findIndex((req) => {
      return req.data && String(req.data.id) === idStr;
    });
    
    if (index === -1) {
      return false;
    }
    
    const request = this.queue.splice(index, 1)[0];
    
    // Add to front of queue
    this.queue.unshift(request);
    
    return true;
  }
  
  /**
   * Schedule the processing of the queue
   */
  private scheduleProcessing(): void {
    // If already processing or timer is set, do nothing
    if (this.processing || this.timer) {
      return;
    }
    
    // Otherwise schedule processing after the wait time
    this.timer = setTimeout(() => {
      this.timer = null;
      this.processQueue();
    }, this.batchTimeoutMs);
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
      const batch = this.queue.splice(0, this.maxBatchSize);
      
      if (this.logger && this.logger.debug) {
        this.logger.debug(`Processing batch of ${batch.length} requests`);
      }
      
      // Process the batch
      const results = await this.executeBatch(batch.map(req => req.data));
      
      // Resolve promises for each request
      for (let i = 0; i < batch.length; i++) {
        const request = batch[i];
        const result = results[i];
        
        if (result && result.error) {
          request.reject(result.error);
        } else if (result && result.response) {
          request.resolve(result.response);
        } else if (result) {
          request.resolve(result);
        } else {
          request.reject(new Error(`No result returned for request: ${request.id}`));
        }
      }
      
      if (this.logger && this.logger.debug) {
        this.logger.debug(`Batch processing complete, ${this.queue.length} requests remaining`);
      }
    } catch (error: unknown) {
      if (this.logger && this.logger.error) {
        this.logger.error('Error processing batch', { error: error instanceof Error ? error.message : String(error) });
      }
      
      // Get the current batch that failed
      const currentBatch = this.queue.splice(0, this.maxBatchSize);
      
      // Reject all requests in the current batch
      for (const request of currentBatch) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        request.reject(new Error(`Batch execution failed: ${errorMessage}`));
      }
    } finally {
      this.processing = false;
      
      // If there are more items in the queue, schedule processing
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }
}
