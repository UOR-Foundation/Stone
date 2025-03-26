import { PerformanceAnalytics, PerformanceReport } from '../../../src/dashboard/performance-analytics';
import { GitHubClient } from '../../../src/github/client';
import { ConfigLoader } from '../../../src/config/loader';
import { StatusDashboard } from '../../../src/dashboard/status-dashboard';

jest.mock('../../../src/github/client');
jest.mock('../../../src/config/loader');
jest.mock('../../../src/dashboard/status-dashboard');

describe('Performance Analytics', () => {
  let performanceAnalytics: PerformanceAnalytics;
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
    
    performanceAnalytics = new PerformanceAnalytics(mockStatusDashboard, mockGitHubClient, mockConfigLoader);
  });

  describe('analyzeCompletionTrends', () => {
    it('should analyze completion trends over time', async () => {
      // Mock closed issues with timeline data
      mockGitHubClient.listIssues = jest.fn().mockResolvedValue([
        { number: 1, state: 'closed', closed_at: '2023-01-05T00:00:00Z', created_at: '2023-01-01T00:00:00Z' },
        { number: 2, state: 'closed', closed_at: '2023-01-10T00:00:00Z', created_at: '2023-01-02T00:00:00Z' },
        { number: 3, state: 'closed', closed_at: '2023-01-15T00:00:00Z', created_at: '2023-01-03T00:00:00Z' },
        { number: 4, state: 'closed', closed_at: '2023-01-20T00:00:00Z', created_at: '2023-01-04T00:00:00Z' }
      ]);
      
      const trends = await performanceAnalytics.analyzeCompletionTrends();
      
      expect(trends).toBeDefined();
      expect(trends.weeklyCompletionRate).toBeDefined();
      expect(trends.averageTimeToCompletionTrend).toBeDefined();
      expect(trends.weeklyCompletionRate.length).toBeGreaterThan(0);
      expect(trends.averageTimeToCompletionTrend.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeUserProductivity', () => {
    it('should analyze productivity by user', async () => {
      // Mock issues with assignees
      mockGitHubClient.listIssues = jest.fn().mockResolvedValue([
        { 
          number: 1, 
          state: 'closed', 
          closed_at: '2023-01-05T00:00:00Z', 
          created_at: '2023-01-01T00:00:00Z',
          assignees: [{ login: 'user1' }]
        },
        { 
          number: 2, 
          state: 'closed', 
          closed_at: '2023-01-10T00:00:00Z', 
          created_at: '2023-01-05T00:00:00Z',
          assignees: [{ login: 'user1' }]
        },
        { 
          number: 3, 
          state: 'closed', 
          closed_at: '2023-01-15T00:00:00Z', 
          created_at: '2023-01-10T00:00:00Z',
          assignees: [{ login: 'user2' }]
        }
      ]);
      
      const productivityData = await performanceAnalytics.analyzeUserProductivity();
      
      expect(productivityData).toBeDefined();
      expect(productivityData.userStats).toBeDefined();
      expect(productivityData.userStats['user1']).toBeDefined();
      expect(productivityData.userStats['user2']).toBeDefined();
      expect(productivityData.userStats['user1'].issuesCompleted).toBe(2);
      expect(productivityData.userStats['user2'].issuesCompleted).toBe(1);
    });
  });

  describe('analyzeStageEfficiency', () => {
    it('should analyze efficiency of each workflow stage', async () => {
      // Mock performance metrics
      mockStatusDashboard.getPerformanceMetrics = jest.fn().mockResolvedValue({
        averageTimeToCompletion: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        stageMetrics: {
          'stone': { 
            averageTime: 1 * 24 * 60 * 60 * 1000, // 1 day
            minTime: 0.5 * 24 * 60 * 60 * 1000,
            maxTime: 2 * 24 * 60 * 60 * 1000
          },
          'stone-qa': { 
            averageTime: 2 * 24 * 60 * 60 * 1000, // 2 days
            minTime: 1 * 24 * 60 * 60 * 1000,
            maxTime: 3 * 24 * 60 * 60 * 1000
          },
          'stone-feature-implement': { 
            averageTime: 3 * 24 * 60 * 60 * 1000, // 3 days
            minTime: 2 * 24 * 60 * 60 * 1000,
            maxTime: 5 * 24 * 60 * 60 * 1000
          },
          'stone-audit': { 
            averageTime: 1 * 24 * 60 * 60 * 1000, // 1 day
            minTime: 0.5 * 24 * 60 * 60 * 1000,
            maxTime: 2 * 24 * 60 * 60 * 1000
          }
        }
      });
      
      const efficiencyData = await performanceAnalytics.analyzeStageEfficiency();
      
      expect(efficiencyData).toBeDefined();
      expect(efficiencyData.stageEfficiency).toBeDefined();
      expect(efficiencyData.stageEfficiency['stone']).toBeDefined();
      expect(efficiencyData.stageEfficiency['stone-qa']).toBeDefined();
      expect(efficiencyData.stageEfficiency['stone-feature-implement']).toBeDefined();
      expect(efficiencyData.stageEfficiency['stone-audit']).toBeDefined();
      expect(efficiencyData.stageEfficiency['stone-feature-implement'].percentOfTotal).toBeCloseTo(3/7 * 100);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate a comprehensive performance report', async () => {
      // Mock all the analytics methods
      performanceAnalytics.analyzeCompletionTrends = jest.fn().mockResolvedValue({
        weeklyCompletionRate: [
          { week: '2023-01-01', count: 1 },
          { week: '2023-01-08', count: 2 }
        ],
        averageTimeToCompletionTrend: [
          { week: '2023-01-01', averageDays: 5 },
          { week: '2023-01-08', averageDays: 4 }
        ]
      });
      
      performanceAnalytics.analyzeUserProductivity = jest.fn().mockResolvedValue({
        userStats: {
          'user1': { issuesCompleted: 2, averageTimeToCompletion: 5 * 24 * 60 * 60 * 1000 },
          'user2': { issuesCompleted: 1, averageTimeToCompletion: 4 * 24 * 60 * 60 * 1000 }
        }
      });
      
      performanceAnalytics.analyzeStageEfficiency = jest.fn().mockResolvedValue({
        stageEfficiency: {
          'stone': { percentOfTotal: 14.3, efficiency: 'high' },
          'stone-qa': { percentOfTotal: 28.6, efficiency: 'medium' },
          'stone-feature-implement': { percentOfTotal: 42.9, efficiency: 'low' },
          'stone-audit': { percentOfTotal: 14.3, efficiency: 'high' }
        }
      });
      
      mockStatusDashboard.identifyBottlenecks = jest.fn().mockResolvedValue([
        { stage: 'stone-feature-implement', averageTime: 3 * 24 * 60 * 60 * 1000, impact: 0.6 }
      ]);
      
      const report = await performanceAnalytics.generatePerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.completionTrends).toBeDefined();
      expect(report.userProductivity).toBeDefined();
      expect(report.stageEfficiency).toBeDefined();
      expect(report.bottlenecks).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('renderPerformanceReport', () => {
    it('should render a human-readable performance report', async () => {
      // Mock the report generation
      const mockReport: PerformanceReport = {
        completionTrends: {
          weeklyCompletionRate: [
            { week: '2023-01-01', count: 1 },
            { week: '2023-01-08', count: 2 }
          ],
          averageTimeToCompletionTrend: [
            { week: '2023-01-01', averageDays: 5 },
            { week: '2023-01-08', averageDays: 4 }
          ]
        },
        userProductivity: {
          userStats: {
            'user1': { issuesCompleted: 2, averageTimeToCompletion: 5 * 24 * 60 * 60 * 1000 },
            'user2': { issuesCompleted: 1, averageTimeToCompletion: 4 * 24 * 60 * 60 * 1000 }
          }
        },
        stageEfficiency: {
          stageEfficiency: {
            'stone': { percentOfTotal: 14.3, efficiency: 'high' },
            'stone-qa': { percentOfTotal: 28.6, efficiency: 'medium' },
            'stone-feature-implement': { percentOfTotal: 42.9, efficiency: 'low' },
            'stone-audit': { percentOfTotal: 14.3, efficiency: 'high' }
          }
        },
        bottlenecks: [
          { stage: 'stone-feature-implement', averageTime: 3 * 24 * 60 * 60 * 1000, impact: 0.6 }
        ],
        recommendations: [
          'Focus on improving the Implementation stage to reduce bottlenecks',
          'Consider redistributing workload among team members'
        ]
      };
      
      performanceAnalytics.generatePerformanceReport = jest.fn().mockResolvedValue(mockReport);
      
      const reportText = await performanceAnalytics.renderPerformanceReport();
      
      expect(reportText).toBeDefined();
      expect(reportText).toContain('Performance Report');
      expect(reportText).toContain('Completion Trends');
      expect(reportText).toContain('User Productivity');
      expect(reportText).toContain('Stage Efficiency');
      expect(reportText).toContain('Bottlenecks');
      expect(reportText).toContain('Recommendations');
    });
  });
});