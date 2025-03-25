// Using Jest for testing
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
      expect(patterns).toHaveProperty('token');
      expect(patterns.token).toBeInstanceOf(RegExp);
    });

    it('should add a string pattern to filter', () => {
      dataFilter.addPattern('password', 'password: [^\\s]+');
      
      const patterns = dataFilter.getPatterns();
      expect(patterns).toHaveProperty('password');
      expect(patterns.password).toBeInstanceOf(RegExp);
    });

    it('should override existing pattern with same name', () => {
      dataFilter.addPattern('key', /api_key: [A-Za-z0-9]{32}/g);
      dataFilter.addPattern('key', /apikey=[A-Za-z0-9]{32}/g);
      
      const patterns = dataFilter.getPatterns();
      expect(patterns.key.toString()).toContain('apikey=');
    });
  });

  describe('removePattern', () => {
    it('should remove a pattern by name', () => {
      dataFilter.addPattern('token', /github_pat_[A-Za-z0-9_]{36}/g);
      dataFilter.addPattern('password', 'password: [^\\s]+');
      
      const removed = dataFilter.removePattern('token');
      
      expect(removed).toBe(true);
      
      const patterns = dataFilter.getPatterns();
      expect(patterns).not.toHaveProperty('token');
      expect(patterns).toHaveProperty('password');
    });

    it('should return false if pattern not found', () => {
      const removed = dataFilter.removePattern('nonexistent');
      expect(removed).toBe(false);
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
      
      expect(filtered).not.toContain('github_pat_abcdef1234567890abcdef1234567890abcdef');
      expect(filtered).toContain('[FILTERED:github-token]');
    });

    it('should filter passwords from text', () => {
      const text = `
      password: supersecret123
      username: developer
      password:"another-secret"
      `;
      
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).not.toContain('supersecret123');
      expect(filtered).not.toContain('another-secret');
      expect(filtered).toContain('[FILTERED:password]');
    });

    it('should filter API keys from text', () => {
      const text = `
      api_key: a1b2c3d4e5f6g7h8i9j0
      apikey: "xyz789abc123def456"
      API-KEY: 'mnopqrstuvwxyz1234'
      `;
      
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).not.toContain('a1b2c3d4e5f6g7h8i9j0');
      expect(filtered).not.toContain('xyz789abc123def456');
      expect(filtered).not.toContain('mnopqrstuvwxyz1234');
      expect(filtered).toContain('[FILTERED:apiKey]');
    });

    it('should filter JWTs from text', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const text = `Authorization: Bearer ${jwt}`;
      
      const filtered = dataFilter.filterContent(text);
      
      expect(filtered).not.toContain(jwt);
      expect(filtered).toContain('[FILTERED:jwt]');
    });

    it('should allow customizing replacement text', () => {
      const text = 'My GitHub token is github_pat_abcdef1234567890abcdef1234567890abcdef';
      const filtered = dataFilter.filterContent(text, '***REDACTED***');
      
      expect(filtered).not.toContain('github_pat_abcdef1234567890abcdef1234567890abcdef');
      expect(filtered).toContain('***REDACTED***');
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
      
      expect(filtered).not.toContain('supersecret123');
      expect(filtered).not.toContain('github_pat_abcdef1234567890abcdef1234567890abcdef');
      expect(filtered).not.toContain('a1b2c3d4e5f6g7h8i9j0');
      expect(filtered).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      
      expect(filtered).toContain('[FILTERED:password]');
      expect(filtered).toContain('[FILTERED:github-token]');
      expect(filtered).toContain('[FILTERED:apiKey]');
      expect(filtered).toContain('[FILTERED:jwt]');
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
      
      expect(filtered).toHaveProperty('username', 'admin');
      expect(filtered).toHaveProperty('email', 'admin@example.com');
      
      expect(filtered).toHaveProperty('password', '[FILTERED]');
      expect(filtered).toHaveProperty('secret', '[FILTERED]');
      expect(filtered).toHaveProperty('apiKey', '[FILTERED]');
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
      
      expect(filtered.user.name).toEqual('John');
      expect(filtered.settings.theme).toEqual('dark');
      
      expect(filtered.user.credentials.password).toEqual('[FILTERED]');
      // The token is filtered by the 'github-token' pattern which keeps part of the token
      expect(filtered.user.credentials.token).toContain('[FILTERED]');
      expect(filtered.settings.apiKey).toEqual('[FILTERED]');
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
      
      expect(filtered.users[0].name).toEqual('Alice');
      expect(filtered.users[0].password).toEqual('[FILTERED]');
      expect(filtered.users[1].password).toEqual('[FILTERED]');
      expect(filtered.users[2].password).toEqual('[FILTERED]');
      
      expect(filtered.tokens[0]).toContain('[FILTERED]');
      expect(filtered.tokens[1]).toContain('[FILTERED]');
    });

    it('should handle circular references safely', () => {
      const obj: any = {
        name: 'Circular Reference',
        password: 'circular123'
      };
      
      obj.self = obj; // Create circular reference
      
      const filtered = dataFilter.filterObject(obj);
      
      expect(filtered.name).toEqual('Circular Reference');
      expect(filtered.password).toEqual('[FILTERED]');
      expect(filtered.self).toEqual('[Circular]');
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
      
      expect(sanitized.action).toEqual('login');
      expect(sanitized.user).toEqual('admin');
      expect(sanitized.timestamp).toEqual(logData.timestamp);
      
      expect(sanitized.password).toEqual('[FILTERED]');
      expect(sanitized.token).not.toEqual(logData.token);
    });

    it('should sanitize strings for logging', () => {
      const logMessage = 'User logged in with password: secret123 and token: github_pat_abcdef1234567890abcdef1234567890abcdef';
      
      const sanitized = dataFilter.sanitizeForLog(logMessage);
      
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('github_pat_abcdef1234567890abcdef1234567890abcdef');
    });

    it('should handle arrays and complex structures', () => {
      const logData = [
        { user: 'user1', apiKey: 'secret1' },
        { user: 'user2', password: 'secret2' },
        'Token: github_pat_abcdef1234567890abcdef1234567890abcdef'
      ];
      
      const sanitized = dataFilter.sanitizeForLog(logData);
      
      expect(sanitized[0].user).toEqual('user1');
      expect(sanitized[0].apiKey).toEqual('[FILTERED]');
      expect(sanitized[1].password).toEqual('[FILTERED]');
      expect(sanitized[2]).not.toContain('github_pat_abcdef1234567890abcdef1234567890abcdef');
    });
  });
});