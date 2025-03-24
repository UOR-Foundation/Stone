import { IssueProcessor } from '../../../src/workflow/issue-processor';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';

// Mock GitHub client
jest.mock('../../../src/github/client');

describe('IssueProcessor', () => {
  let issueProcessor: IssueProcessor;
  let mockClient: jest.Mocked<GitHubClient>;
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
      packages: [{
        name: 'core',
        path: 'src/core',
        team: 'core-team'
      }]
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    
    // Create the processor instance
    issueProcessor = new IssueProcessor(mockClient, mockConfig);
  });
  
  describe('processIssue', () => {
    it('should process a new issue with stone-process label', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Test Issue',
          body: 'Test body',
          labels: [{ name: 'stone-process' }]
        }
      });
      
      // Call the method
      const result = await issueProcessor.processIssue(1);
      
      // Verify correct processing
      expect(result).toBe('pm');
      // The code now adds several comments including workflow started and Gherkin spec
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1, 
        expect.stringContaining('Stone Workflow Started')
      );
      expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(1, ['stone-pm']);
    });
    
    it('should process an issue in QA stage', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Test Issue',
          body: 'Test body',
          labels: [{ name: 'stone-qa' }]
        }
      });
      
      // Call the method
      const result = await issueProcessor.processIssue(1);
      
      // Verify correct processing
      expect(result).toBe('qa');
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Generating test files')
      );
    });

    it('should process an issue for feature implementation', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Test Issue',
          body: 'Test body',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Call the method
      const result = await issueProcessor.processIssue(1);
      
      // Verify correct processing
      expect(result).toBe('feature');
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Implementing feature')
      );
    });

    it('should track issue history', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Test Issue',
          body: 'Test body',
          labels: [{ name: 'stone-process' }]
        }
      });
      
      // Call the method
      await issueProcessor.processIssue(1);
      
      // Verify history tracking
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Workflow Stage: PM')
      );
    });
  });
  
  describe('generateGherkinSpec', () => {
    it('should generate Gherkin specifications for a feature', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Add user authentication',
          body: 'We need to add user authentication to the application',
          labels: [{ name: 'stone-process' }]
        }
      });
      
      // Call the method
      await issueProcessor.generateGherkinSpec(1);
      
      // Verify Gherkin generation
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Feature: Add user authentication')
      );
    });
  });
});