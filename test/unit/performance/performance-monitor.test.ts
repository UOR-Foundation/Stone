import sinon from 'sinon';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor';
import { LoggerService } from '../../../src/services/logger-service';
import { FileSystemService } from '../../../src/services/filesystem-service';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;
  let fsServiceStub: sinon.SinonStubbedInstance<FileSystemService>;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };
    
    fsServiceStub = sinon.createStubInstance(FileSystemService);
    clock = sinon.useFakeTimers();
    
    performanceMonitor = new PerformanceMonitor(loggerStub, fsServiceStub);
  });

  afterEach(() => {
    clock.restore();
  });

  describe('startTimer', () => {
    it('should start a timer for a given operation', () => {
      const timerId = performanceMonitor.startTimer('api-request', { endpoint: '/users' });
      
      expect(typeof timerId).toBe('string');
      expect(performanceMonitor.getActiveTimerCount()).toBe(1);
    });

    it('should handle multiple timers', () => {
      performanceMonitor.startTimer('api-request-1');
      performanceMonitor.startTimer('api-request-2');
      performanceMonitor.startTimer('api-request-3');
      
      expect(performanceMonitor.getActiveTimerCount()).toBe(3);
    });
  });

  describe('stopTimer', () => {
    it('should stop a timer and record the duration', () => {
      const timerId = performanceMonitor.startTimer('api-request');
      
      // Simulate time passing
      clock.tick(150);
      
      const result = performanceMonitor.stopTimer(timerId);
      
      expect(result).toBeInstanceOf(Object);
      expect(result.operation).toBe('api-request');
      expect(result.durationMs).toBeGreaterThanOrEqual(150);
      expect(performanceMonitor.getActiveTimerCount()).toBe(0);
    });

    it('should return null for invalid timer ID', () => {
      const result = performanceMonitor.stopTimer('invalid-id');
      
      expect(result).toBeNull();
    });

    it('should include context data in timer result', () => {
      const context = { method: 'GET', url: '/api/users', status: 200 };
      const timerId = performanceMonitor.startTimer('api-request', context);
      
      clock.tick(100);
      
      const result = performanceMonitor.stopTimer(timerId);
      
      expect(result.context).toEqual(context);
    });

    it('should allow adding additional context when stopping', () => {
      const initialContext = { method: 'GET', url: '/api/users' };
      const timerId = performanceMonitor.startTimer('api-request', initialContext);
      
      clock.tick(100);
      
      const additionalContext = { status: 200, responseSize: 1024 };
      const result = performanceMonitor.stopTimer(timerId, additionalContext);
      
      expect(result.context).toMatchObject(initialContext);
      expect(result.context).toMatchObject(additionalContext);
    });
  });

  describe('recordMetric', () => {
    it('should record a custom metric', () => {
      performanceMonitor.recordMetric('cpu-usage', 45.2, { server: 'api-1' });
      
      const metrics = performanceMonitor.getMetrics('cpu-usage');
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(1);
      expect(metrics[0].name).toBe('cpu-usage');
      expect(metrics[0].value).toBe(45.2);
      expect(metrics[0].context).toEqual({ server: 'api-1' });
    });

    it('should handle multiple metrics of the same type', () => {
      performanceMonitor.recordMetric('memory-usage', 1024);
      performanceMonitor.recordMetric('memory-usage', 2048);
      performanceMonitor.recordMetric('memory-usage', 1536);
      
      const metrics = performanceMonitor.getMetrics('memory-usage');
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(3);
      expect(metrics.map(m => m.value)).toEqual([1024, 2048, 1536]);
    });
  });

  describe('wrapAsync', () => {
    it('should time async function execution', async () => {
      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };
      
      const wrapped = performanceMonitor.wrapAsync('async-operation', asyncFn);
      
      // Start the operation but don't await it yet
      const promise = wrapped();
      
      // Should have started a timer
      expect(performanceMonitor.getActiveTimerCount()).toBe(1);
      
      // Advance time
      clock.tick(150);
      
      // Now await the result
      const result = await promise;
      
      expect(result).toBe('result');
      expect(performanceMonitor.getActiveTimerCount()).toBe(0);
      
      // Check that the metric was recorded
      const metrics = performanceMonitor.getMetrics('async-operation');
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(1);
      expect(metrics[0].durationMs).toBeGreaterThanOrEqual(100);
    });

    it('should capture arguments in context', async () => {
      const asyncFn = async (a: number, b: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `${a}-${b}`;
      };
      
      const wrapped = performanceMonitor.wrapAsync('async-with-args', asyncFn, {
        captureArgs: true
      });
      
      await wrapped(42, 'test');
      
      const metrics = performanceMonitor.getMetrics('async-with-args');
      expect(metrics[0].context.args).toEqual([42, 'test']);
    });

    it('should capture return value in context', async () => {
      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id: 123, name: 'Test' };
      };
      
      const wrapped = performanceMonitor.wrapAsync('async-with-result', asyncFn, {
        captureResult: true
      });
      
      await wrapped();
      
      const metrics = performanceMonitor.getMetrics('async-with-result');
      expect(metrics[0].context.result).toEqual({ id: 123, name: 'Test' });
    });

    it('should handle errors in async functions', async () => {
      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Test error');
      };
      
      const wrapped = performanceMonitor.wrapAsync('async-with-error', asyncFn, {
        captureErrors: true
      });
      
      try {
        await wrapped();
        // Should not reach here
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Test error');
      }
      
      const metrics = performanceMonitor.getMetrics('async-with-error');
      expect(metrics[0].context.error).toBeInstanceOf(Object);
      expect(metrics[0].context.error.message).toBe('Test error');
      expect(metrics[0].context.success).toBe(false);
    });
  });

  describe('getMetricsSummary', () => {
    beforeEach(() => {
      // Record some test metrics
      performanceMonitor.recordMetric('api-latency', 150, { endpoint: '/users' });
      performanceMonitor.recordMetric('api-latency', 120, { endpoint: '/users' });
      performanceMonitor.recordMetric('api-latency', 200, { endpoint: '/posts' });
      performanceMonitor.recordMetric('api-latency', 180, { endpoint: '/posts' });
      
      performanceMonitor.recordMetric('memory-usage', 1024);
      performanceMonitor.recordMetric('memory-usage', 1536);
      performanceMonitor.recordMetric('memory-usage', 2048);
    });

    it('should generate summary statistics for metrics', () => {
      const summary = performanceMonitor.getMetricsSummary();
      
      expect(summary).toBeInstanceOf(Object);
      expect(summary).toHaveProperty('api-latency');
      expect(summary).toHaveProperty('memory-usage');
      
      expect(summary['api-latency'].count).toBe(4);
      expect(summary['api-latency'].min).toBe(120);
      expect(summary['api-latency'].max).toBe(200);
      expect(summary['api-latency'].mean).toBeCloseTo(162.5, 1);
      
      expect(summary['memory-usage'].count).toBe(3);
      expect(summary['memory-usage'].min).toBe(1024);
      expect(summary['memory-usage'].max).toBe(2048);
    });

    it('should filter metrics by time range', () => {
      // Add newer metrics
      clock.tick(5000);
      performanceMonitor.recordMetric('api-latency', 300, { endpoint: '/users' });
      performanceMonitor.recordMetric('memory-usage', 3072);
      
      const summary = performanceMonitor.getMetricsSummary({
        startTime: Date.now() - 1000,
        endTime: Date.now() + 1000
      });
      
      // Should only include the newest metrics
      expect(summary['api-latency'].count).toBe(1);
      expect(summary['api-latency'].min).toBe(300);
      expect(summary['api-latency'].max).toBe(300);
      
      expect(summary['memory-usage'].count).toBe(1);
      expect(summary['memory-usage'].min).toBe(3072);
      expect(summary['memory-usage'].max).toBe(3072);
    });

    it('should filter metrics by name', () => {
      const summary = performanceMonitor.getMetricsSummary({
        metricNames: ['api-latency']
      });
      
      expect(summary).toHaveProperty('api-latency');
      expect(summary).not.toHaveProperty('memory-usage');
    });

    it('should group metrics by context', () => {
      const summary = performanceMonitor.getMetricsSummary({
        metricNames: ['api-latency'],
        groupBy: 'endpoint'
      });
      
      expect(summary['api-latency']).toBeInstanceOf(Object);
      expect(summary['api-latency']).toHaveProperty('/users');
      expect(summary['api-latency']).toHaveProperty('/posts');
      
      expect(summary['api-latency']['/users'].count).toBe(2);
      expect(summary['api-latency']['/users'].min).toBe(120);
      expect(summary['api-latency']['/users'].max).toBe(150);
      
      expect(summary['api-latency']['/posts'].count).toBe(2);
      expect(summary['api-latency']['/posts'].min).toBe(180);
      expect(summary['api-latency']['/posts'].max).toBe(200);
    });
  });

  describe('saveMetricsToFile', () => {
    it('should save metrics to a file', async () => {
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.writeFile.resolves();
      
      // Record some test metrics
      performanceMonitor.recordMetric('api-latency', 150);
      performanceMonitor.recordMetric('memory-usage', 1024);
      
      const filePath = '/path/to/metrics.json';
      await performanceMonitor.saveMetricsToFile(filePath);
      
      expect(fsServiceStub.ensureDirectoryExists.calledOnce).toBe(true);
      expect(fsServiceStub.writeFile.calledOnce).toBe(true);
      
      // Check the content being written
      const content = fsServiceStub.writeFile.firstCall.args[1];
      const data = JSON.parse(content);
      
      expect(data).toBeInstanceOf(Object);
      expect(Array.isArray(data.metrics)).toBe(true);
      expect(data.metrics.length).toBe(2);
      expect(data.summary).toBeInstanceOf(Object);
      expect(data.summary).toHaveProperty('api-latency');
      expect(data.summary).toHaveProperty('memory-usage');
    });

    it('should handle file writing errors', async () => {
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.writeFile.rejects(new Error('Write error'));
      
      performanceMonitor.recordMetric('test', 1);
      
      try {
        await performanceMonitor.saveMetricsToFile('/path/to/file.json');
        // Should not reach here
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Failed to save metrics');
        expect(loggerStub.error.calledOnce).toBe(true);
      }
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      performanceMonitor.recordMetric('metric1', 1);
      performanceMonitor.recordMetric('metric2', 2);
      
      expect(performanceMonitor.getMetrics('metric1').length).toBe(1);
      expect(performanceMonitor.getMetrics('metric2').length).toBe(1);
      
      performanceMonitor.clearMetrics();
      
      expect(performanceMonitor.getMetrics('metric1')).toEqual([]);
      expect(performanceMonitor.getMetrics('metric2')).toEqual([]);
    });

    it('should clear metrics of a specific type', () => {
      performanceMonitor.recordMetric('metric1', 1);
      performanceMonitor.recordMetric('metric2', 2);
      
      performanceMonitor.clearMetrics('metric1');
      
      expect(performanceMonitor.getMetrics('metric1')).toEqual([]);
      expect(performanceMonitor.getMetrics('metric2').length).toBe(1);
    });
  });
});