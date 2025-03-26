import { StatusDashboard } from './status-dashboard';
import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';

/**
 * Interface for progress data stage
 */
export interface ProgressStage {
  name: string;
  label: string;
  completed: boolean;
  current?: boolean;
  timeSpent?: number;
}

/**
 * Interface for progress data
 */
export interface ProgressData {
  issueNumber: number;
  title?: string;
  stages: ProgressStage[];
  currentStageIndex: number;
  completedStages: number;
  totalStages: number;
}

/**
 * Class for visualizing progress of issues through the workflow
 */
export class ProgressVisualization {
  private statusDashboard: StatusDashboard;
  private configLoader: ConfigLoader;
  private logger: Logger;
  private stageLabels: Record<string, string> = {
    'stone': 'Planning',
    'stone-qa': 'QA',
    'stone-feature-implement': 'Implementation',
    'stone-audit': 'Audit'
  };

  constructor(statusDashboard: StatusDashboard, configLoader: ConfigLoader) {
    this.statusDashboard = statusDashboard;
    this.configLoader = configLoader;
    this.logger = new Logger();
  }

  /**
   * Generate progress data for an issue
   */
  public async generateProgressData(issueNumber: number): Promise<ProgressData> {
    this.logger.info(`Generating progress data for issue #${issueNumber}...`);
    
    const config = await this.configLoader.getConfig();
    const issueProgress = await this.statusDashboard.getIssueProgress(issueNumber);
    
    // Get workflow stages from config or use default
    const workflowStages = config.workflow?.stages || 
      ['stone', 'stone-qa', 'stone-feature-implement', 'stone-audit'];
    
    // Create stages array
    const stages: ProgressStage[] = workflowStages.map(stageName => {
      return {
        name: stageName,
        label: this.stageLabels[stageName] || stageName,
        completed: false
      };
    });
    
    // Determine completed stages and current stage
    let currentStageIndex = -1;
    let completedStages = 0;
    
    if (issueProgress.currentLabel) {
      // Find current stage index
      currentStageIndex = workflowStages.findIndex(
        stage => stage === issueProgress.currentLabel
      );
      
      if (currentStageIndex !== -1) {
        // Mark current stage
        stages[currentStageIndex].current = true;
        stages[currentStageIndex].timeSpent = issueProgress.timeInCurrentStage;
        
        // Mark all previous stages as completed
        for (let i = 0; i < currentStageIndex; i++) {
          stages[i].completed = true;
          completedStages++;
        }
      }
    }
    
    // If issue is closed, mark all stages as completed
    if (issueProgress.issue.state === 'closed') {
      stages.forEach(stage => { stage.completed = true; });
      completedStages = stages.length;
      currentStageIndex = stages.length - 1;
    }
    
    return {
      issueNumber,
      title: issueProgress.issue.title,
      stages,
      currentStageIndex: currentStageIndex !== -1 ? currentStageIndex : 0,
      completedStages,
      totalStages: stages.length
    };
  }

