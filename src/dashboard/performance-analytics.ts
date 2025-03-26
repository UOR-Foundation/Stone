import { StatusDashboard, PerformanceMetrics, WorkflowBottleneck } from './status-dashboard';
import { GitHubClient } from '../github/client';
import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';

/**
 * Interface for completion trend data point
 */
export interface CompletionTrendPoint {
  week: string;
  count: number;
}

/**
 * Interface for average time trend data point
 */
export interface AverageTimeTrendPoint {
  week: string;
  averageDays: number;
}

/**
 * Interface for completion trends
 */
export interface CompletionTrends {
  weeklyCompletionRate: CompletionTrendPoint[];
  averageTimeToCompletionTrend: AverageTimeTrendPoint[];
}

/**
 * Interface for user productivity stats
 */
export interface UserProductivityStats {
  issuesCompleted: number;
  averageTimeToCompletion: number;
}

/**
 * Interface for user productivity data
 */
export interface UserProductivityData {
  userStats: Record<string, UserProductivityStats>;
}

/**
 * Interface for stage efficiency data
 */
export interface StageEfficiencyData {
  percentOfTotal: number;
  efficiency: 'high' | 'medium' | 'low';
}

/**
 * Interface for stage efficiency
 */
export interface StageEfficiency {
  stageEfficiency: Record<string, StageEfficiencyData>;
}

/**
 * Interface for performance report
 */
export interface PerformanceReport {
  completionTrends: CompletionTrends;
  userProductivity: UserProductivityData;
  stageEfficiency: StageEfficiency;
  bottlenecks: WorkflowBottleneck[];
  recommendations: string[];
}

/**
 * Class for analyzing performance metrics
 */
export class PerformanceAnalytics {
  private statusDashboard: StatusDashboard;
  private githubClient: GitHubClient;
  private configLoader: ConfigLoader;
  private logger: Logger;

  constructor(
    statusDashboard: StatusDashboard,
    githubClient: GitHubClient,
    configLoader: ConfigLoader
  ) {
    this.statusDashboard = statusDashboard;
    this.githubClient = githubClient;
    this.configLoader = configLoader;
    this.logger = new Logger();
  }

  /**
   * Analyze completion trends over time
   */
  public async analyzeCompletionTrends(): Promise<CompletionTrends> {
    this.logger.info('Analyzing completion trends...');
    
    // Fetch closed issues
    const closedIssuesResponse = await this.githubClient.listIssues('closed');
    const closedIssues = closedIssuesResponse.data || [];
    
    // Group by week
    const weeklyData: Record<string, { count: number, times: number[] }> = {};
    
    for (const issue of closedIssues) {
      const createdAt = new Date(issue.created_at);
      const closedAt = new Date(issue.closed_at as string);
      
      // Calculate completion time in days
      const completionTimeMs = closedAt.getTime() - createdAt.getTime();
      const completionTimeDays = completionTimeMs / (1000 * 60 * 60 * 24);
      
      // Get week of closure (YYYY-MM-DD format of the Monday)
      const weekStart = this.getWeekStart(closedAt);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      // Add to weekly data
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { count: 0, times: [] };
      }
      
      weeklyData[weekKey].count++;
      weeklyData[weekKey].times.push(completionTimeDays);
    }
    
    // Convert to arrays for return
    const weeklyCompletionRate: CompletionTrendPoint[] = [];
    const averageTimeToCompletionTrend: AverageTimeTrendPoint[] = [];
    
    for (const [week, data] of Object.entries(weeklyData)) {
      weeklyCompletionRate.push({
        week,
        count: data.count
      });
      
      // Calculate average time for this week
      const totalTime = data.times.reduce((sum, time) => sum + time, 0);
      const averageTime = data.times.length > 0 ? totalTime / data.times.length : 0;
      
      averageTimeToCompletionTrend.push({
        week,
        averageDays: Math.round(averageTime * 10) / 10 // Round to 1 decimal place
      });
    }
    
    // Sort by week
    weeklyCompletionRate.sort((a, b) => a.week.localeCompare(b.week));
    averageTimeToCompletionTrend.sort((a, b) => a.week.localeCompare(b.week));
    
