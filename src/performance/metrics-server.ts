import { RateLimiter } from './rate-limiter';
import { RequestBatcher } from './request-batcher';
import { LoggerService } from '../services/logger-service';
import { trackRateLimiterMetric, trackBatcherMetric, getRateLimiterMetrics, getBatcherMetrics } from './metrics-tracker';
import express from 'express';
import cors from 'cors';
import http from 'http';
import os from 'os';

let systemMetrics: any[] = [];

const logger = new LoggerService();
const rateLimiter = new RateLimiter(logger);
const batcher = new RequestBatcher(async () => ({}), logger);

let server: http.Server | null = null;


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
 * Get metrics in the required format
 */
export async function getMetrics(): Promise<any> {
  // Get rate limiter metrics
  const rateLimits = rateLimiter.getLimits();
  const rateUsed = Object.values(rateLimits).reduce((total, limit) => total + limit.used, 0);
  const rateLimit = Object.values(rateLimits).reduce((total, limit) => total + limit.maxRequests, 0);
  
  return {
    rate: {
      used: rateUsed,
      limit: rateLimit
    },
    batch: {
      queued: batcher.getQueueSize(),
      max: 25 // Default max batch size
    },
    timestamp: Date.now()
  };
}

/**
 * Start the metrics server
 */
export function startMetricsServer(port: number = 9000): void {
  startMetricsTracking();
  
  const app = express();
  
  app.use(cors());
  
  app.get('/api/metrics', async (req, res) => {
    try {
      const metrics = await getMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error(`Error serving metrics: ${error instanceof Error ? error.message : String(error)}`);
      return res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  server = app.listen(port, () => {
    logger.info(`Metrics server started on port ${port}`);
  });
}

/**
 * Stop the metrics server
 */
export function stopMetricsServer(): void {
  stopMetricsTracking();
  
  if (server) {
    server.close();
    server = null;
    logger.info('Metrics server stopped');
  }
}
