import { expect } from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import { SensitiveDataFilter } from '../../../src/security/data-filter';
import { LoggerService } from '../../../src/services/logger-service';

describe('SensitiveDataFilter', () => {
  let dataFilter: SensitiveDataFilter;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };

    dataFilter = new SensitiveDataFilter(loggerStub);
  });

  describe('addPattern', () => {
    it('should add a regex pattern to filter', () => {
      dataFilter.addPattern('token', /github_pat_[A-Za-z0-9_]{36}/g);
      
      const patterns = dataFilter.getPatterns();
      expect(patterns).to.have.property('token');
      expect(patterns.token).to.be.instanceOf(RegExp);
    });

    it('should add a string pattern to filter', () => {
      dataFilter.addPattern('password', 'password: [^\\s]+');
      
      const patterns = dataFilter.getPatterns();
      expect(patterns).to.have.property('password');
      expect(patterns.password).to.be.instanceOf(RegExp);
    });

    it('should override existing pattern with same name', () => {
      dataFilter.addPattern('key', /api_key: [A-Za-z0-9]{32}/g);
      dataFilter.addPattern('key', /apikey=[A-Za-z0-9]{32}/g);
      
      const patterns = dataFilter.getPatterns();
      expect(patterns.key.toString()).to.include('apikey=');
    });
  });

  describe('removePattern', () => {
    it('should remove a pattern by name', () => {
      dataFilter.addPattern('token', /github_pat_[A-Za-z0-9_]{36}/g);
      dataFilter.addPattern('password', 'password: [^\\s]+');
      
      const removed = dataFilter.removePattern('token');
      
      expect(removed).to.be.true;
      
      const patterns = dataFilter.getPatterns();
      expect(patterns).to.not.have.property('token');
      expect(patterns).to.have.property('password');
    });

    it('should return false if pattern not found', () => {
      const removed = dataFilter.removePattern('nonexistent');
      expect(removed).to.be.false;
    });
  });

  describe('filterContent', () => {
    beforeEach(() => {
      // Add various patterns for testing
      dataFilter.addPattern('token', /github_pat_[A-Za-z0-9_]{36}/g);
      dataFilter.addPattern('password', /password[:\s]+(["']?)[^\s\1]+\1/gi);
      dataFilter.addPattern('apiKey', /api[_\-]?key[:\s]+(["']?)[^\s\1]+\1/gi);
      dataFilter.addPattern('jwt', /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g);
    });

    it('should filter GitHub tokens from text', () => {
      const text = 'My GitHub token is github_pat_abcdef1234567890abcdef1234567890abcdef';
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).to.not.include('github_pat_abcdef1234567890abcdef1234567890abcdef');
      expect(filtered).to.include('[FILTERED:token]');
    });

    it('should filter passwords from text', () => {
      const text = `
      password: supersecret123
      username: developer
      password:"another-secret"
      `;
      
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).to.not.include('supersecret123');
      expect(filtered).to.not.include('another-secret');
      expect(filtered).to.include('[FILTERED:password]');
    });

    it('should filter API keys from text', () => {
      const text = `
      api_key: a1b2c3d4e5f6g7h8i9j0
      apikey: "xyz789abc123def456"
      API-KEY: 'mnopqrstuvwxyz1234'
      `;
      
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).to.not.include('a1b2c3d4e5f6g7h8i9j0');
      expect(filtered).to.not.include('xyz789abc123def456');
      expect(filtered).to.not.include('mnopqrstuvwxyz1234');
      expect(filtered).to.include('[FILTERED:apiKey]');
    });

    it('should filter JWTs from text', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const text = `Authorization: Bearer ${jwt}`;
      
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).to.not.include(jwt);
      expect(filtered).to.include('[FILTERED:jwt]');
    });

    it('should allow customizing replacement text', () => {
      const text = 'My GitHub token is github_pat_abcdef1234567890abcdef1234567890abcdef';
      const filtered = dataFilter.filterContent(text, '***REDACTED***');
      
      expect(filtered).to.not.include('github_pat_abcdef1234567890abcdef1234567890abcdef');
      expect(filtered).to.include('***REDACTED***');
    });

    it('should handle multiple sensitive data types in the same text', () => {
      const text = `
      This is a configuration file:
      username: developer
      password: supersecret123
      github_token: github_pat_abcdef1234567890abcdef1234567890abcdef
      api_key: a1b2c3d4e5f6g7h8i9j0
      Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
      `;
      
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).to.not.include('supersecret123');
      expect(filtered).to.not.include('github_pat_abcdef1234567890abcdef1234567890abcdef');
      expect(filtered).to.not.include('a1b2c3d4e5f6g7h8i9j0');
      expect(filtered).to.not.include('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      
      expect(filtered).to.include('[FILTERED:password]');
      expect(filtered).to.include('[FILTERED:token]');
      expect(filtered).to.include('[FILTERED:apiKey]');
      expect(filtered).to.include('[FILTERED:jwt]');
    });
  });

  describe('filterObject', () => {
    beforeEach(() => {
      // Add various patterns for testing
      dataFilter.addPatterns({
        'token': /github_pat_[A-Za-z0-9_]{36}/g,
        'password': /^password$/i,
        'secret': /^(secret|api[_-]?key)$/i
      });
    });

    it('should filter sensitive keys from an object', () => {
      const obj = {
        username: 'admin',
        password: 'supersecret123',
        email: 'admin@example.com',
        secret: 'very-sensitive-data',
        apiKey: 'a1b2c3d4e5f6'
      };
      
      const filtered = dataFilter.filterObject(obj);
      
      expect(filtered).to.have.property('username', 'admin');
      expect(filtered).to.have.property('email', 'admin@example.com');
      
      expect(filtered).to.have.property('password', '[FILTERED]');
      expect(filtered).to.have.property('secret', '[FILTERED]');
      expect(filtered).to.have.property('apiKey', '[FILTERED]');
    });

    it('should filter sensitive values in nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret123',
            token: 'github_pat_abcdef1234567890abcdef1234567890abcdef'
          }
        },
        settings: {
          apiKey: 'xyz789',
          theme: 'dark'
        }
      };
      
      const filtered = dataFilter.filterObject(obj);
      
      expect(filtered.user.name).to.equal('John');
      expect(filtered.settings.theme).to.equal('dark');
      
      expect(filtered.user.credentials.password).to.equal('[FILTERED]');
      expect(filtered.user.credentials.token).to.equal('[FILTERED]');
      expect(filtered.settings.apiKey).to.equal('[FILTERED]');
    });

    it('should filter values in arrays', () => {
      const obj = {
        users: [
          { name: 'Alice', password: 'pass1' },
          { name: 'Bob', password: 'pass2' },
          { name: 'Charlie', password: 'pass3' }
        ],
        tokens: [
          'github_pat_abcdef1234567890abcdef1234567890abcdef',
          'github_pat_uvwxyz7890123456uvwxyz7890123456uvwxyz'
        ]
      };
      
      const filtered = dataFilter.filterObject(obj);
      
      expect(filtered.users[0].name).to.equal('Alice');
      expect(filtered.users[0].password).to.equal('[FILTERED]');
      expect(filtered.users[1].password).to.equal('[FILTERED]');
      expect(filtered.users[2].password).to.equal('[FILTERED]');
      
      expect(filtered.tokens[0]).to.equal('[FILTERED]');
      expect(filtered.tokens[1]).to.equal('[FILTERED]');
    });

    it('should handle circular references safely', () => {
      const obj: any = {
        name: 'Circular Reference',
        password: 'circular123'
      };
      
      obj.self = obj; // Create circular reference
      
      const filtered = dataFilter.filterObject(obj);
      
      expect(filtered.name).to.equal('Circular Reference');
      expect(filtered.password).to.equal('[FILTERED]');
      expect(filtered.self).to.equal('[Circular]');
    });
  });

  describe('sanitizeForLog', () => {
    beforeEach(() => {
      dataFilter.addPatterns({
        'token': /github_pat_[A-Za-z0-9_]{36}/g,
        'password': /^password$/i,
        'apiKey': /^api[_-]?key$/i
      });
    });

    it('should sanitize objects for logging', () => {
      const logData = {
        action: 'login',
        user: 'admin',
        password: 'supersecret',
        token: 'github_pat_abcdef1234567890abcdef1234567890abcdef',
        timestamp: new Date().toISOString()
      };
      
      const sanitized = dataFilter.sanitizeForLog(logData);
      
      expect(sanitized.action).to.equal('login');
      expect(sanitized.user).to.equal('admin');
      expect(sanitized.timestamp).to.equal(logData.timestamp);
      
      expect(sanitized.password).to.equal('[FILTERED]');
      expect(sanitized.token).to.not.equal(logData.token);
    });

    it('should sanitize strings for logging', () => {
      const logMessage = 'User logged in with password: secret123 and token: github_pat_abcdef1234567890abcdef1234567890abcdef';
      
      const sanitized = dataFilter.sanitizeForLog(logMessage);
      
      expect(sanitized).to.not.include('secret123');
      expect(sanitized).to.not.include('github_pat_abcdef1234567890abcdef1234567890abcdef');
    });

    it('should handle arrays and complex structures', () => {
      const logData = [
        { user: 'user1', apiKey: 'secret1' },
        { user: 'user2', password: 'secret2' },
        'Token: github_pat_abcdef1234567890abcdef1234567890abcdef'
      ];
      
      const sanitized = dataFilter.sanitizeForLog(logData);
      
      expect(sanitized[0].user).to.equal('user1');
      expect(sanitized[0].apiKey).to.equal('[FILTERED]');
      expect(sanitized[1].password).to.equal('[FILTERED]');
      expect(sanitized[2]).to.not.include('github_pat_abcdef1234567890abcdef1234567890abcdef');
    });
  });
});