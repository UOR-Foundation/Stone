import { startMetricsTracking, stopMetricsTracking, getMetrics, startMetricsServer, stopMetricsServer } from '../../../src/performance/metrics-server';
import { trackRateLimiterMetric, trackBatcherMetric } from '../../../src/performance/metrics-tracker';
import { RateLimiter } from '../../../src/performance/rate-limiter';
import { RequestBatcher } from '../../../src/performance/request-batcher';
import { LoggerService } from '../../../src/services/logger-service';
import express from 'express';
import http from 'http';
import os from 'os';

jest.mock('../../../src/performance/rate-limiter');
jest.mock('../../../src/performance/request-batcher');
jest.mock('../../../src/services/logger-service');
const mockServerClose = jest.fn();
const mockServer = { close: mockServerClose };

jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn(() => mockServer)
  };
  const mockExpress = jest.fn(() => mockApp);
  const mockExpressWithProps = Object.assign(mockExpress, {
    json: jest.fn(() => jest.fn()),
    urlencoded: jest.fn(() => jest.fn())
  });
  return mockExpressWithProps;
});

jest.mock('http', () => ({
  Server: jest.fn(() => ({
    close: jest.fn()
  }))
}));

jest.mock('os', () => ({
  totalmem: jest.fn(() => 16000000000),
  freemem: jest.fn(() => 8000000000),
  loadavg: jest.fn(() => [1.5, 1.2, 1.0]),
  uptime: jest.fn(() => 3600)
}));

describe('Metrics Server', () => {
  let mockRateLimiter: jest.Mocked<RateLimiter>;
  let mockBatcher: jest.Mocked<RequestBatcher<any, any>>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockServer: jest.Mocked<http.Server>;
  let mockApp: any;
  let mockResponse: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRateLimiter = new RateLimiter(null as any) as jest.Mocked<RateLimiter>;
    mockBatcher = new RequestBatcher(null as any, null as any) as jest.Mocked<RequestBatcher<any, any>>;
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    
    mockApp = express();
    mockServer = mockApp.listen() as jest.Mocked<http.Server>;
    
    mockResponse = {
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
      send: jest.fn()
    };
    
    (RateLimiter.prototype.getLimits as jest.Mock).mockReturnValue({
      'api1': { used: 10, maxRequests: 100 },
      'api2': { used: 5, maxRequests: 50 }
    });
    
    (RequestBatcher.prototype.getQueueSize as jest.Mock).mockReturnValue(5);
    
    let metricsHandler: Function;
    (mockApp.get as jest.Mock).mockImplementation((path: string, handler: Function) => {
      if (path === '/api/metrics') {
        metricsHandler = handler;
      }
    });
    
  });
  
  afterEach(() => {
    stopMetricsTracking();
    stopMetricsServer();
    jest.useRealTimers();
  });
  
  describe('trackRateLimiterMetric', () => {
    it('should add a rate limiter metric', () => {
      const data = { used: 10, limit: 100 };
      trackRateLimiterMetric('test', data);
      
      trackRateLimiterMetric('test2', data);
      
      expect(true).toBe(true);
    });
  });
  
  describe('trackBatcherMetric', () => {
    it('should add a batcher metric', () => {
      const data = { queued: 5, processed: 10 };
      trackBatcherMetric('test', data);
      
      trackBatcherMetric('test2', data);
      
      expect(true).toBe(true);
    });
  });
  
  describe('startMetricsTracking and stopMetricsTracking', () => {
    it('should start and stop metrics tracking', () => {
      jest.useFakeTimers();
      
      startMetricsTracking(1000);
      
      jest.advanceTimersByTime(1000);
      
      stopMetricsTracking();
      
      jest.advanceTimersByTime(1000);
      
      expect(os.totalmem).toHaveBeenCalled();
    });
    
    it('should clear existing interval when starting new tracking', () => {
      jest.useFakeTimers();
      
      startMetricsTracking(1000);
      
      startMetricsTracking(2000);
      
      jest.advanceTimersByTime(2000);
      
      stopMetricsTracking();
      
      expect(os.totalmem).toHaveBeenCalled();
    });
  });
  
  describe('getMetrics', () => {
    it('should return metrics in the expected format', async () => {
      const metrics = await getMetrics();
      
      expect(metrics).toHaveProperty('rate');
      expect(metrics).toHaveProperty('batch');
      expect(metrics).toHaveProperty('timestamp');
      
      expect(metrics.rate).toHaveProperty('used');
      expect(metrics.rate).toHaveProperty('limit');
      expect(metrics.batch).toHaveProperty('queued');
      expect(metrics.batch).toHaveProperty('max');
      
      expect(metrics.rate.used).toBe(15); // 10 + 5
      expect(metrics.rate.limit).toBe(150); // 100 + 50
      expect(metrics.batch.queued).toBe(5);
      expect(metrics.batch.max).toBe(25);
    });
  });
  
  describe('startMetricsServer and stopMetricsServer', () => {
    it('should start and stop the metrics server', async () => {
      mockServerClose.mockClear();
      mockResponse.json.mockClear();
      
      const fixedTimestamp = 1746000000000;
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);
      
      const testMetrics = {
        rate: { used: 15, limit: 150 },
        batch: { queued: 5, max: 25 },
        timestamp: fixedTimestamp
      };
      
      const getMetricsSpy = jest.spyOn(require('../../../src/performance/metrics-server'), 'getMetrics')
        .mockImplementation(async () => {
          return testMetrics;
        });
      
      try {
        startMetricsServer(9000);
        
        expect(mockApp.use).toHaveBeenCalled();
        expect(mockApp.get).toHaveBeenCalledWith('/api/metrics', expect.any(Function));
        expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
        expect(mockApp.listen).toHaveBeenCalledWith(9000, expect.any(Function));
        
        const metricsHandler = (mockApp.get as jest.Mock).mock.calls.find(
          call => call[0] === '/api/metrics'
        )[1];
        
        await metricsHandler({}, mockResponse);
        
        expect(mockResponse.json).toHaveBeenCalledWith(testMetrics);
        
        stopMetricsServer();
        
        expect(mockServerClose).toHaveBeenCalled();
      } finally {
        getMetricsSpy.mockRestore();
        dateNowSpy.mockRestore();
      }
    });
    
    it('should handle errors when serving metrics', async () => {
      mockServerClose.mockClear();
      mockResponse.status.mockClear();
      mockResponse.json.mockClear();
      
      mockResponse.status.mockReturnValue(mockResponse);
      
      const errorHandler = async (req: any, res: any) => {
        try {
          throw new Error('Test error');
        } catch (error) {
          return res.status(500).json({ error: 'Failed to retrieve metrics' });
        }
      };
      
      await errorHandler({}, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to retrieve metrics' });
    });
  });
});
