import { StatusDashboard, StatusData, IssueStatus } from '../../../src/dashboard/status-dashboard';
import { GitHubClient } from '../../../src/github/client';
import { ConfigLoader } from '../../../src/config/loader';

jest.mock('../../../src/github/client');
jest.mock('../../../src/config/loader');

describe('Status Dashboard', () => {
  let statusDashboard: StatusDashboard;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;

  beforeEach(() => {
    mockGitHubClient = new GitHubClient('token', {} as any) as jest.Mocked<GitHubClient>;
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>;
    
    // Mock the config loader
    mockConfigLoader.getConfig = jest.fn().mockResolvedValue({
      repository: {
        owner: 'test-owner',
        name: 'test-repo'
      },
      workflow: {
        stoneLabel: 'stone'
      }
    });
    
    statusDashboard = new StatusDashboard(mockGitHubClient, mockConfigLoader);
  });

  describe('getStatusData', () => {
    it('should fetch and aggregate status data', async () => {
      // Mock GitHub API responses
      mockGitHubClient.listIssues = jest.fn().mockResolvedValue({
        data: [
          { number: 1, title: 'Issue 1', labels: [{ name: 'stone' }], state: 'open' },
          { number: 2, title: 'Issue 2', labels: [{ name: 'stone-qa' }], state: 'open' },
          { number: 3, title: 'Issue 3', labels: [{ name: 'stone-feature-implement' }], state: 'closed' }
        ]
      });
      
      mockGitHubClient.listPullRequests = jest.fn().mockResolvedValue({
        data: [
          { number: 10, title: 'PR 1', state: 'open', labels: [] },
          { number: 11, title: 'PR 2', state: 'closed', labels: [] }
        ]
      });
      
      const statusData = await statusDashboard.getStatusData();
      
      expect(statusData).toBeDefined();
      expect(statusData.issues.total).toBe(3);
      expect(statusData.issues.open).toBe(2);
      expect(statusData.issues.closed).toBe(1);
      expect(statusData.pullRequests.total).toBe(2);
      expect(statusData.pullRequests.open).toBe(1);
      expect(statusData.pullRequests.closed).toBe(1);
      
      // Verify the label distribution
      expect(statusData.labelDistribution['stone']).toBe(1);
      expect(statusData.labelDistribution['stone-qa']).toBe(1);
      expect(statusData.labelDistribution['stone-feature-implement']).toBe(1);
    });
  });

  describe('getIssueProgress', () => {
    it('should get progress information for a specific issue', async () => {
      const issueNumber = 1;
      
      // Mock issue data
      mockGitHubClient.getIssue = jest.fn().mockResolvedValue({
        number: issueNumber,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        labels: [{ name: 'stone' }]
      });
      
      // Mock timeline data
      mockGitHubClient.getIssueTimeline = jest.fn().mockResolvedValue([
        { event: 'labeled', created_at: '2023-01-01T01:00:00Z', label: { name: 'stone' } },
        { event: 'commented', created_at: '2023-01-01T02:00:00Z' },
        { event: 'labeled', created_at: '2023-01-01T03:00:00Z', label: { name: 'stone-qa' } }
      ]);
      
      const progress = await statusDashboard.getIssueProgress(issueNumber);
      
      expect(progress).toBeDefined();
      expect(progress.issue.number).toBe(issueNumber);
      expect(progress.timeline).toHaveLength(3);
      expect(progress.currentLabel).toBe('stone-qa');
      expect(progress.timeInCurrentStage).toBeDefined();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance metrics for the workflow', async () => {
      // Mock closed issues with timeline data
      mockGitHubClient.listIssues = jest.fn().mockResolvedValue({
        data: [
          { number: 1, state: 'closed', closed_at: '2023-01-05T00:00:00Z', created_at: '2023-01-01T00:00:00Z' },
          { number: 2, state: 'closed', closed_at: '2023-01-10T00:00:00Z', created_at: '2023-01-02T00:00:00Z' }
        ]
      });
      
      // Mock timeline data for each issue
      mockGitHubClient.getIssueTimeline = jest.fn()
        .mockResolvedValueOnce([
          { event: 'labeled', created_at: '2023-01-01T01:00:00Z', label: { name: 'stone' } },
          { event: 'labeled', created_at: '2023-01-02T00:00:00Z', label: { name: 'stone-qa' } },
          { event: 'labeled', created_at: '2023-01-03T00:00:00Z', label: { name: 'stone-feature-implement' } },
          { event: 'labeled', created_at: '2023-01-04T00:00:00Z', label: { name: 'stone-audit' } },
          { event: 'closed', created_at: '2023-01-05T00:00:00Z' }
        ])
        .mockResolvedValueOnce([
          { event: 'labeled', created_at: '2023-01-02T01:00:00Z', label: { name: 'stone' } },
          { event: 'labeled', created_at: '2023-01-04T00:00:00Z', label: { name: 'stone-qa' } },
          { event: 'labeled', created_at: '2023-01-06T00:00:00Z', label: { name: 'stone-feature-implement' } },
          { event: 'labeled', created_at: '2023-01-08T00:00:00Z', label: { name: 'stone-audit' } },
          { event: 'closed', created_at: '2023-01-10T00:00:00Z' }
        ]);
      
      const metrics = await statusDashboard.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.averageTimeToCompletion).toBeDefined();
      expect(metrics.stageMetrics).toBeDefined();
      expect(metrics.stageMetrics['stone']).toBeDefined();
      expect(metrics.stageMetrics['stone-qa']).toBeDefined();
      expect(metrics.stageMetrics['stone-feature-implement']).toBeDefined();
      expect(metrics.stageMetrics['stone-audit']).toBeDefined();
    });
  });

  describe('identifyBottlenecks', () => {
    it('should identify workflow bottlenecks based on performance metrics', async () => {
      // Mock performance metrics
      statusDashboard.getPerformanceMetrics = jest.fn().mockResolvedValue({
        averageTimeToCompletion: 5 * 24 * 60 * 60 * 1000, // 5 days in ms
        stageMetrics: {
          'stone': { averageTime: 0.5 * 24 * 60 * 60 * 1000 }, // 0.5 days
          'stone-qa': { averageTime: 1 * 24 * 60 * 60 * 1000 }, // 1 day
          'stone-feature-implement': { averageTime: 3 * 24 * 60 * 60 * 1000 }, // 3 days (bottleneck)
          'stone-audit': { averageTime: 0.5 * 24 * 60 * 60 * 1000 } // 0.5 days
        }
      });
      
      const bottlenecks = await statusDashboard.identifyBottlenecks();
      
      expect(bottlenecks).toBeDefined();
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].stage).toBe('stone-feature-implement');
    });
  });

  describe('renderStatusDashboard', () => {
    it('should render status dashboard as text', async () => {
      // Mock status data
      statusDashboard.getStatusData = jest.fn().mockResolvedValue({
        issues: { total: 10, open: 7, closed: 3 },
        pullRequests: { total: 5, open: 2, closed: 3 },
        labelDistribution: {
          'stone': 3,
          'stone-qa': 2,
          'stone-feature-implement': 4,
          'stone-audit': 1
        }
      });
      
      // Mock performance metrics
      statusDashboard.getPerformanceMetrics = jest.fn().mockResolvedValue({
        averageTimeToCompletion: 5 * 24 * 60 * 60 * 1000, // 5 days in ms
        stageMetrics: {
          'stone': { averageTime: 0.5 * 24 * 60 * 60 * 1000 }, // 0.5 days
          'stone-qa': { averageTime: 1 * 24 * 60 * 60 * 1000 }, // 1 day
          'stone-feature-implement': { averageTime: 3 * 24 * 60 * 60 * 1000 }, // 3 days
          'stone-audit': { averageTime: 0.5 * 24 * 60 * 60 * 1000 } // 0.5 days
        }
      });
      
      // Mock bottlenecks
      statusDashboard.identifyBottlenecks = jest.fn().mockResolvedValue([
        { stage: 'stone-feature-implement', averageTime: 3 * 24 * 60 * 60 * 1000, impact: 0.6 }
      ]);
      
      const dashboardText = await statusDashboard.renderStatusDashboard();
      
      expect(dashboardText).toBeDefined();
      expect(dashboardText).toContain('STONE STATUS DASHBOARD');
      expect(dashboardText).toContain('ISSUES');
      expect(dashboardText).toContain('PULL REQUESTS');
      expect(dashboardText).toContain('PERFORMANCE METRICS');
      expect(dashboardText).toContain('BOTTLENECKS');
    });
  });
});