import { expect } from 'chai';
import { describe, it } from 'mocha';
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
  });

  describe('storeToken', () => {
    it('should encrypt and store a token', async () => {
      fsServiceStub.writeFile.resolves();
      
      const token = 'github_pat_123456789';
      await tokenManager.storeToken(token, 'github');
      
      expect(fsServiceStub.writeFile.calledOnce).to.be.true;
      expect(fsServiceStub.writeFile.firstCall.args[0]).to.include('.stone/secure/github_token');
      // Check that it's not storing the raw token
      expect(fsServiceStub.writeFile.firstCall.args[1]).to.not.include(token);
    });

    it('should throw error if unable to store token', async () => {
      fsServiceStub.writeFile.rejects(new Error('Permission denied'));
      
      const token = 'github_pat_123456789';
      
      try {
        await tokenManager.storeToken(token, 'github');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to store token');
      }
    });
  });

  describe('retrieveToken', () => {
    it('should retrieve and decrypt a token', async () => {
      const encryptedToken = tokenManager.encrypt('github_pat_123456789');
      fsServiceStub.readFile.resolves(encryptedToken);
      
      const token = await tokenManager.retrieveToken('github');
      
      expect(token).to.equal('github_pat_123456789');
      expect(fsServiceStub.readFile.calledOnce).to.be.true;
    });

    it('should throw error if token does not exist', async () => {
      fsServiceStub.readFile.rejects(new Error('File not found'));
      
      try {
        await tokenManager.retrieveToken('github');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Token not found');
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
      
      expect(newToken).to.equal('github_pat_new');
      expect(fsServiceStub.readFile.calledOnce).to.be.true;
      expect(fsServiceStub.writeFile.calledOnce).to.be.true;
    });
  });

  describe('validateToken', () => {
    it('should return true for valid tokens', async () => {
      const token = 'github_pat_123456789';
      
      // Simulate a valid token check
      const validationFunction = sinon.stub().resolves(true);
      
      const isValid = await tokenManager.validateToken(token, validationFunction);
      
      expect(isValid).to.be.true;
      expect(validationFunction.calledOnce).to.be.true;
      expect(validationFunction.firstCall.args[0]).to.equal(token);
    });

    it('should return false for invalid tokens', async () => {
      const token = 'invalid_token';
      
      // Simulate an invalid token check
      const validationFunction = sinon.stub().resolves(false);
      
      const isValid = await tokenManager.validateToken(token, validationFunction);
      
      expect(isValid).to.be.false;
      expect(validationFunction.calledOnce).to.be.true;
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt successfully', () => {
      const originalText = 'secret_data_to_encrypt';
      
      const encryptedText = tokenManager.encrypt(originalText);
      
      // Encrypted text should be different from original
      expect(encryptedText).to.not.equal(originalText);
      
      const decryptedText = tokenManager.decrypt(encryptedText);
      
      // Decrypted text should match the original
      expect(decryptedText).to.equal(originalText);
    });
  });
});