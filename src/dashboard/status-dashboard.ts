import { GitHubClient } from '../github/client';
import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';

/**
 * Interface for issue status data
 */
export interface IssueStatus {
  total: number;
  open: number;
  closed: number;
}

/**
 * Interface for pull request status data
 */
export interface PRStatus {
  total: number;
  open: number;
  closed: number;
}

/**
 * Interface for status data
 */
export interface StatusData {
  issues: IssueStatus;
  pullRequests: PRStatus;
  labelDistribution: Record<string, number>;
}

/**
 * Interface for stage metrics
 */
export interface StageMetrics {
  averageTime: number;
  minTime?: number;
  maxTime?: number;
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetrics {
  averageTimeToCompletion: number;
  stageMetrics: Record<string, StageMetrics>;
}

/**
 * Interface for workflow bottleneck
 */
export interface WorkflowBottleneck {
  stage: string;
  averageTime: number;
  impact: number; // 0-1 value representing the bottleneck's impact on the overall workflow
}

/**
 * Status Dashboard class for providing status information
 */
export class StatusDashboard {
  private githubClient: GitHubClient;
  private configLoader: ConfigLoader;
  private logger: Logger;

  constructor(githubClient: GitHubClient, configLoader: ConfigLoader) {
    this.githubClient = githubClient;
    this.configLoader = configLoader;
    this.logger = new Logger();
  }

  /**
   * Get status data for the repository
   */
  public async getStatusData(): Promise<StatusData> {
    this.logger.info('Fetching status data...');
    const config = await this.configLoader.getConfig();
    
    // Fetch issues and pull requests
    const issues = await this.githubClient.listIssues('all');
    const pullRequests = await this.githubClient.listPullRequests('all');
    
    // Calculate status data
    const labelDistribution: Record<string, number> = {};
    
    // Count issues by label
    for (const issue of issues.data || []) {
      for (const label of issue.labels || []) {
        const labelName = typeof label === 'string' ? label : label.name;
        if (labelName) {
          labelDistribution[labelName] = (labelDistribution[labelName] || 0) + 1;
        }
      }
    }
    
    return {
      issues: {
        total: (issues.data || []).length,
        open: (issues.data || []).filter((issue: any) => issue.state === 'open').length,
        closed: (issues.data || []).filter((issue: any) => issue.state === 'closed').length
      },
      pullRequests: {
        total: (pullRequests.data || []).length,
        open: (pullRequests.data || []).filter((pr: any) => pr.state === 'open').length,
        closed: (pullRequests.data || []).filter((pr: any) => pr.state === 'closed').length
      },
      labelDistribution
    };
  }

  /**
   * Get progress information for a specific issue
   */
  public async getIssueProgress(issueNumber: number): Promise<any> {
    this.logger.info(`Fetching progress for issue #${issueNumber}...`);
    
    // Fetch issue details
    const issue = await this.githubClient.getIssue(issueNumber);
    
    // Fetch issue timeline
    const timeline = await this.githubClient.getIssueTimeline(issueNumber);
    
    // Determine current stage based on labels
    let currentLabel: string | undefined;
    const labelEvents = timeline
      .filter(event => event.event === 'labeled')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    if (labelEvents.length > 0 && labelEvents[0].label) {
      currentLabel = typeof labelEvents[0].label === 'string' 
        ? labelEvents[0].label 
        : labelEvents[0].label.name;
    }
    
    // Calculate time in current stage
    let timeInCurrentStage = 0;
    if (currentLabel && labelEvents.length > 0) {
      const currentStageStartTime = new Date(labelEvents[0].created_at).getTime();
      timeInCurrentStage = Date.now() - currentStageStartTime;
    }
    
    return {
      issue,
      timeline,
      currentLabel,
      timeInCurrentStage
    };
  }

  /**
   * Get performance metrics for the workflow
   */
  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    this.logger.info('Calculating performance metrics...');
    
    // Fetch closed issues
    const closedIssues = await this.githubClient.listIssues('closed');
    
    // Calculate average time to completion
    let totalCompletionTime = 0;
    let stageTimeData: Record<string, number[]> = {};
    
