import { RateLimiter } from './rate-limiter';
import { RequestBatcher } from './request-batcher';
import { Logger } from '../utils/logger';
import { LoggerService } from '../services/logger-service';
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

let server: any = null;
let dashboardInstance: DashboardServer | null = null;

/**
 * Start the dashboard server
 */
export function startDashboardServer(port: number = 3000): void {
  try {
    const app = express();
    const logger = new LoggerService();
    
    app.use(cors());
    
    dashboardInstance = new DashboardServer();
    dashboardInstance.initialize();
    
    const dashboardPath = path.join(process.cwd(), 'dist', 'dashboard');
    app.use(express.static(dashboardPath));
    
    app.get('/', (req, res) => {
      const indexPath = path.join(dashboardPath, 'index.html');
      
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Dashboard not built. Run `pnpm build:dashboard` first.');
      }
    });
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    app.get('*', (req, res) => {
      const indexPath = path.join(dashboardPath, 'index.html');
      
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Dashboard not built. Run `pnpm build:dashboard` first.');
      }
    });
    
    server = app.listen(port, () => {
      logger.info(`Dashboard server started on port ${port}`);
    });
  } catch (error) {
    const logger = new LoggerService();
    logger.error(`Error starting dashboard server: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stop the dashboard server
 */
export function stopDashboardServer(): void {
  if (server) {
    server.close();
    server = null;
    const logger = new LoggerService();
    logger.info('Dashboard server stopped');
  }
}

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
  private requestBatcher?: RequestBatcher<unknown, unknown>;
  
  constructor() {
    this.logger = new Logger();
  }
  
  /**
   * Initialize the server with performance components
   */
  public async initialize(): Promise<void> {
    try {
      const { LoggerService } = await import('../services/logger-service');
      const loggerService = new LoggerService();
      
      const { RateLimiter } = await import('./rate-limiter');
      this.rateLimiter = new RateLimiter(loggerService);
      
      const { RequestBatcher } = await import('./request-batcher');
      const dummyProcessor = async () => ({});
      this.requestBatcher = new RequestBatcher<unknown, unknown>(dummyProcessor, loggerService);
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
      let rateUsed = 0;
      let rateLimit = 0;
      let batchQueued = 0;
      let batchMax = 0;
      
      if (this.rateLimiter) {
        const limits = this.rateLimiter.getLimits();
        const firstLimitKey = Object.keys(limits)[0];
        if (firstLimitKey) {
          const limit = limits[firstLimitKey];
          rateUsed = limit.used;
          rateLimit = limit.maxRequests;
        }
      }
      
      if (this.requestBatcher) {
        batchQueued = this.requestBatcher.getQueueSize();
        batchMax = 25; // Default value from RequestBatcher constructor
      }
      
      const metrics = {
        rate: {
          used: rateUsed,
          limit: rateLimit
        },
        batch: {
          queued: batchQueued,
          max: batchMax
        },
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
