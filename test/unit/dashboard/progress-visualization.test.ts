import { ProgressVisualization, ProgressData } from '../../../src/dashboard/progress-visualization';
import { GitHubClient } from '../../../src/github/client';
import { ConfigLoader } from '../../../src/config/loader';
import { StatusDashboard } from '../../../src/dashboard/status-dashboard';

jest.mock('../../../src/github/client');
jest.mock('../../../src/config/loader');
jest.mock('../../../src/dashboard/status-dashboard');

describe('Progress Visualization', () => {
  let progressVisualization: ProgressVisualization;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;
  let mockStatusDashboard: jest.Mocked<StatusDashboard>;

  beforeEach(() => {
    mockGitHubClient = new GitHubClient('token', {} as any) as jest.Mocked<GitHubClient>;
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>;
    mockStatusDashboard = new StatusDashboard(mockGitHubClient, mockConfigLoader) as jest.Mocked<StatusDashboard>;
    
    // Mock config
    mockConfigLoader.getConfig = jest.fn().mockResolvedValue({
      workflow: {
        stages: ['stone', 'stone-qa', 'stone-feature-implement', 'stone-audit']
      }
    });
    
    progressVisualization = new ProgressVisualization(mockStatusDashboard, mockConfigLoader);
  });

  describe('generateProgressData', () => {
    it('should generate progress data for an issue', async () => {
      const issueNumber = 1;
      
      // Mock issue progress data
      mockStatusDashboard.getIssueProgress = jest.fn().mockResolvedValue({
        issue: {
          number: issueNumber,
          title: 'Test Issue',
          state: 'open'
        },
        timeline: [
          { event: 'labeled', created_at: '2023-01-01T01:00:00Z', label: { name: 'stone' } },
          { event: 'commented', created_at: '2023-01-01T02:00:00Z' },
          { event: 'labeled', created_at: '2023-01-01T03:00:00Z', label: { name: 'stone-qa' } }
        ],
        currentLabel: 'stone-qa',
        timeInCurrentStage: 48 * 60 * 60 * 1000 // 48 hours in ms
      });
      
      const progressData = await progressVisualization.generateProgressData(issueNumber);
      
      expect(progressData).toBeDefined();
      expect(progressData.issueNumber).toBe(issueNumber);
      expect(progressData.stages).toBeDefined();
      expect(progressData.stages.length).toBe(4); // All 4 workflow stages
      expect(progressData.currentStageIndex).toBe(1); // stone-qa is the current stage
      expect(progressData.completedStages).toBe(1); // Only 'stone' is completed
    });
  });

  describe('renderProgressBar', () => {
    it('should render a text-based progress bar', async () => {
      const progressData: ProgressData = {
        issueNumber: 1,
        title: 'Test Issue',
        stages: [
          { name: 'stone', label: 'Planning', completed: true, timeSpent: 24 * 60 * 60 * 1000 },
          { name: 'stone-qa', label: 'QA', completed: false, timeSpent: 48 * 60 * 60 * 1000, current: true },
          { name: 'stone-feature-implement', label: 'Implementation', completed: false },
          { name: 'stone-audit', label: 'Audit', completed: false }
        ],
        currentStageIndex: 1,
        completedStages: 1,
        totalStages: 4
      };
      
      const progressBar = progressVisualization.renderProgressBar(progressData);
      
      expect(progressBar).toBeDefined();
      expect(progressBar).toContain('Issue #1: Test Issue');
      expect(progressBar).toContain('['); // Start of progress bar
      expect(progressBar).toContain(']'); // End of progress bar
      expect(progressBar).toContain('Planning'); // First stage
      expect(progressBar).toContain('QA'); // Current stage
    });
  });

  describe('renderTimelineView', () => {
    it('should render a timeline view of issue progress', async () => {
      const issueNumber = 1;
      
      // Mock issue progress data
      mockStatusDashboard.getIssueProgress = jest.fn().mockResolvedValue({
        issue: {
          number: issueNumber,
          title: 'Test Issue',
          state: 'open',
          created_at: '2023-01-01T00:00:00Z'
        },
        timeline: [
          { event: 'labeled', created_at: '2023-01-01T01:00:00Z', label: { name: 'stone' } },
          { event: 'commented', created_at: '2023-01-01T02:00:00Z' },
          { event: 'labeled', created_at: '2023-01-03T00:00:00Z', label: { name: 'stone-qa' } }
        ],
        currentLabel: 'stone-qa',
        timeInCurrentStage: 48 * 60 * 60 * 1000 // 48 hours in ms
      });
      
      const timeline = await progressVisualization.renderTimelineView(issueNumber);
      
      expect(timeline).toBeDefined();
      expect(timeline).toContain('Issue #1: Test Issue - Timeline');
      expect(timeline).toContain('Created:'); // Creation date
      expect(timeline).toContain('Planning'); // First stage
      expect(timeline).toContain('QA'); // Second stage
    });
  });

  describe('generateWorkflowGraph', () => {
    it('should generate a text-based graph of the workflow', async () => {
      // Mock status data with label distribution
      mockStatusDashboard.getStatusData = jest.fn().mockResolvedValue({
        issues: { total: 10, open: 7, closed: 3 },
        pullRequests: { total: 5, open: 2, closed: 3 },
        labelDistribution: {
          'stone': 3,
          'stone-qa': 2,
          'stone-feature-implement': 4,
          'stone-audit': 1
        }
      });
      
      const graph = await progressVisualization.generateWorkflowGraph();
      
      expect(graph).toBeDefined();
      expect(graph).toContain('Workflow Status');
      expect(graph).toContain('Planning'); // First stage
      expect(graph).toContain('QA'); // Second stage
      expect(graph).toContain('Implementation'); // Third stage
      expect(graph).toContain('Audit'); // Fourth stage
    });
  });
});