    return {
      weeklyCompletionRate,
      averageTimeToCompletionTrend
    };
  }

  /**
   * Analyze productivity by user
   */
  public async analyzeUserProductivity(): Promise<UserProductivityData> {
    this.logger.info('Analyzing user productivity...');
    
    // Fetch closed issues
    const closedIssuesResponse = await this.githubClient.listIssues('closed');
    const closedIssues = closedIssuesResponse.data || [];
    
    // Group by assignee
    const userStats: Record<string, UserProductivityStats> = {};
    
    for (const issue of closedIssues) {
      // Skip issues without assignees
      if (!issue.assignees || issue.assignees.length === 0) {
        continue;
      }
      
      const createdAt = new Date(issue.created_at);
      const closedAt = new Date(issue.closed_at as string);
      
      // Calculate completion time
      const completionTimeMs = closedAt.getTime() - createdAt.getTime();
      
      // Add to user stats for each assignee
      for (const assignee of issue.assignees) {
        const login = assignee.login;
        
        if (!userStats[login]) {
          userStats[login] = {
            issuesCompleted: 0,
            averageTimeToCompletion: 0
          };
        }
        
        // Update user stats
        const currentStats = userStats[login];
        const totalTimeMs = currentStats.averageTimeToCompletion * currentStats.issuesCompleted;
        
        currentStats.issuesCompleted++;
        currentStats.averageTimeToCompletion = 
          (totalTimeMs + completionTimeMs) / currentStats.issuesCompleted;
      }
    }
    
    return { userStats };
  }

  /**
   * Analyze efficiency of each workflow stage
   */
  public async analyzeStageEfficiency(): Promise<StageEfficiency> {
    this.logger.info('Analyzing stage efficiency...');
    
    // Get performance metrics
    const metrics = await this.statusDashboard.getPerformanceMetrics();
    
    // Calculate efficiency for each stage
    const stageEfficiency: Record<string, StageEfficiencyData> = {};
    
    for (const [stage, stageMetrics] of Object.entries(metrics.stageMetrics)) {
      // Calculate percentage of total time
      const percentOfTotal = 
        (stageMetrics.averageTime / metrics.averageTimeToCompletion) * 100;
      
      // Determine efficiency level
      let efficiency: 'high' | 'medium' | 'low';
      
      if (percentOfTotal < 20) {
        efficiency = 'high';
      } else if (percentOfTotal < 40) {
        efficiency = 'medium';
      } else {
        efficiency = 'low';
      }
      
      stageEfficiency[stage] = {
        percentOfTotal: Math.round(percentOfTotal * 10) / 10, // Round to 1 decimal place
        efficiency
      };
    }
    
    return { stageEfficiency };
  }

  /**
   * Generate a comprehensive performance report
   */
  public async generatePerformanceReport(): Promise<PerformanceReport> {
    this.logger.info('Generating performance report...');
    
    // Get all necessary data
    const completionTrends = await this.analyzeCompletionTrends();
    const userProductivity = await this.analyzeUserProductivity();
    const stageEfficiency = await this.analyzeStageEfficiency();
    const bottlenecks = await this.statusDashboard.identifyBottlenecks();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      stageEfficiency,
      bottlenecks,
      completionTrends
    );
    
    return {
      completionTrends,
      userProductivity,
      stageEfficiency,
      bottlenecks,
      recommendations
    };
  }

  /**
   * Render a human-readable performance report
   */
  public async renderPerformanceReport(): Promise<string> {
    this.logger.info('Rendering performance report...');
    
    const report = await this.generatePerformanceReport();
    
    // Create report sections
    const sections: string[] = [];
    
    // Header
    sections.push('========================================');
    sections.push('           PERFORMANCE REPORT           ');
    sections.push('========================================');
    sections.push('');
    
    // Completion Trends
    sections.push('COMPLETION TRENDS:');
    
    if (report.completionTrends.weeklyCompletionRate.length > 0) {
      sections.push('  Weekly Completion Rate:');
      for (const point of report.completionTrends.weeklyCompletionRate) {
        sections.push(`    ${point.week}: ${point.count} issues`);
      }
      
      sections.push('  Average Time to Completion Trend:');
      for (const point of report.completionTrends.averageTimeToCompletionTrend) {
        sections.push(`    ${point.week}: ${point.averageDays} days`);
      }
    } else {
      sections.push('  No trend data available yet.');
    }
    
    sections.push('');
    
    // User Productivity
    sections.push('USER PRODUCTIVITY:');
    
    const users = Object.entries(report.userProductivity.userStats);
    if (users.length > 0) {
      for (const [user, stats] of users) {
        sections.push(`  ${user}:`);
        sections.push(`    Issues Completed: ${stats.issuesCompleted}`);
        sections.push(`    Average Time: ${this.formatTime(stats.averageTimeToCompletion)}`);
      }
    } else {
      sections.push('  No user productivity data available yet.');
    }
    
    sections.push('');
    
    // Stage Efficiency
    sections.push('STAGE EFFICIENCY:');
    
    const stages = Object.entries(report.stageEfficiency.stageEfficiency);
    if (stages.length > 0) {
      for (const [stage, data] of stages) {
        sections.push(`  ${stage}:`);
        sections.push(`    Percentage of Total Time: ${data.percentOfTotal}%`);
        sections.push(`    Efficiency: ${data.efficiency}`);
      }
    } else {
      sections.push('  No stage efficiency data available yet.');
    }
    
    sections.push('');
    
    // Bottlenecks
    sections.push('BOTTLENECKS:');
    
    if (report.bottlenecks.length > 0) {
      for (const bottleneck of report.bottlenecks) {
        sections.push(`  ${bottleneck.stage}:`);
        sections.push(`    Average Time: ${this.formatTime(bottleneck.averageTime)}`);
        sections.push(`    Impact: ${Math.round(bottleneck.impact * 100)}% of total time`);
      }
    } else {
      sections.push('  No significant bottlenecks detected.');
    }
    
    sections.push('');
    
    // Recommendations
    sections.push('RECOMMENDATIONS:');
    
    if (report.recommendations.length > 0) {
      for (const recommendation of report.recommendations) {
        sections.push(`  - ${recommendation}`);
      }
    } else {
      sections.push('  No recommendations available.');
    }
    
    return sections.join('\n');
  }

  /**
   * Generate recommendations based on performance data
   */
  private generateRecommendations(
    stageEfficiency: StageEfficiency,
    bottlenecks: WorkflowBottleneck[],
    trends: CompletionTrends
  ): string[] {
    const recommendations: string[] = [];
    
    // Bottleneck recommendations
    if (bottlenecks.length > 0) {
      const worstBottleneck = bottlenecks[0];
      recommendations.push(
        `Focus on improving the ${worstBottleneck.stage} stage to reduce bottlenecks`
      );
    }
    
    // Recommendations based on stage efficiency
    const lowEfficiencyStages = Object.entries(stageEfficiency.stageEfficiency)
      .filter(([_, data]) => data.efficiency === 'low')
      .map(([stage, _]) => stage);
    
    if (lowEfficiencyStages.length > 0) {
      recommendations.push(
        `Improve efficiency in the ${lowEfficiencyStages.join(', ')} stages`
      );
    }
    
    // Trend-based recommendations
    if (trends.averageTimeToCompletionTrend.length >= 2) {
      const latest = trends.averageTimeToCompletionTrend[trends.averageTimeToCompletionTrend.length - 1];
      const previous = trends.averageTimeToCompletionTrend[trends.averageTimeToCompletionTrend.length - 2];
      
      if (latest.averageDays > previous.averageDays) {
        recommendations.push(
          'Average completion time is increasing. Consider process improvements.'
        );
      }
    }
    
    // Add some generic recommendations if we don't have many
    if (recommendations.length < 2) {
      recommendations.push(
        'Consider adding more detailed issue descriptions to improve clarity'
      );
      recommendations.push(
        'Regular status updates can help identify issues earlier'
      );
    }
    
    return recommendations;
  }

  /**
   * Get the Monday of the week for a given date
   */
  private getWeekStart(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    
    return monday;
  }

  /**
   * Format time in milliseconds to a human-readable string
   */
  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes`;
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hours`;
    } else {
      return `${Math.floor(seconds / 86400)} days`;
    }
  }
}