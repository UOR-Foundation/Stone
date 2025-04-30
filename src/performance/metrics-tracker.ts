import { LoggerService } from '../services/logger-service';

let rateLimiterMetrics: any[] = [];
let batcherMetrics: any[] = [];
let systemMetrics: any[] = [];

const logger = new LoggerService();

/**
 * Track rate limiter metrics
 */
export function trackRateLimiterMetric(name: string, data: any): void {
  rateLimiterMetrics.push({
    timestamp: Date.now(),
    name,
    ...data
  });
  
  if (rateLimiterMetrics.length > 100) {
    rateLimiterMetrics = rateLimiterMetrics.slice(-100);
  }
}

/**
 * Track request batcher metrics
 */
export function trackBatcherMetric(name: string, data: any): void {
  batcherMetrics.push({
    timestamp: Date.now(),
    name,
    ...data
  });
  
  if (batcherMetrics.length > 100) {
    batcherMetrics = batcherMetrics.slice(-100);
  }
}

/**
 * Get all rate limiter metrics
 */
export function getRateLimiterMetrics(): any[] {
  return [...rateLimiterMetrics];
}

/**
 * Get all batcher metrics
 */
export function getBatcherMetrics(): any[] {
  return [...batcherMetrics];
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  rateLimiterMetrics = [];
  batcherMetrics = [];
  systemMetrics = [];
}
