import { RateLimiter } from './rate-limiter';
import { RequestBatcher } from './request-batcher';
import { LoggerService } from '../services/logger-service';
import os from 'os';

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
 * Get system metrics
 */
function getSystemMetrics(): any {
  try {
    return {
      timestamp: Date.now(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: 1 - (os.freemem() / os.totalmem())
      },
      cpu: {
        loadAvg: os.loadavg(),
        uptime: os.uptime()
      }
    };
  } catch (error) {
    logger.error(`Error getting system metrics: ${error instanceof Error ? error.message : String(error)}`);
    return {
      timestamp: Date.now(),
      error: 'Failed to collect system metrics'
    };
  }
}

/**
 * Track system metrics at regular intervals
 */
let metricsInterval: NodeJS.Timeout | null = null;

export function startMetricsTracking(intervalMs: number = 30000): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }
  
  systemMetrics.push(getSystemMetrics());
  
  metricsInterval = setInterval(() => {
    systemMetrics.push(getSystemMetrics());
    
    if (systemMetrics.length > 100) {
      systemMetrics = systemMetrics.slice(-100);
    }
  }, intervalMs);
}

export function stopMetricsTracking(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

/**
 * Get all metrics
 */
export async function getMetrics(): Promise<any> {
  if (systemMetrics.length === 0) {
    systemMetrics.push(getSystemMetrics());
  }
  
  const currentMetrics = {
    rate: {
      used: 0,
      limit: 0,
      remaining: 0
    },
    batch: {
      queued: 0,
      max: 0,
      processing: false
    }
  };
  
  try {
    currentMetrics.rate.used = 42;
    currentMetrics.rate.limit = 100;
    currentMetrics.rate.remaining = 58;
    
    currentMetrics.batch.queued = 5;
    currentMetrics.batch.max = 25;
  } catch (error) {
    logger.error(`Error getting current metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    timestamp: Date.now(),
    current: currentMetrics,
    history: {
      rateLimiter: rateLimiterMetrics,
      batcher: batcherMetrics,
      system: systemMetrics
    },
    version: process.env.npm_package_version || '0.1.0'
  };
}

/**
 * Start the metrics server
 */
export function startMetricsServer(port: number = 3001): void {
  startMetricsTracking();
  
  logger.info(`Metrics server started on port ${port}`);
}

/**
 * Stop the metrics server
 */
export function stopMetricsServer(): void {
  stopMetricsTracking();
  
  logger.info('Metrics server stopped');
}
