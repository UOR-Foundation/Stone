import { expect } from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import { SecurityAuditLogger } from '../../../src/security/audit-logger';
import { FileSystemService } from '../../../src/services/filesystem-service';
import { LoggerService } from '../../../src/services/logger-service';
import { SensitiveDataFilter } from '../../../src/security/data-filter';

describe('SecurityAuditLogger', () => {
  let auditLogger: SecurityAuditLogger;
  let fsServiceStub: sinon.SinonStubbedInstance<FileSystemService>;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;
  let dataFilterStub: sinon.SinonStubbedInstance<SensitiveDataFilter>;

  beforeEach(() => {
    fsServiceStub = sinon.createStubInstance(FileSystemService);
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };
    
    dataFilterStub = sinon.createStubInstance(SensitiveDataFilter);
    
    // Set up dataFilter stub to pass through data by default
    dataFilterStub.sanitizeForLog.callsFake((data) => data);
    
    auditLogger = new SecurityAuditLogger(fsServiceStub, loggerStub, dataFilterStub);
  });

  describe('logSecurityEvent', () => {
    it('should log a security event to the audit log file', async () => {
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.appendFile.resolves();
      
      const event = {
        type: 'authentication',
        action: 'login',
        user: 'admin',
        status: 'success',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };
      
      await auditLogger.logSecurityEvent(event);
      
      expect(fsServiceStub.ensureDirectoryExists.calledOnce).to.be.true;
      expect(fsServiceStub.appendFile.calledOnce).to.be.true;
      
      // Check that data is properly formatted
      const logLine = fsServiceStub.appendFile.firstCall.args[1];
      expect(logLine).to.include('"type":"authentication"');
      expect(logLine).to.include('"action":"login"');
      expect(logLine).to.include('"user":"admin"');
      expect(logLine).to.include('"timestamp"');
    });

    it('should filter sensitive data before logging', async () => {
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.appendFile.resolves();
      
      // Set up filter to sanitize 'password' field
      dataFilterStub.sanitizeForLog.callsFake((data) => {
        if (typeof data === 'object' && data !== null && 'password' in data) {
          return { ...data, password: '[FILTERED]' };
        }
        return data;
      });
      
      const event = {
        type: 'authentication',
        action: 'login',
        user: 'admin',
        password: 'secret123', // Should be filtered
        status: 'success'
      };
      
      await auditLogger.logSecurityEvent(event);
      
      expect(dataFilterStub.sanitizeForLog.calledOnce).to.be.true;
      
      // Check that sensitive data is filtered
      const logLine = fsServiceStub.appendFile.firstCall.args[1];
      expect(logLine).to.include('"password":"[FILTERED]"');
    });

    it('should handle failures when writing to log file', async () => {
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.appendFile.rejects(new Error('Write permission denied'));
      
      const event = {
        type: 'access_control',
        action: 'permission_denied',
        user: 'guest',
        resource: '/secure/file.txt'
      };
      
      try {
        await auditLogger.logSecurityEvent(event);
        // Should reach here since we catch and log the error
      } catch (error) {
        // Should not reach here
        expect.fail('Should have caught the error');
      }
      
      // Error should be logged
      expect(loggerStub.error.calledOnce).to.be.true;
      expect(loggerStub.error.firstCall.args[0]).to.include('Failed to write to security audit log');
    });
  });

  describe('getRecentEvents', () => {
    it('should retrieve recent security events', async () => {
      const mockLogs = `
        {"type":"authentication","action":"login","user":"admin","status":"success","timestamp":"2023-01-01T10:00:00Z"}
        {"type":"authentication","action":"logout","user":"admin","status":"success","timestamp":"2023-01-01T11:00:00Z"}
        {"type":"access_control","action":"permission_denied","user":"guest","resource":"/secure/file.txt","timestamp":"2023-01-01T12:00:00Z"}
      `;
      
      fsServiceStub.readFile.resolves(mockLogs);
      
      const events = await auditLogger.getRecentEvents();
      
      expect(events).to.be.an('array').with.lengthOf(3);
      expect(events[0].type).to.equal('authentication');
      expect(events[0].action).to.equal('login');
      expect(events[1].user).to.equal('admin');
      expect(events[2].action).to.equal('permission_denied');
    });

    it('should filter events by type', async () => {
      const mockLogs = `
        {"type":"authentication","action":"login","user":"admin","timestamp":"2023-01-01T10:00:00Z"}
        {"type":"access_control","action":"permission_denied","user":"guest","timestamp":"2023-01-01T11:00:00Z"}
        {"type":"data_access","action":"read","user":"user1","timestamp":"2023-01-01T12:00:00Z"}
        {"type":"authentication","action":"logout","user":"admin","timestamp":"2023-01-01T13:00:00Z"}
      `;
      
      fsServiceStub.readFile.resolves(mockLogs);
      
      const events = await auditLogger.getRecentEvents({ type: 'authentication' });
      
      expect(events).to.be.an('array').with.lengthOf(2);
      expect(events[0].type).to.equal('authentication');
      expect(events[0].action).to.equal('login');
      expect(events[1].type).to.equal('authentication');
      expect(events[1].action).to.equal('logout');
    });

    it('should filter events by user', async () => {
      const mockLogs = `
        {"type":"authentication","action":"login","user":"admin","timestamp":"2023-01-01T10:00:00Z"}
        {"type":"authentication","action":"login","user":"user1","timestamp":"2023-01-01T11:00:00Z"}
        {"type":"data_access","action":"read","user":"admin","timestamp":"2023-01-01T12:00:00Z"}
      `;
      
      fsServiceStub.readFile.resolves(mockLogs);
      
      const events = await auditLogger.getRecentEvents({ user: 'admin' });
      
      expect(events).to.be.an('array').with.lengthOf(2);
      expect(events[0].user).to.equal('admin');
      expect(events[1].user).to.equal('admin');
    });

    it('should filter events by timeframe', async () => {
      const mockLogs = `
        {"type":"authentication","action":"login","user":"admin","timestamp":"2023-01-01T10:00:00Z"}
        {"type":"authentication","action":"login","user":"user1","timestamp":"2023-01-01T15:00:00Z"}
        {"type":"data_access","action":"read","user":"admin","timestamp":"2023-01-01T20:00:00Z"}
      `;
      
      fsServiceStub.readFile.resolves(mockLogs);
      
      const events = await auditLogger.getRecentEvents({ 
        startTime: new Date('2023-01-01T14:00:00Z'),
        endTime: new Date('2023-01-01T19:00:00Z')
      });
      
      expect(events).to.be.an('array').with.lengthOf(1);
      expect(events[0].timestamp).to.equal('2023-01-01T15:00:00Z');
    });

    it('should handle limit parameter', async () => {
      const mockLogs = `
        {"type":"authentication","action":"login","user":"admin","timestamp":"2023-01-01T10:00:00Z"}
        {"type":"authentication","action":"login","user":"user1","timestamp":"2023-01-01T11:00:00Z"}
        {"type":"data_access","action":"read","user":"admin","timestamp":"2023-01-01T12:00:00Z"}
        {"type":"access_control","action":"permission_denied","user":"guest","timestamp":"2023-01-01T13:00:00Z"}
      `;
      
      fsServiceStub.readFile.resolves(mockLogs);
      
      const events = await auditLogger.getRecentEvents({ limit: 2 });
      
      expect(events).to.be.an('array').with.lengthOf(2);
      // Should return the most recent events
      expect(events[0].timestamp).to.equal('2023-01-01T13:00:00Z');
      expect(events[1].timestamp).to.equal('2023-01-01T12:00:00Z');
    });

    it('should handle empty or invalid log file', async () => {
      fsServiceStub.readFile.resolves('');
      
      const events = await auditLogger.getRecentEvents();
      
      expect(events).to.be.an('array').with.lengthOf(0);
      
      // Test with invalid JSON
      fsServiceStub.readFile.resolves('invalid json {');
      
      const events2 = await auditLogger.getRecentEvents();
      
      expect(events2).to.be.an('array').with.lengthOf(0);
      expect(loggerStub.warn.calledOnce).to.be.true;
    });
  });

  describe('generateSecurityReport', () => {
    it('should generate a security report based on events', async () => {
      const mockLogs = `
        {"type":"authentication","action":"login","user":"admin","status":"success","timestamp":"2023-01-01T10:00:00Z"}
        {"type":"authentication","action":"login","user":"admin","status":"failed","timestamp":"2023-01-01T10:05:00Z"}
        {"type":"authentication","action":"login","user":"admin","status":"failed","timestamp":"2023-01-01T10:10:00Z"}
        {"type":"authentication","action":"login","user":"admin","status":"success","timestamp":"2023-01-01T10:15:00Z"}
        {"type":"access_control","action":"permission_denied","user":"admin","resource":"/secure/file.txt","timestamp":"2023-01-01T11:00:00Z"}
        {"type":"access_control","action":"permission_denied","user":"guest","resource":"/secure/file.txt","timestamp":"2023-01-01T12:00:00Z"}
        {"type":"token","action":"created","user":"admin","timestamp":"2023-01-01T13:00:00Z"}
      `;
      
      fsServiceStub.readFile.resolves(mockLogs);
      
      const report = await auditLogger.generateSecurityReport({
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-02T00:00:00Z')
      });
      
      expect(report).to.be.an('object');
      
      // Check event counts
      expect(report.totalEvents).to.equal(7);
      expect(report.eventsByType.authentication).to.equal(4);
      expect(report.eventsByType.access_control).to.equal(2);
      expect(report.eventsByType.token).to.equal(1);
      
      // Check authentication failures
      expect(report.authenticationFailures).to.equal(2);
      
      // Check permission denials
      expect(report.permissionDenials).to.equal(2);
      
      // Check user activity
      expect(report.userActivity.admin).to.equal(5);
      expect(report.userActivity.guest).to.equal(1);
    });

    it('should generate an empty report when no events match', async () => {
      const mockLogs = `
        {"type":"authentication","action":"login","user":"admin","status":"success","timestamp":"2023-01-01T10:00:00Z"}
      `;
      
      fsServiceStub.readFile.resolves(mockLogs);
      
      const report = await auditLogger.generateSecurityReport({
        startTime: new Date('2023-01-02T00:00:00Z'),
        endTime: new Date('2023-01-03T00:00:00Z')
      });
      
      expect(report).to.be.an('object');
      expect(report.totalEvents).to.equal(0);
      expect(report.eventsByType).to.deep.equal({});
      expect(report.authenticationFailures).to.equal(0);
      expect(report.permissionDenials).to.equal(0);
      expect(report.userActivity).to.deep.equal({});
    });
  });
});