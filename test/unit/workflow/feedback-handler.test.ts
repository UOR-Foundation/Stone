import { expect } from 'chai';
import sinon from 'sinon';
import { FeedbackHandler } from '../../../src/workflow/feedback-handler';
import { GithubService } from '../../../src/services/github-service';
import { LoggerService } from '../../../src/services/logger-service';

describe('FeedbackHandler', () => {
  let feedbackHandler: FeedbackHandler;
  let githubServiceStub: sinon.SinonStubbedInstance<GithubService>;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    githubServiceStub = sinon.createStubInstance(GithubService);
    loggerStub = sinon.createStubInstance(LoggerService);

    feedbackHandler = new FeedbackHandler(
      githubServiceStub as unknown as GithubService,
      loggerStub as unknown as LoggerService
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('analyzeFeedback', () => {
    it('should correctly analyze feedback from PR comments', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.getPullRequestComments.resolves([
        {
          id: 1,
          user: { login: 'user1' },
          body: 'This is great! However, I think we should optimize the performance of the filter function.',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          user: { login: 'user2' },
          body: 'We need to fix the bug in the authentication flow that allows users to bypass 2FA.',
          created_at: new Date().toISOString()
        },
        {
          id: 3,
          user: { login: 'user3' },
          body: 'Looks good to me!',
          created_at: new Date().toISOString()
        }
      ]);

      const result = await feedbackHandler.analyzeFeedback(prNumber, repoOwner, repoName);

      expect(result.actionItems).to.have.lengthOf(2);
      expect(result.actionItems[0].severity).to.equal('medium');
      expect(result.actionItems[1].severity).to.equal('high');
      expect(result.actionItems.some(item => item.description.includes('optimize the performance'))).to.be.true;
      expect(result.actionItems.some(item => item.description.includes('fix the bug'))).to.be.true;
    });

    it('should identify feedback severity correctly', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.getPullRequestComments.resolves([
        {
          id: 1,
          user: { login: 'user1' },
          body: 'CRITICAL: Security vulnerability in the auth module',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          user: { login: 'user2' },
          body: 'Minor typo in the documentation',
          created_at: new Date().toISOString()
        }
      ]);

      const result = await feedbackHandler.analyzeFeedback(prNumber, repoOwner, repoName);

      expect(result.actionItems).to.have.lengthOf(2);
      expect(result.actionItems[0].severity).to.equal('critical');
      expect(result.actionItems[1].severity).to.equal('low');
    });

    it('should handle empty or no actionable feedback', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.getPullRequestComments.resolves([
        {
          id: 1,
          user: { login: 'user1' },
          body: 'LGTM!',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          user: { login: 'user2' },
          body: 'Approved',
          created_at: new Date().toISOString()
        }
      ]);

      const result = await feedbackHandler.analyzeFeedback(prNumber, repoOwner, repoName);

      expect(result.actionItems).to.be.empty;
      expect(result.summary).to.include('No actionable feedback');
    });

    it('should handle errors during feedback analysis', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      const errorMessage = 'Failed to fetch PR comments';
      
      githubServiceStub.getPullRequestComments.rejects(new Error(errorMessage));

      try {
        await feedbackHandler.analyzeFeedback(prNumber, repoOwner, repoName);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('createFeedbackIssues', () => {
    it('should create issues from feedback action items', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const prNumber = 123;
      const actionItems = [
        {
          id: '1',
          description: 'Optimize the performance of the filter function',
          severity: 'medium',
          author: 'user1',
          affectedArea: 'performance',
          sourceComment: 1
        },
        {
          id: '2',
          description: 'Fix the bug in the authentication flow',
          severity: 'high',
          author: 'user2',
          affectedArea: 'security',
          sourceComment: 2
        }
      ];

      githubServiceStub.createIssue.onFirstCall().resolves({ number: 456 });
      githubServiceStub.createIssue.onSecondCall().resolves({ number: 457 });

      const result = await feedbackHandler.createFeedbackIssues(
        actionItems,
        prNumber,
        repoOwner,
        repoName
      );

      expect(result.createdIssues).to.have.lengthOf(2);
      expect(result.createdIssues[0].issueNumber).to.equal(456);
      expect(result.createdIssues[1].issueNumber).to.equal(457);
      expect(githubServiceStub.createIssue.calledTwice).to.be.true;
      expect(githubServiceStub.addLabelToIssue.calledWith(456, repoOwner, repoName, 'stone-feedback')).to.be.true;
      expect(githubServiceStub.addLabelToIssue.calledWith(457, repoOwner, repoName, 'stone-feedback')).to.be.true;
    });

    it('should handle empty action items list', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const prNumber = 123;
      const actionItems: any[] = [];

      const result = await feedbackHandler.createFeedbackIssues(
        actionItems,
        prNumber,
        repoOwner,
        repoName
      );

      expect(result.createdIssues).to.be.empty;
      expect(githubServiceStub.createIssue.notCalled).to.be.true;
    });

    it('should handle errors when creating issues', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const prNumber = 123;
      const actionItems = [
        {
          id: '1',
          description: 'Optimize the performance of the filter function',
          severity: 'medium',
          author: 'user1',
          affectedArea: 'performance',
          sourceComment: 1
        }
      ];
      const errorMessage = 'Failed to create issue';

      githubServiceStub.createIssue.rejects(new Error(errorMessage));

      try {
        await feedbackHandler.createFeedbackIssues(
          actionItems,
          prNumber,
          repoOwner,
          repoName
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('routeFeedbackToTeams', () => {
    it('should correctly route feedback to appropriate teams', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const issueNumbers = [456, 457];
      const actionItems = [
        {
          id: '1',
          description: 'Optimize the performance of the filter function',
          severity: 'medium',
          author: 'user1',
          affectedArea: 'performance',
          sourceComment: 1
        },
        {
          id: '2',
          description: 'Fix the bug in the authentication flow',
          severity: 'high',
          author: 'user2',
          affectedArea: 'security',
          sourceComment: 2
        }
      ];

      const teamMappings = {
        performance: 'performance-team',
        security: 'security-team',
        default: 'core-team'
      };

      const result = await feedbackHandler.routeFeedbackToTeams(
        actionItems,
        issueNumbers,
        repoOwner,
        repoName,
        teamMappings
      );

      expect(result.routedIssues).to.have.lengthOf(2);
      expect(result.routedIssues[0].team).to.equal('performance-team');
      expect(result.routedIssues[1].team).to.equal('security-team');
      expect(githubServiceStub.assignIssueToTeam.calledTwice).to.be.true;
    });

    it('should use default team when no specific mapping exists', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const issueNumbers = [456];
      const actionItems = [
        {
          id: '1',
          description: 'Update the documentation',
          severity: 'low',
          author: 'user1',
          affectedArea: 'docs',
          sourceComment: 1
        }
      ];

      const teamMappings = {
        performance: 'performance-team',
        security: 'security-team',
        default: 'core-team'
      };

      const result = await feedbackHandler.routeFeedbackToTeams(
        actionItems,
        issueNumbers,
        repoOwner,
        repoName,
        teamMappings
      );

      expect(result.routedIssues).to.have.lengthOf(1);
      expect(result.routedIssues[0].team).to.equal('core-team');
      expect(githubServiceStub.assignIssueToTeam.calledOnce).to.be.true;
    });

    it('should handle errors when routing feedback', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const issueNumbers = [456];
      const actionItems = [
        {
          id: '1',
          description: 'Optimize the performance of the filter function',
          severity: 'medium',
          author: 'user1',
          affectedArea: 'performance',
          sourceComment: 1
        }
      ];
      const teamMappings = {
        performance: 'performance-team',
        default: 'core-team'
      };
      const errorMessage = 'Failed to assign issue to team';

      githubServiceStub.assignIssueToTeam.rejects(new Error(errorMessage));

      try {
        await feedbackHandler.routeFeedbackToTeams(
          actionItems,
          issueNumbers,
          repoOwner,
          repoName,
          teamMappings
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('prioritizeFeedback', () => {
    it('should correctly prioritize feedback based on severity', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const issueNumbers = [456, 457, 458, 459];
      const actionItems = [
        {
          id: '1',
          description: 'Minor typo in documentation',
          severity: 'low',
          author: 'user1',
          affectedArea: 'docs',
          sourceComment: 1
        },
        {
          id: '2',
          description: 'Performance optimization needed',
          severity: 'medium',
          author: 'user2',
          affectedArea: 'performance',
          sourceComment: 2
        },
        {
          id: '3',
          description: 'Bug in authentication flow',
          severity: 'high',
          author: 'user3',
          affectedArea: 'security',
          sourceComment: 3
        },
        {
          id: '4',
          description: 'Critical security vulnerability',
          severity: 'critical',
          author: 'user4',
          affectedArea: 'security',
          sourceComment: 4
        }
      ];

      const result = await feedbackHandler.prioritizeFeedback(
        actionItems,
        issueNumbers,
        repoOwner,
        repoName
      );

      expect(result.prioritizedIssues).to.have.lengthOf(4);
      // Check that they are ordered by severity (critical first, low last)
      expect(result.prioritizedIssues[0].issueNumber).to.equal(459);
      expect(result.prioritizedIssues[0].priority).to.equal('P0');
      expect(result.prioritizedIssues[1].issueNumber).to.equal(458);
      expect(result.prioritizedIssues[1].priority).to.equal('P1');
      expect(result.prioritizedIssues[2].issueNumber).to.equal(457);
      expect(result.prioritizedIssues[2].priority).to.equal('P2');
      expect(result.prioritizedIssues[3].issueNumber).to.equal(456);
      expect(result.prioritizedIssues[3].priority).to.equal('P3');
    });

    it('should handle empty action items list', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const issueNumbers: number[] = [];
      const actionItems: any[] = [];

      const result = await feedbackHandler.prioritizeFeedback(
        actionItems,
        issueNumbers,
        repoOwner,
        repoName
      );

      expect(result.prioritizedIssues).to.be.empty;
    });

    it('should handle errors when prioritizing feedback', async () => {
      const repoOwner = 'owner';
      const repoName = 'repo';
      const issueNumbers = [456];
      const actionItems = [
        {
          id: '1',
          description: 'Critical security vulnerability',
          severity: 'critical',
          author: 'user1',
          affectedArea: 'security',
          sourceComment: 1
        }
      ];
      const errorMessage = 'Failed to update issue priority';

      githubServiceStub.addLabelToIssue.rejects(new Error(errorMessage));

      try {
        await feedbackHandler.prioritizeFeedback(
          actionItems,
          issueNumbers,
          repoOwner,
          repoName
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });
});