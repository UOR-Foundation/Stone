import { SecretRedaction } from '../../../src/security/secret-redaction';
import { LoggerService } from '../../../src/services/logger-service';
import fs from 'fs';
import path from 'path';

jest.mock('../../../src/services/logger-service');

describe('SecretRedaction', () => {
  let secretRedaction: SecretRedaction;
  let mockLogger: jest.Mocked<LoggerService>;
  let fixtureContent: string;
  
  beforeEach(() => {
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    secretRedaction = new SecretRedaction(mockLogger);
    
    const fixturePath = path.join(__dirname, '../../fixtures/fake-secrets.txt');
    fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
  });
  
  describe('redact', () => {
    it('should redact API keys and tokens', () => {
      const input = 'api_key="abcdef1234567890abcdef1234567890"';
      const redacted = secretRedaction.redact(input);
      
      expect(redacted).toContain('***REDACTED***');
      expect(redacted).not.toContain('abcdef1234567890abcdef1234567890');
    });
    
    it('should redact GitHub tokens', () => {
      const input = 'ghp_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t';
      const redacted = secretRedaction.redact(input);
      
      expect(redacted).toBe('***REDACTED***');
    });
    
    it('should redact AWS access keys', () => {
      const input = 'AKIAIOSFODNN7EXAMPLE';
      const redacted = secretRedaction.redact(input);
      
      expect(redacted).toBe('***REDACTED***');
    });
    
    it('should redact private keys', () => {
      const input = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1DSF5QDn\n-----END RSA PRIVATE KEY-----';
      const redacted = secretRedaction.redact(input);
      
      expect(redacted).toBe('***REDACTED***');
    });
    
    it('should not redact non-secret content', () => {
      const input = 'regular_text = "This is just regular text"';
      const redacted = secretRedaction.redact(input);
      
      expect(redacted).toBe(input);
    });
    
    it('should handle errors gracefully', () => {
      const badPattern = {
        test: jest.fn().mockReturnValue(true),
        lastIndex: 0,
        toString: () => 'mock-pattern',
        [Symbol.match]: () => { throw new Error('Regex error'); },
        [Symbol.replace]: () => { throw new Error('Regex error'); }
      } as unknown as RegExp;
      
      const originalPatterns = secretRedaction['patterns'];
      secretRedaction['patterns'] = [badPattern];
      
      try {
        const input = 'Some text with a secret';
        const redacted = secretRedaction.redact(input);
        
        expect(redacted).toBe('***ERROR REDACTING CONTENT***');
        expect(mockLogger.error).toHaveBeenCalled();
      } finally {
        secretRedaction['patterns'] = originalPatterns;
      }
    });
    
    it('should redact all secrets in the fixture file', () => {
      const redacted = secretRedaction.redact(fixtureContent);
      
      expect(redacted).not.toContain('abcdef1234567890abcdef1234567890');
      expect(redacted).not.toContain('ghp_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t');
      expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(redacted).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
      
      expect(redacted).toContain('regular_text = "This is just regular text"');
      expect(redacted).toContain('short_key = "abc123"');
      expect(redacted).toContain('version = "1.2.3"');
    });
  });
  
  describe('containsSecrets', () => {
    it('should detect API keys and tokens', () => {
      const input = 'api_key="abcdef1234567890abcdef1234567890"';
      expect(secretRedaction.containsSecrets(input)).toBe(true);
    });
    
    it('should detect GitHub tokens', () => {
      const input = 'ghp_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t';
      expect(secretRedaction.containsSecrets(input)).toBe(true);
    });
    
    it('should not detect non-secret content', () => {
      const input = 'regular_text = "This is just regular text"';
      expect(secretRedaction.containsSecrets(input)).toBe(false);
    });
    
    it('should handle errors gracefully', () => {
      const badPattern = {
        test: jest.fn().mockImplementation(() => { throw new Error('Regex error'); }),
        lastIndex: 0
      } as unknown as RegExp;
      
      secretRedaction['patterns'] = [badPattern];
      
      const input = 'Some text with a secret';
      const result = secretRedaction.containsSecrets(input);
      
      expect(result).toBe(true); // Assume there might be secrets on error
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  describe('pattern management', () => {
    it('should add a custom pattern', () => {
      const initialPatternCount = secretRedaction.getPatterns().length;
      secretRedaction.addPattern(/custom-pattern-\d+/g);
      
      expect(secretRedaction.getPatterns().length).toBe(initialPatternCount + 1);
      
      const input = 'custom-pattern-12345';
      expect(secretRedaction.containsSecrets(input)).toBe(true);
      
      const redacted = secretRedaction.redact(input);
      expect(redacted).toBe('***REDACTED***');
    });
    
    it('should remove a pattern', () => {
      const initialPatternCount = secretRedaction.getPatterns().length;
      
      const result = secretRedaction.removePattern(0);
      
      expect(result).toBe(true);
      expect(secretRedaction.getPatterns().length).toBe(initialPatternCount - 1);
    });
    
    it('should handle invalid pattern index', () => {
      const initialPatternCount = secretRedaction.getPatterns().length;
      
      const result = secretRedaction.removePattern(999);
      
      expect(result).toBe(false);
      expect(secretRedaction.getPatterns().length).toBe(initialPatternCount);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
  
  describe('high entropy detection', () => {
    it('should detect high entropy strings', () => {
      secretRedaction.addPattern(/[a-zA-Z0-9]{40,}/g);
      
      const input = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0';
      expect(secretRedaction.containsSecrets(input)).toBe(true);
      
      const redacted = secretRedaction.redact(input);
      expect(redacted).toBe('***REDACTED***');
    });
  });
});