    for (const issue of closedIssues.data || []) {
      const issueNumber = issue.number;
      const createdAt = new Date(issue.created_at).getTime();
      const closedAt = new Date(issue.closed_at as string).getTime();
      
      // Add to total completion time
      totalCompletionTime += (closedAt - createdAt);
      
      // Analyze stage times
      const timeline = await this.githubClient.getIssueTimeline(issueNumber);
      
      // Extract label events to track stage transitions
      const labelEvents = timeline
        .filter(event => event.event === 'labeled' || event.event === 'unlabeled')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      // Calculate time spent in each stage
      let currentStage: string | null = null;
      let stageStartTime = createdAt;
      
      for (const event of labelEvents) {
        const eventTime = new Date(event.created_at).getTime();
        const labelName = event.label ? (typeof event.label === 'string' ? event.label : event.label.name) : null;
        
        if (event.event === 'labeled' && labelName) {
          if (currentStage) {
            // Record time in previous stage
            const timeInStage = eventTime - stageStartTime;
            if (!stageTimeData[currentStage]) {
              stageTimeData[currentStage] = [];
            }
            stageTimeData[currentStage].push(timeInStage);
          }
          
          // Update current stage
          currentStage = labelName;
          stageStartTime = eventTime;
        } else if (event.event === 'unlabeled' && labelName === currentStage) {
          // Record time in current stage
          const timeInStage = eventTime - stageStartTime;
          if (!stageTimeData[currentStage]) {
            stageTimeData[currentStage] = [];
          }
          stageTimeData[currentStage].push(timeInStage);
          
          // Reset current stage
          currentStage = null;
        }
      }
      
      // Add time for the final stage
      if (currentStage) {
        const timeInStage = closedAt - stageStartTime;
        if (!stageTimeData[currentStage]) {
          stageTimeData[currentStage] = [];
        }
        stageTimeData[currentStage].push(timeInStage);
      }
    }
    
    // Calculate average time to completion
    const averageTimeToCompletion = totalCompletionTime / ((closedIssues.data || []).length || 1);
    
    // Calculate stage metrics
    const stageMetrics: Record<string, StageMetrics> = {};
    for (const [stage, times] of Object.entries(stageTimeData)) {
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const averageTime = totalTime / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      stageMetrics[stage] = {
        averageTime,
        minTime,
        maxTime
      };
    }
    
    return {
      averageTimeToCompletion,
      stageMetrics
    };
  }

  /**
   * Identify workflow bottlenecks
   */
  public async identifyBottlenecks(): Promise<WorkflowBottleneck[]> {
    this.logger.info('Identifying workflow bottlenecks...');
    
    const metrics = await this.getPerformanceMetrics();
    const bottlenecks: WorkflowBottleneck[] = [];
    
    // Calculate the average time per stage
    for (const [stage, stageMetric] of Object.entries(metrics.stageMetrics)) {
      // Calculate impact (percentage of total time)
      const impact = stageMetric.averageTime / metrics.averageTimeToCompletion;
      
      // Add stages that take more than 30% of the total time as bottlenecks
      if (impact > 0.3) {
        bottlenecks.push({
          stage,
          averageTime: stageMetric.averageTime,
          impact
        });
      }
    }
    
    // Sort bottlenecks by impact (highest first)
    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Render the status dashboard as text
   */
  public async renderStatusDashboard(): Promise<string> {
    this.logger.info('Rendering status dashboard...');
    
    // Fetch data
    const statusData = await this.getStatusData();
    const performanceMetrics = await this.getPerformanceMetrics();
    const bottlenecks = await this.identifyBottlenecks();
    
    // Create dashboard sections
    const sections: string[] = [];
    
    // Header
    sections.push('========================================');
    sections.push('          STONE STATUS DASHBOARD        ');
    sections.push('========================================');
    sections.push('');
    
    // Issues and PRs
    sections.push('ISSUES:');
    sections.push(`  Total: ${statusData.issues.total}`);
    sections.push(`  Open: ${statusData.issues.open}`);
    sections.push(`  Closed: ${statusData.issues.closed}`);
    sections.push('');
    
    sections.push('PULL REQUESTS:');
    sections.push(`  Total: ${statusData.pullRequests.total}`);
    sections.push(`  Open: ${statusData.pullRequests.open}`);
    sections.push(`  Closed: ${statusData.pullRequests.closed}`);
    sections.push('');
    
    // Label distribution
    sections.push('LABEL DISTRIBUTION:');
    for (const [label, count] of Object.entries(statusData.labelDistribution)) {
      sections.push(`  ${label}: ${count}`);
    }
    sections.push('');
    
    // Performance metrics
    sections.push('PERFORMANCE METRICS:');
    sections.push(`  Average Time to Completion: ${this.formatTime(performanceMetrics.averageTimeToCompletion)}`);
    sections.push('  Stage Metrics:');
    for (const [stage, metrics] of Object.entries(performanceMetrics.stageMetrics)) {
      sections.push(`    ${stage}:`);
      sections.push(`      Average Time: ${this.formatTime(metrics.averageTime)}`);
      if (metrics.minTime !== undefined) {
        sections.push(`      Min Time: ${this.formatTime(metrics.minTime)}`);
      }
      if (metrics.maxTime !== undefined) {
        sections.push(`      Max Time: ${this.formatTime(metrics.maxTime)}`);
      }
    }
    sections.push('');
    
    // Bottlenecks
    sections.push('BOTTLENECKS:');
    if (bottlenecks.length === 0) {
      sections.push('  No significant bottlenecks detected.');
    } else {
      for (const bottleneck of bottlenecks) {
        sections.push(`  Stage: ${bottleneck.stage}`);
        sections.push(`    Average Time: ${this.formatTime(bottleneck.averageTime)}`);
        sections.push(`    Impact: ${Math.round(bottleneck.impact * 100)}% of total time`);
      }
    }
    
    // Join all sections
    return sections.join('\n');
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