  /**
   * Render a text-based progress bar
   */
  public renderProgressBar(progressData: ProgressData): string {
    const { issueNumber, title, stages, completedStages, totalStages } = progressData;
    
    // Create progress bar sections
    const sections: string[] = [];
    
    // Header
    sections.push(`Issue #${issueNumber}${title ? ': ' + title : ''}`);
    sections.push(`Progress: ${completedStages}/${totalStages} stages completed`);
    sections.push('');
    
    // Create progress bar
    const barWidth = 40; // Characters wide
    const progressBar: string[] = [];
    
    // Add opening bracket
    progressBar.push('[');
    
    // Add progress segments
    const segmentWidth = Math.floor(barWidth / totalStages);
    
    for (let i = 0; i < totalStages; i++) {
      const stage = stages[i];
      let segment = '';
      
      if (stage.completed) {
        // Completed stage - fill with '='
        segment = '='.repeat(segmentWidth);
      } else if (stage.current) {
        // Current stage - fill with '>'
        segment = '>'.repeat(segmentWidth);
      } else {
        // Future stage - fill with ' '
        segment = ' '.repeat(segmentWidth);
      }
      
      progressBar.push(segment);
    }
    
    // Add closing bracket
    progressBar.push(']');
    
    // Add progress bar to sections
    sections.push(progressBar.join(''));
    sections.push('');
    
    // Add stage labels
    const stageLabels: string[] = [];
    let labelPosition = 1; // Start after the opening bracket
    
    for (let i = 0; i < totalStages; i++) {
      const stage = stages[i];
      const label = stage.label;
      
      // Center the label within its segment
      const position = labelPosition + Math.floor((segmentWidth - label.length) / 2);
      stageLabels[position] = label;
      
      // Move to next segment
      labelPosition += segmentWidth;
    }
    
    // Fill gaps with spaces
    let labelLine = '';
    for (let i = 0; i < barWidth + 2; i++) {
      labelLine += stageLabels[i] || ' ';
    }
    
    sections.push(labelLine);
    sections.push('');
    
    // Add time spent in current stage if available
    const currentStage = stages.find(stage => stage.current);
    if (currentStage && currentStage.timeSpent) {
      const timeSpent = this.formatTime(currentStage.timeSpent);
      sections.push(`Time in ${currentStage.label} stage: ${timeSpent}`);
      sections.push('');
    }
    
    return sections.join('\n');
  }

  /**
   * Render a timeline view of issue progress
   */
  public async renderTimelineView(issueNumber: number): Promise<string> {
    this.logger.info(`Rendering timeline for issue #${issueNumber}...`);
    
    const issueProgress = await this.statusDashboard.getIssueProgress(issueNumber);
    const { issue, timeline } = issueProgress;
    
    // Create timeline sections
    const sections: string[] = [];
    
    // Header
    sections.push(`Issue #${issueNumber}: ${issue.title} - Timeline`);
    sections.push('========================================');
    sections.push('');
    
    // Creation date
    sections.push(`Created: ${new Date(issue.created_at).toLocaleString()}`);
    sections.push('');
    
    // Timeline events
    sections.push('Events:');
    
    for (const event of timeline) {
      const date = new Date(event.created_at).toLocaleString();
      
      if (event.event === 'labeled') {
        const labelName = typeof event.label === 'string' ? event.label : event.label.name;
        const stageLabel = this.stageLabels[labelName] || labelName;
        sections.push(`  ${date} - Moved to ${stageLabel} stage`);
      } else if (event.event === 'commented') {
        sections.push(`  ${date} - Comment added`);
      } else if (event.event === 'closed') {
        sections.push(`  ${date} - Issue closed`);
      } else if (event.event === 'reopened') {
        sections.push(`  ${date} - Issue reopened`);
      } else {
        sections.push(`  ${date} - ${event.event}`);
      }
    }
    
    return sections.join('\n');
  }

  /**
   * Generate a text-based graph of the workflow
   */
  public async generateWorkflowGraph(): Promise<string> {
    this.logger.info('Generating workflow graph...');
    
    const statusData = await this.statusDashboard.getStatusData();
    const config = await this.configLoader.getConfig();
    
    // Get workflow stages from config or use default
    const workflowStages = config.workflow?.stages || 
      ['stone', 'stone-qa', 'stone-feature-implement', 'stone-audit'];
    
    // Create graph sections
    const sections: string[] = [];
    
    // Header
    sections.push('Workflow Status');
    sections.push('==============');
    sections.push('');
    
    // Calculate max count for scaling
    let maxCount = 0;
    for (const stage of workflowStages) {
      const count = statusData.labelDistribution[stage] || 0;
      maxCount = Math.max(maxCount, count);
    }
    
    // Generate graph
    const graphWidth = 40; // Characters wide
    
    for (const stage of workflowStages) {
      const stageLabel = this.stageLabels[stage] || stage;
      const count = statusData.labelDistribution[stage] || 0;
      
      // Calculate bar length
      const barLength = maxCount > 0 
        ? Math.floor((count / maxCount) * graphWidth)
        : 0;
      
      // Add bar with count
      const bar = '#'.repeat(barLength);
      const paddedLabel = stageLabel.padEnd(15);
      sections.push(`${paddedLabel} | ${bar} (${count})`);
    }
    
    sections.push('');
    
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