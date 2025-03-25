import { expect } from 'chai';
import { describe, it } from 'mocha';
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
      
      expect(timerId).to.be.a('string');
      expect(performanceMonitor.getActiveTimerCount()).to.equal(1);
    });

    it('should handle multiple timers', () => {
      performanceMonitor.startTimer('api-request-1');
      performanceMonitor.startTimer('api-request-2');
      performanceMonitor.startTimer('api-request-3');
      
      expect(performanceMonitor.getActiveTimerCount()).to.equal(3);
    });
  });

  describe('stopTimer', () => {
    it('should stop a timer and record the duration', () => {
      const timerId = performanceMonitor.startTimer('api-request');
      
      // Simulate time passing
      clock.tick(150);
      
      const result = performanceMonitor.stopTimer(timerId);
      
      expect(result).to.be.an('object');
      expect(result.operation).to.equal('api-request');
      expect(result.durationMs).to.be.at.least(150);
      expect(performanceMonitor.getActiveTimerCount()).to.equal(0);
    });

    it('should return null for invalid timer ID', () => {
      const result = performanceMonitor.stopTimer('invalid-id');
      
      expect(result).to.be.null;
    });

    it('should include context data in timer result', () => {
      const context = { method: 'GET', url: '/api/users', status: 200 };
      const timerId = performanceMonitor.startTimer('api-request', context);
      
      clock.tick(100);
      
      const result = performanceMonitor.stopTimer(timerId);
      
      expect(result.context).to.deep.equal(context);
    });

    it('should allow adding additional context when stopping', () => {
      const initialContext = { method: 'GET', url: '/api/users' };
      const timerId = performanceMonitor.startTimer('api-request', initialContext);
      
      clock.tick(100);
      
      const additionalContext = { status: 200, responseSize: 1024 };
      const result = performanceMonitor.stopTimer(timerId, additionalContext);
      
      expect(result.context).to.include(initialContext);
      expect(result.context).to.include(additionalContext);
    });
  });

  describe('recordMetric', () => {
    it('should record a custom metric', () => {
      performanceMonitor.recordMetric('cpu-usage', 45.2, { server: 'api-1' });
      
      const metrics = performanceMonitor.getMetrics('cpu-usage');
      
      expect(metrics).to.be.an('array').with.lengthOf(1);
      expect(metrics[0].name).to.equal('cpu-usage');
      expect(metrics[0].value).to.equal(45.2);
      expect(metrics[0].context).to.deep.equal({ server: 'api-1' });
    });

    it('should handle multiple metrics of the same type', () => {
      performanceMonitor.recordMetric('memory-usage', 1024);
      performanceMonitor.recordMetric('memory-usage', 2048);
      performanceMonitor.recordMetric('memory-usage', 1536);
      
      const metrics = performanceMonitor.getMetrics('memory-usage');
      
      expect(metrics).to.be.an('array').with.lengthOf(3);
      expect(metrics.map(m => m.value)).to.deep.equal([1024, 2048, 1536]);
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
      expect(performanceMonitor.getActiveTimerCount()).to.equal(1);
      
      // Advance time
      clock.tick(150);
      
      // Now await the result
      const result = await promise;
      
      expect(result).to.equal('result');
      expect(performanceMonitor.getActiveTimerCount()).to.equal(0);
      
      // Check that the metric was recorded
      const metrics = performanceMonitor.getMetrics('async-operation');
      expect(metrics).to.be.an('array').with.lengthOf(1);
      expect(metrics[0].durationMs).to.be.at.least(100);
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
      expect(metrics[0].context.args).to.deep.equal([42, 'test']);
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
      expect(metrics[0].context.result).to.deep.equal({ id: 123, name: 'Test' });
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
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
      }
      
      const metrics = performanceMonitor.getMetrics('async-with-error');
      expect(metrics[0].context.error).to.be.an('object');
      expect(metrics[0].context.error.message).to.equal('Test error');
      expect(metrics[0].context.success).to.be.false;
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
      
      expect(summary).to.be.an('object');
      expect(summary).to.have.property('api-latency');
      expect(summary).to.have.property('memory-usage');
      
      expect(summary['api-latency'].count).to.equal(4);
      expect(summary['api-latency'].min).to.equal(120);
      expect(summary['api-latency'].max).to.equal(200);
      expect(summary['api-latency'].mean).to.be.closeTo(162.5, 0.1);
      
      expect(summary['memory-usage'].count).to.equal(3);
      expect(summary['memory-usage'].min).to.equal(1024);
      expect(summary['memory-usage'].max).to.equal(2048);
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
      expect(summary['api-latency'].count).to.equal(1);
      expect(summary['api-latency'].min).to.equal(300);
      expect(summary['api-latency'].max).to.equal(300);
      
      expect(summary['memory-usage'].count).to.equal(1);
      expect(summary['memory-usage'].min).to.equal(3072);
      expect(summary['memory-usage'].max).to.equal(3072);
    });

    it('should filter metrics by name', () => {
      const summary = performanceMonitor.getMetricsSummary({
        metricNames: ['api-latency']
      });
      
      expect(summary).to.have.property('api-latency');
      expect(summary).to.not.have.property('memory-usage');
    });

    it('should group metrics by context', () => {
      const summary = performanceMonitor.getMetricsSummary({
        metricNames: ['api-latency'],
        groupBy: 'endpoint'
      });
      
      expect(summary['api-latency']).to.be.an('object');
      expect(summary['api-latency']).to.have.property('/users');
      expect(summary['api-latency']).to.have.property('/posts');
      
      expect(summary['api-latency']['/users'].count).to.equal(2);
      expect(summary['api-latency']['/users'].min).to.equal(120);
      expect(summary['api-latency']['/users'].max).to.equal(150);
      
      expect(summary['api-latency']['/posts'].count).to.equal(2);
      expect(summary['api-latency']['/posts'].min).to.equal(180);
      expect(summary['api-latency']['/posts'].max).to.equal(200);
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
      
      expect(fsServiceStub.ensureDirectoryExists.calledOnce).to.be.true;
      expect(fsServiceStub.writeFile.calledOnce).to.be.true;
      
      // Check the content being written
      const content = fsServiceStub.writeFile.firstCall.args[1];
      const data = JSON.parse(content);
      
      expect(data).to.be.an('object');
      expect(data.metrics).to.be.an('array').with.lengthOf(2);
      expect(data.summary).to.be.an('object');
      expect(data.summary).to.have.property('api-latency');
      expect(data.summary).to.have.property('memory-usage');
    });

    it('should handle file writing errors', async () => {
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.writeFile.rejects(new Error('Write error'));
      
      performanceMonitor.recordMetric('test', 1);
      
      try {
        await performanceMonitor.saveMetricsToFile('/path/to/file.json');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to save metrics');
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      performanceMonitor.recordMetric('metric1', 1);
      performanceMonitor.recordMetric('metric2', 2);
      
      expect(performanceMonitor.getMetrics('metric1')).to.have.lengthOf(1);
      expect(performanceMonitor.getMetrics('metric2')).to.have.lengthOf(1);
      
      performanceMonitor.clearMetrics();
      
      expect(performanceMonitor.getMetrics('metric1')).to.be.an('array').that.is.empty;
      expect(performanceMonitor.getMetrics('metric2')).to.be.an('array').that.is.empty;
    });

    it('should clear metrics of a specific type', () => {
      performanceMonitor.recordMetric('metric1', 1);
      performanceMonitor.recordMetric('metric2', 2);
      
      performanceMonitor.clearMetrics('metric1');
      
      expect(performanceMonitor.getMetrics('metric1')).to.be.an('array').that.is.empty;
      expect(performanceMonitor.getMetrics('metric2')).to.have.lengthOf(1);
    });
  });
});