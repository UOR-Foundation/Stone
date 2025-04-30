import { LoggerService } from '../services/logger-service';
import * as NodeJS from 'node:timers';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  used: number;
  resetTime: number; // Unix timestamp in ms
}

/**
 * Result of a token acquisition attempt
 */
export interface TokenResult {
  success: boolean;
  remaining: number;
  retryAfter?: number; // ms until next token is available
}

/**
 * Result of a rate limit check
 */
export interface RateLimitStatus {
  limited: boolean;
  remaining: number;
  retryAfter?: number; // ms until reset
}

/**
 * Headers containing rate limit information
 */
export interface RateLimitHeaders {
  [key: string]: string;
}

/**
 * Manages API request rate limiting using token bucket algorithm
 */
export class RateLimiter {
  private limits: Map<string, RateLimitConfig> = new Map();
  private readonly defaultMax = 60; // Default to 60 requests per minute
  private readonly defaultWindow = 60; // Default window of 60 seconds

  constructor(private logger: LoggerService) {}

  /**
   * Register a rate limit for a specific API
   * @param key Identifier for the API
   * @param maxRequests Maximum requests allowed in the time window
   * @param windowSeconds Time window in seconds
   */
  public registerLimit(key: string, maxRequests: number, windowSeconds: number): void {
    this.limits.set(key, {
      maxRequests,
      windowSeconds,
      used: 0,
      resetTime: Date.now() + windowSeconds * 1000
    });
    
    this.logger.debug(`Registered rate limit for ${key}: ${maxRequests} requests per ${windowSeconds}s`);
  }

  /**
   * Get all registered rate limits
   * @returns Map of limit keys to their configurations
   */
  public getLimits(): Record<string, RateLimitConfig> {
    const limits: Record<string, RateLimitConfig> = {};
    
    for (const [key, config] of this.limits.entries()) {
      limits[key] = { ...config };
    }
    
    return limits;
  }

  /**
   * Try to acquire a token for making a request
   * @param key Identifier for the API
   * @returns Result indicating success and remaining tokens
   */
  public async acquireToken(key: string): Promise<TokenResult> {
    // Ensure limit exists, or create default
    if (!this.limits.has(key)) {
      this.registerLimit(key, this.defaultMax, this.defaultWindow);
    }
    
    const limit = this.limits.get(key)!;
    const now = Date.now();
    
    // Check if time window has passed and reset if needed
    if (now >= limit.resetTime) {
      // Reset for new time window
      limit.used = 0;
      limit.resetTime = now + limit.windowSeconds * 1000;
    }
    
    // Check if limit is reached
    if (limit.used >= limit.maxRequests) {
      const retryAfter = Math.max(0, limit.resetTime - now);
      this.logger.debug(`Rate limit reached for ${key}, retry after ${retryAfter}ms`);
      
      return {
        success: false,
        remaining: 0,
        retryAfter
      };
    }
    
    // Consume a token
    limit.used++;
    const remaining = limit.maxRequests - limit.used;
    
    this.logger.debug(`Token acquired for ${key}, ${remaining} remaining`);
    return {
      success: true,
      remaining
    };
  }

  /**
   * Check if a key is currently rate limited without consuming a token
   * @param key Identifier for the API
   * @returns Status object with limit information
   */
  public isRateLimited(key: string): RateLimitStatus {
    // Ensure limit exists, or create default
    if (!this.limits.has(key)) {
      this.registerLimit(key, this.defaultMax, this.defaultWindow);
    }
    
    const limit = this.limits.get(key)!;
    const now = Date.now();
    
    // Check if time window has passed and would reset
    if (now >= limit.resetTime) {
      // Would reset for new time window
      return {
        limited: false,
        remaining: limit.maxRequests
      };
    }
    
    // Calculate remaining
    const remaining = Math.max(0, limit.maxRequests - limit.used);
    const limited = remaining === 0;
    
    // Return status
    const status: RateLimitStatus = {
      limited,
      remaining
    };
    
    if (limited) {
      status.retryAfter = Math.max(0, limit.resetTime - now);
    }
    
    return status;
  }

