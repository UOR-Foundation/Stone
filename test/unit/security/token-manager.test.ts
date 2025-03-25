// Using Jest for testing
import sinon from 'sinon';
import { TokenManager } from '../../../src/security/token-manager';
import { FileSystemService } from '../../../src/services/filesystem-service';
import { LoggerService } from '../../../src/services/logger-service';

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let fsServiceStub: sinon.SinonStubbedInstance<FileSystemService>;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    fsServiceStub = sinon.createStubInstance(FileSystemService);
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };

    tokenManager = new TokenManager(fsServiceStub, loggerStub);
    
    // Mock the initialization of the TokenManager
    fsServiceStub.ensureDirectoryExists.resolves();
    fsServiceStub.fileExists.resolves(true);
    fsServiceStub.readFile.resolves('0'.repeat(64)); // Mock a valid hex master key
    
    // Initialize the TokenManager with a master key for testing
    // @ts-ignore - Accessing private property for testing
    tokenManager.masterKey = Buffer.from('0'.repeat(64), 'hex');
  });

  describe('storeToken', () => {
    it('should encrypt and store a token', async () => {
      fsServiceStub.writeFile.resolves();
      
      const token = 'github_pat_123456789';
      await tokenManager.storeToken(token, 'github');
      
      expect(fsServiceStub.writeFile.calledOnce).toBe(true);
      expect(fsServiceStub.writeFile.firstCall.args[0]).toContain('.stone/secure/github_token');
      // Check that it's not storing the raw token
      expect(fsServiceStub.writeFile.firstCall.args[1]).not.toContain(token);
    });

    it('should throw error if unable to store token', async () => {
      fsServiceStub.writeFile.rejects(new Error('Permission denied'));
      
      const token = 'github_pat_123456789';
      
      try {
        await tokenManager.storeToken(token, 'github');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Failed to store token');
      }
    });
  });

  describe('retrieveToken', () => {
    it('should retrieve and decrypt a token', async () => {
      const encryptedToken = tokenManager.encrypt('github_pat_123456789');
      fsServiceStub.readFile.resolves(encryptedToken);
      
      const token = await tokenManager.retrieveToken('github');
      
      expect(token).toEqual('github_pat_123456789');
      expect(fsServiceStub.readFile.calledOnce).toBe(true);
    });

    it('should throw error if token does not exist', async () => {
      // Set fileExists to return false to trigger the token not found error
      fsServiceStub.fileExists.resolves(false);
      
      try {
        await tokenManager.retrieveToken('github');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Token not found');
      }
    });
  });

  describe('rotateToken', () => {
    it('should rotate a token and return the new token', async () => {
      const oldToken = 'github_pat_old';
      const encryptedOldToken = tokenManager.encrypt(oldToken);
      
      fsServiceStub.readFile.resolves(encryptedOldToken);
      fsServiceStub.writeFile.resolves();
      
      const newToken = await tokenManager.rotateToken('github', (oldToken) => {
        // Simple rotation strategy for testing
        return Promise.resolve('github_pat_new');
      });
      
      expect(newToken).toEqual('github_pat_new');
      expect(fsServiceStub.readFile.calledOnce).toBe(true);
      expect(fsServiceStub.writeFile.calledOnce).toBe(true);
    });
  });

  describe('validateToken', () => {
    it('should return true for valid tokens', async () => {
      const token = 'github_pat_123456789';
      
      // Simulate a valid token check
      const validationFunction = sinon.stub().resolves(true);
      
      const isValid = await tokenManager.validateToken(token, validationFunction);
      
      expect(isValid).toBe(true);
      expect(validationFunction.calledOnce).toBe(true);
      expect(validationFunction.firstCall.args[0]).toEqual(token);
    });

    it('should return false for invalid tokens', async () => {
      const token = 'invalid_token';
      
      // Simulate an invalid token check
      const validationFunction = sinon.stub().resolves(false);
      
      const isValid = await tokenManager.validateToken(token, validationFunction);
      
      expect(isValid).toBe(false);
      expect(validationFunction.calledOnce).toBe(true);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt successfully', () => {
      const originalText = 'secret_data_to_encrypt';
      
      const encryptedText = tokenManager.encrypt(originalText);
      
      // Encrypted text should be different from original
      expect(encryptedText).not.toEqual(originalText);
      
      const decryptedText = tokenManager.decrypt(encryptedText);
      
      // Decrypted text should match the original
      expect(decryptedText).toEqual(originalText);
    });
  });
});