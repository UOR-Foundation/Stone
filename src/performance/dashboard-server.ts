import { RateLimiter } from './rate-limiter';
import { RequestBatcher } from './request-batcher';
import { Logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

/**
 * Interface for API request
 */
export interface DashboardApiRequest {
  path: string;
  method: string;
  query: Record<string, string>;
  headers: Record<string, string>;
}

/**
 * Interface for API response
 */
export interface DashboardApiResponse {
  status: number;
  headers?: Record<string, string>;
  body: string | Buffer | Record<string, any>;
}

/**
 * Server for the Stone dashboard
 * Designed to work in both Node.js and serverless environments
 */
export class DashboardServer {
  private logger: Logger;
  private rateLimiter?: RateLimiter;
  private requestBatcher?: RequestBatcher;
  
  constructor() {
    this.logger = new Logger();
  }
  
  /**
   * Initialize the server with performance components
   */
  public async initialize(): Promise<void> {
    try {
      const rateLimiterModule = await import('./rate-limiter');
      const batcherModule = await import('./request-batcher');
      
      if (rateLimiterModule.RateLimiter.getInstance) {
        this.rateLimiter = rateLimiterModule.RateLimiter.getInstance();
      }
      
      if (batcherModule.RequestBatcher.getInstance) {
        this.requestBatcher = batcherModule.RequestBatcher.getInstance();
      }
    } catch (error) {
      this.logger.error(`Failed to initialize dashboard server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Handle an API request
   */
  public async handleRequest(req: DashboardApiRequest): Promise<DashboardApiResponse> {
    try {
      if (req.path === '/api/metrics' || req.path === '/Stone/api/metrics') {
        return this.handleMetricsRequest(req);
      }
      
      if (req.path === '/' || req.path === '/Stone/' || req.path === '') {
        return this.serveFile('index.html', 'text/html');
      }
      
      let filePath = req.path;
      
      if (filePath.startsWith('/Stone/')) {
        filePath = filePath.substring(7);
      }
      
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }
      
      const distPath = path.join(process.cwd(), 'dist', 'dashboard', filePath);
      
      if (fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
        return this.serveFile(filePath, this.getContentType(filePath));
      }
      
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Not found' })
      };
    } catch (error) {
      this.logger.error(`Dashboard server error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  }
  
  /**
   * Handle metrics API request
   */
  private async handleMetricsRequest(req: DashboardApiRequest): Promise<DashboardApiResponse> {
    try {
      const metrics = {
        rate: this.rateLimiter ? {
          used: this.rateLimiter.getUsedRequests(),
          limit: this.rateLimiter.getRequestLimit()
        } : { used: 0, limit: 0 },
        batch: this.requestBatcher ? {
          queued: this.requestBatcher.getQueueSize(),
          max: this.requestBatcher.getMaxBatchSize()
        } : { queued: 0, max: 0 },
        timestamp: Date.now()
      };
      
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify(metrics)
      };
    } catch (error) {
      this.logger.error(`Metrics error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Failed to fetch metrics' })
      };
    }
  }
  
  /**
   * Serve a static file
   */
  private serveFile(filePath: string, contentType: string): DashboardApiResponse {
    try {
      const fullPath = path.join(process.cwd(), 'dist', 'dashboard', filePath);
      const content = fs.readFileSync(fullPath);
      
      return {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': contentType.includes('text/html') ? 'no-cache' : 'max-age=86400'
        },
        body: content
      };
    } catch (error) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'File not found' })
      };
    }
  }
  
  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.html': return 'text/html';
      case '.css': return 'text/css';
      case '.js': return 'application/javascript';
      case '.json': return 'application/json';
      case '.png': return 'image/png';
      case '.jpg': case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      case '.svg': return 'image/svg+xml';
      default: return 'application/octet-stream';
    }
  }
}
