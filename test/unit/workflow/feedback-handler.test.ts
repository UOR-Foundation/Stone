import { FeedbackHandler } from '../../../src/workflow/feedback-handler';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';
import { LoggerService } from '../../../src/services/logger-service';

// Mock dependencies
jest.mock('../../../src/github/client');
jest.mock('../../../src/services/logger-service');

describe('FeedbackHandler', () => {
  let feedbackHandler: FeedbackHandler;
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
      feedback: {
        priorityLabels: {
          high: 'priority-high',
          medium: 'priority-medium',
          low: 'priority-low'
        },
        categories: ['bug', 'enhancement', 'question']
      }
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    mockClient.createPullRequest = jest.fn();
    
    // Mock octokit methods
    mockClient.octokit = {
      rest: {
        issues: {
          listComments: jest.fn(),
          create: jest.fn()
        },
        pulls: {
          list: jest.fn(),
          listComments: jest.fn()
        }
      }
    };
    
    // Setup mock logger
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.debug = jest.fn();
    
    // Create the feedback handler instance
    feedbackHandler = new FeedbackHandler(mockClient, mockConfig, mockLogger);
  });
  
  describe('analyzePRComments', () => {
    it('should analyze PR comments and identify feedback', async () => {
      // Mock PR data
      const prNumber = 10;
      const comments = [
        { body: 'Great job!', user: { login: 'user1' } },
        { body: 'I found a bug: when clicking the button, it shows an error', user: { login: 'user2' } },
        { body: 'Can you add better error handling?', user: { login: 'user3' } }
      ];
      
      // Mock PR comments
      mockClient.octokit.rest.pulls.listComments.mockResolvedValue({ data: comments });
      
      // Call the method
      const feedback = await feedbackHandler.analyzePRComments(prNumber);
      
      // Verify feedback analysis
      expect(feedback.length).toBeGreaterThan(0);
      expect(feedback[0].type).toBeDefined();
      expect(feedback[0].content).toBeDefined();
      expect(feedback[0].author).toBeDefined();
    });
  });
  
  describe('generateFeedbackIssue', () => {
    it('should generate an issue from feedback', async () => {
      // Mock feedback items
      const feedback = [
        { type: 'bug', content: 'Error when clicking button', author: 'user1', priority: 'high' }
      ];
      
      // Mock issue creation
      mockClient.octokit.rest.issues.create.mockResolvedValue({
        data: { number: 11, html_url: 'https://github.com/test-owner/test-repo/issues/11' }
      });
      
      // Call the method
      const issueNumber = await feedbackHandler.generateFeedbackIssue(feedback, 10);
      
      // Verify issue generation
      expect(issueNumber).toBe(11);
      expect(mockClient.octokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          title: expect.stringContaining('Feedback'),
          body: expect.stringContaining('Error when clicking button')
        })
      );
    });
  });
  
  describe('routeFeedback', () => {
    it('should route feedback to appropriate teams based on content', async () => {
      // Mock feedback
      const feedbackIssueNumber = 11;
      const feedback = [
        { type: 'bug', content: 'UI rendering issue', author: 'user1', priority: 'high' }
      ];
      
      // Mock config with teams
      mockConfig.teams = [
        { name: 'UI Team', areas: ['ui', 'interface', 'rendering'] },
        { name: 'Backend Team', areas: ['api', 'database', 'server'] }
      ];
      
      // Call the method
      await feedbackHandler.routeFeedback(feedbackIssueNumber, feedback);
      
      // Verify feedback routing
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        feedbackIssueNumber,
        expect.stringContaining('has been routed')
      );
    });
  });
  
  describe('prioritizeFeedback', () => {
    it('should prioritize feedback based on content and source', async () => {
      // Mock feedback
      const feedback = [
        { type: 'bug', content: 'Critical error in payment processing', author: 'user1', priority: 'unset' }
      ];
      
      // Call the method
      const prioritizedFeedback = feedbackHandler.prioritizeFeedback(feedback);
      
      // Verify feedback prioritization
      expect(prioritizedFeedback[0].priority).not.toBe('unset');
      expect(prioritizedFeedback[0].priority).toBeDefined();
    });
  });
  
  describe('processFeedback', () => {
    it('should process feedback from pull request comments', async () => {
      // Mock PR for issue
      const issueNumber = 1;
      const prNumber = 10;
      
      // Mock getIssue response
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: issueNumber,
          title: 'Test Issue',
          body: 'Test body',
          labels: [{ name: 'stone-feedback' }]
        }
      });
      
      // Mock search for PRs
      mockClient.octokit = {
        rest: {
          search: {
            issuesAndPullRequests: jest.fn().mockResolvedValue({
              data: {
                items: [{
                  number: prNumber,
                  pull_request: { url: 'https://github.com/test-owner/test-repo/pulls/10' }
                }]
              }
            })
          },
          pulls: {
            list: jest.fn().mockResolvedValue({
              data: [{
                number: prNumber,
                html_url: 'https://github.com/test-owner/test-repo/pull/10'
              }]
            }),
            listComments: jest.fn().mockResolvedValue({
              data: [{
                body: 'I found a bug: when clicking the button, it shows an error',
                user: { login: 'user2' }
              }]
            })
          },
          issues: {
            create: jest.fn().mockResolvedValue({
              data: { number: 11, html_url: 'https://github.com/test-owner/test-repo/issues/11' }
            })
          }
        }
      };
      
      // Call the method
      await feedbackHandler.processFeedback(issueNumber);
      
      // Verify end-to-end feedback processing
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        issueNumber,
        expect.stringContaining('Feedback processing complete')
      );
    });
  });
});