  /**
   * Wait until a token is available, with timeout
   * @param key Identifier for the API
   * @param timeoutSeconds Maximum time to wait in seconds (default: 60)
   * @returns Token result after waiting
   */
  public async waitForToken(key: string, timeoutSeconds: number = 60): Promise<TokenResult> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    
    // First check if we can get a token immediately
    const immediate = await this.acquireToken(key);
    if (immediate.success) {
      return immediate;
    }
    
    // If not, we need to wait
    this.logger.debug(`Waiting for rate limit token for ${key}`);
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        // Check if timeout has been reached
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for rate limit token for ${key}`));
          return;
        }
        
        // Try to get a token
        const result = await this.acquireToken(key);
        if (result.success) {
          clearInterval(checkInterval);
          resolve(result);
        }
      }, 100); // Check every 100ms
    });
  }

  /**
   * Reset the usage counter for a specific limit
   * @param key Identifier for the API
   */
  public resetLimit(key: string): void {
    if (this.limits.has(key)) {
      const limit = this.limits.get(key)!;
      limit.used = 0;
      limit.resetTime = Date.now() + limit.windowSeconds * 1000;
      this.logger.debug(`Reset rate limit for ${key}`);
    }
  }

  /**
   * Reset all rate limits
   */
  public resetAllLimits(): void {
    for (const key of this.limits.keys()) {
      this.resetLimit(key);
    }
    this.logger.debug('Reset all rate limits');
  }

  /**
   * Update rate limit based on response headers
   * @param key Identifier for the API
   * @param headers Headers containing rate limit information
   */
  public updateLimitFromResponse(key: string, headers: RateLimitHeaders): void {
    // Look for different header formats
    const limit = this.extractLimitFromHeaders(headers);
    
    if (!limit) {
      return;
    }
    
    // Create or update limit
    if (!this.limits.has(key)) {
      this.registerLimit(key, limit.limit, limit.resetSeconds);
    }
    
    const existingLimit = this.limits.get(key)!;
    existingLimit.maxRequests = limit.limit;
    existingLimit.used = limit.limit - limit.remaining;
    existingLimit.resetTime = limit.resetTime;
    
    this.logger.debug(`Updated rate limit for ${key} from response headers: ${limit.remaining}/${limit.limit}`);
  }

  /**
   * Extract rate limit information from response headers
   * @param headers Response headers
   * @returns Extracted limit information or null if not found
   */
  private extractLimitFromHeaders(headers: RateLimitHeaders): { 
    limit: number;
    remaining: number;
    resetTime: number;
    resetSeconds: number;
  } | null {
    // GitHub style
    if (headers['x-ratelimit-limit'] && headers['x-ratelimit-remaining']) {
      const limit = parseInt(headers['x-ratelimit-limit'], 10);
      const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
      let resetTime: number;
      
      if (headers['x-ratelimit-reset']) {
        // GitHub provides Unix timestamp in seconds
        resetTime = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
      } else {
        // Default to 1 hour if not provided
        resetTime = Date.now() + 3600 * 1000;
      }
      
      const resetSeconds = Math.max(1, Math.round((resetTime - Date.now()) / 1000));
      
      return { limit, remaining, resetTime, resetSeconds };
    }
    
    // Generic style
    if (headers['rate-limit'] && headers['rate-limit-remaining']) {
      const limit = parseInt(headers['rate-limit'], 10);
      const remaining = parseInt(headers['rate-limit-remaining'], 10);
      let resetTime: number;
      
      if (headers['rate-limit-reset']) {
        // Could be Unix timestamp in ms or seconds, or seconds from now
        const resetValue = parseInt(headers['rate-limit-reset'], 10);
        
        // If it's a small number, treat as seconds from now
        if (resetValue < 86400) { // Less than a day
          resetTime = Date.now() + resetValue * 1000;
        } else if (resetValue < 86400000) { // Less than a day in ms
          resetTime = Date.now() + resetValue;
        } else {
          // Treat as Unix timestamp
          resetTime = resetValue * 1000;
        }
      } else {
        // Default to 1 hour if not provided
        resetTime = Date.now() + 3600 * 1000;
      }
      
      const resetSeconds = Math.max(1, Math.round((resetTime - Date.now()) / 1000));
      
      return { limit, remaining, resetTime, resetSeconds };
    }
    
    return null;
  }
}
