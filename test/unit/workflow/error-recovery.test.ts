import { expect } from 'chai';
import sinon from 'sinon';
import { ErrorRecovery } from '../../../src/workflow/error-recovery';
import { FileSystemService } from '../../../src/services/filesystem-service';
import { GithubService } from '../../../src/services/github-service';
import { LoggerService } from '../../../src/services/logger-service';
import { NotificationService } from '../../../src/services/notification-service';

describe('ErrorRecovery', () => {
  let errorRecovery: ErrorRecovery;
  let fsServiceStub: sinon.SinonStubbedInstance<FileSystemService>;
  let githubServiceStub: sinon.SinonStubbedInstance<GithubService>;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;
  let notificationServiceStub: sinon.SinonStubbedInstance<NotificationService>;

  beforeEach(() => {
    fsServiceStub = sinon.createStubInstance(FileSystemService);
    githubServiceStub = sinon.createStubInstance(GithubService);
    loggerStub = sinon.createStubInstance(LoggerService);
    notificationServiceStub = sinon.createStubInstance(NotificationService);

    errorRecovery = new ErrorRecovery(
      fsServiceStub as unknown as FileSystemService,
      githubServiceStub as unknown as GithubService,
      loggerStub as unknown as LoggerService,
      notificationServiceStub as unknown as NotificationService
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('captureErrorState', () => {
    it('should save error state to disk', async () => {
      const workflowId = 'workflow-123';
      const error = new Error('Test error');
      const context = {
        issueNumber: 456,
        repoOwner: 'owner',
        repoName: 'repo',
        currentStep: 'feature-implementation',
        stepData: { key: 'value' }
      };
      
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.writeFile.resolves();

      const errorState = await errorRecovery.captureErrorState(workflowId, error, context);

      expect(errorState.id).to.equal(workflowId);
      expect(errorState.error.message).to.equal('Test error');
      expect(errorState.context).to.deep.equal(context);
      expect(errorState.timestamp).to.be.a('number');
      expect(errorState.recoveryAttempts).to.equal(0);
      expect(fsServiceStub.ensureDirectoryExists.calledOnce).to.be.true;
      expect(fsServiceStub.writeFile.calledOnce).to.be.true;
      expect(loggerStub.error.calledOnce).to.be.true;
    });

    it('should handle errors during state saving', async () => {
      const workflowId = 'workflow-123';
      const error = new Error('Test error');
      const context = {
        issueNumber: 456,
        repoOwner: 'owner',
        repoName: 'repo',
        currentStep: 'feature-implementation'
      };
      const saveError = new Error('Failed to write error state');
      
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.writeFile.rejects(saveError);

      try {
        await errorRecovery.captureErrorState(workflowId, error, context);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('Failed to write error state');
        expect(loggerStub.error.calledTwice).to.be.true;
      }
    });
  });

  describe('getErrorState', () => {
    it('should retrieve error state from disk', async () => {
      const workflowId = 'workflow-123';
      const errorState = {
        id: workflowId,
        error: { name: 'Error', message: 'Test error' },
        context: {
          issueNumber: 456,
          repoOwner: 'owner',
          repoName: 'repo',
          currentStep: 'feature-implementation'
        },
        timestamp: Date.now(),
        recoveryAttempts: 1
      };
      
      fsServiceStub.readFile.resolves(JSON.stringify(errorState));

      const result = await errorRecovery.getErrorState(workflowId);

      expect(result).to.deep.equal(errorState);
      expect(fsServiceStub.readFile.calledOnce).to.be.true;
    });

    it('should handle missing error state file', async () => {
      const workflowId = 'workflow-123';
      
      fsServiceStub.readFile.rejects(new Error('File not found'));

      const result = await errorRecovery.getErrorState(workflowId);

      expect(result).to.be.null;
      expect(loggerStub.warn.calledOnce).to.be.true;
    });
  });

  describe('attemptRecovery', () => {
    it('should attempt simple recovery on first try', async () => {
      const errorState = {
        id: 'workflow-123',
        error: { name: 'Error', message: 'API rate limit exceeded' },
        context: {
          issueNumber: 456,
          repoOwner: 'owner',
          repoName: 'repo',
          currentStep: 'feature-implementation'
        },
        timestamp: Date.now() - 60000, // 1 minute ago
        recoveryAttempts: 0
      };
      
      fsServiceStub.readFile.resolves(JSON.stringify(errorState));
      fsServiceStub.writeFile.resolves();

      const result = await errorRecovery.attemptRecovery('workflow-123');

      expect(result.success).to.be.true;
      expect(result.recoveryStrategy).to.equal('simple-retry');
      expect(fsServiceStub.writeFile.calledOnce).to.be.true;
      expect(loggerStub.info.calledWith(sinon.match(/Attempting simple recovery/))).to.be.true;
    });

    it('should attempt advanced recovery on second try', async () => {
      const errorState = {
        id: 'workflow-123',
        error: { name: 'Error', message: 'API rate limit exceeded' },
        context: {
          issueNumber: 456,
          repoOwner: 'owner',
          repoName: 'repo',
          currentStep: 'feature-implementation'
        },
        timestamp: Date.now() - 300000, // 5 minutes ago
        recoveryAttempts: 1
      };
      
      fsServiceStub.readFile.resolves(JSON.stringify(errorState));
      fsServiceStub.writeFile.resolves();
      githubServiceStub.getWorkflowStatus.resolves('completed');

      const result = await errorRecovery.attemptRecovery('workflow-123');

      expect(result.success).to.be.true;
      expect(result.recoveryStrategy).to.equal('advanced-retry');
      expect(fsServiceStub.writeFile.calledOnce).to.be.true;
      expect(githubServiceStub.getWorkflowStatus.calledOnce).to.be.true;
      expect(loggerStub.info.calledWith(sinon.match(/Attempting advanced recovery/))).to.be.true;
    });

    it('should notify team on third try', async () => {
      const errorState = {
        id: 'workflow-123',
        error: { name: 'Error', message: 'API rate limit exceeded' },
        context: {
          issueNumber: 456,
          repoOwner: 'owner',
          repoName: 'repo',
          currentStep: 'feature-implementation'
        },
        timestamp: Date.now() - 900000, // 15 minutes ago
        recoveryAttempts: 2
      };
      
      fsServiceStub.readFile.resolves(JSON.stringify(errorState));
      fsServiceStub.writeFile.resolves();
      githubServiceStub.commentOnIssue.resolves();
      notificationServiceStub.sendAlert.resolves();

      const result = await errorRecovery.attemptRecovery('workflow-123');

      expect(result.success).to.be.false;
      expect(result.recoveryStrategy).to.equal('team-notification');
      expect(githubServiceStub.commentOnIssue.calledOnce).to.be.true;
      expect(notificationServiceStub.sendAlert.calledOnce).to.be.true;
      expect(loggerStub.warn.calledWith(sinon.match(/Recovery failed after multiple attempts/))).to.be.true;
    });

    it('should handle permanent errors appropriately', async () => {
      const errorState = {
        id: 'workflow-123',
        error: { name: 'Error', message: 'Permission denied' },
        context: {
          issueNumber: 456,
          repoOwner: 'owner',
          repoName: 'repo',
          currentStep: 'feature-implementation'
        },
        timestamp: Date.now() - 60000, // 1 minute ago
        recoveryAttempts: 0
      };
      
      fsServiceStub.readFile.resolves(JSON.stringify(errorState));
      fsServiceStub.writeFile.resolves();
      githubServiceStub.commentOnIssue.resolves();
      notificationServiceStub.sendAlert.resolves();

      const result = await errorRecovery.attemptRecovery('workflow-123');

      expect(result.success).to.be.false;
      expect(result.recoveryStrategy).to.equal('team-notification');
      expect(githubServiceStub.commentOnIssue.calledOnce).to.be.true;
      expect(notificationServiceStub.sendAlert.calledOnce).to.be.true;
      expect(loggerStub.error.calledWith(sinon.match(/Permanent error detected/))).to.be.true;
    });

    it('should handle non-existent error state', async () => {
      fsServiceStub.readFile.rejects(new Error('File not found'));

      const result = await errorRecovery.attemptRecovery('workflow-123');

      expect(result.success).to.be.false;
      expect(result.recoveryStrategy).to.equal('none');
      expect(result.message).to.include('No error state found');
    });
  });

  describe('clearErrorState', () => {
    it('should remove error state file when recovery is successful', async () => {
      const workflowId = 'workflow-123';
      
      fsServiceStub.deleteFile.resolves();

      await errorRecovery.clearErrorState(workflowId);

      expect(fsServiceStub.deleteFile.calledOnce).to.be.true;
      expect(loggerStub.info.calledWith(sinon.match(/Cleared error state/))).to.be.true;
    });

    it('should handle errors during file deletion', async () => {
      const workflowId = 'workflow-123';
      const deleteError = new Error('Failed to delete file');
      
      fsServiceStub.deleteFile.rejects(deleteError);

      try {
        await errorRecovery.clearErrorState(workflowId);
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('Failed to delete file');
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('isRecoverable', () => {
    it('should identify temporary errors as recoverable', () => {
      const temporaryErrors = [
        new Error('API rate limit exceeded'),
        new Error('Network timeout'),
        new Error('Server temporarily unavailable'),
        new Error('Too many requests'),
        new Error('Connection reset')
      ];

      temporaryErrors.forEach(error => {
        expect(errorRecovery.isRecoverable(error)).to.be.true;
      });
    });

    it('should identify permanent errors as non-recoverable', () => {
      const permanentErrors = [
        new Error('Permission denied'),
        new Error('Resource not found'),
        new Error('Invalid token'),
        new Error('Authentication failed'),
        new Error('Validation error')
      ];

      permanentErrors.forEach(error => {
        expect(errorRecovery.isRecoverable(error)).to.be.false;
      });
    });
  });
});