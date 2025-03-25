import { ErrorRecovery } from '../../../src/workflow/error-recovery';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';
import { LoggerService } from '../../../src/services/logger-service';

// Mock dependencies
jest.mock('../../../src/github/client');
jest.mock('../../../src/services/logger-service');

describe('ErrorRecovery', () => {
  let errorRecovery: ErrorRecovery;
  let mockClient: jest.Mocked<GitHubClient>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfig: StoneConfig;
  
  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      repository: {
        owner: 'test-owner',
        name: 'test-repo',
      },
      workflow: {
        stoneLabel: 'stone-process',
        issueTemplate: 'feature_request.md',
      },
      github: {
        issueTemplateDirectory: '.github/ISSUE_TEMPLATE',
      },
      errorRecovery: {
        retryAttempts: 3,
        notifyOnError: true,
        errorTypes: {
          api: 'API error',
          network: 'Network error',
          validation: 'Validation error'
        }
      }
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    
    // Setup mock logger
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.debug = jest.fn();
    
    // Create the error recovery instance
    errorRecovery = new ErrorRecovery(mockClient, mockConfig, mockLogger);
  });
  
  describe('handleWorkflowError', () => {
    it('should handle workflow errors and apply appropriate labels', async () => {
      // Call the method with an error
      const error = new Error('API rate limit exceeded');
      await errorRecovery.handleWorkflowError('pm', 123, error);
      
      // Verify error handling
      expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(123, ['stone-error']);
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Error in pm workflow')
      );
    });
    
    it('should implement recovery mechanism based on workflow type', async () => {
      // Call the method with a PM workflow error
      const error = new Error('Failed to generate Gherkin spec');
      await errorRecovery.handleWorkflowError('pm', 123, error);
      
      // Verify PM-specific recovery
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Error in pm workflow')
      );
      
      // Check that the error was logged appropriately
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  describe('recoverWorkflow', () => {
    it('should implement recovery mechanisms for different workflow types', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          body: 'Test body',
          labels: [
            { name: 'stone-error' },
            { name: 'stone-pm' }
          ]
        }
      });
      
      // Call the method
      await errorRecovery.recoverWorkflow('pm', 123);
      
      // Verify recovery mechanism
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Recovery process initiated')
      );
      expect(mockClient.removeLabelFromIssue).toHaveBeenCalledWith(
        123,
        'stone-error'
      );
    });
  });
  
  describe('buildErrorNotification', () => {
    it('should build error notifications with appropriate details', async () => {
      // Define error
      const error = new Error('API error: rate limit exceeded');
      
      // Call the method
      const notification = errorRecovery.buildErrorNotification('feature', 123, error);
      
      // Verify notification content
      expect(notification).toContain('Error in feature workflow');
      expect(notification).toContain('API error: rate limit exceeded');
      expect(notification).toContain('The system will attempt to recover');
    });
  });
  
  describe('createManualInterventionTool', () => {
    it('should create manual intervention tools when needed', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          body: 'Test body',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Call the method
      await errorRecovery.createManualInterventionTool(123, 'feature', 'API error: authentication failed');
      
      // Verify intervention tool creation
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Manual Intervention Required')
      );
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Error Details')
      );
      expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
        123, 
        expect.arrayContaining(['stone-manual-intervention'])
      );
    });
  });
});