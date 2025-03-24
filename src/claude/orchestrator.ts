import { ConfigLoader, StoneConfig } from '../config';
import { GitHubClient } from '../github/client';
import { RoleManager } from './roles/role-manager';
import { Logger } from '../utils/logger';

export class RoleOrchestrator {
  private roleManager: RoleManager;
  private githubClient: GitHubClient | null = null;
  private config: StoneConfig | null = null;
  private logger: Logger;
  
  constructor(private token: string) {
    this.roleManager = new RoleManager();
    this.logger = new Logger();
  }
  
  /**
   * Initialize dependencies if not already initialized
   */
  private async initialize(): Promise<void> {
    if (!this.githubClient || !this.config) {
      const configLoader = new ConfigLoader();
      this.config = await configLoader.getConfig();
      this.githubClient = new GitHubClient(this.token, this.config);
    }
  }
  
  /**
   * Process an issue based on its Stone labels
   */
  public async processIssue(issueNumber: number): Promise<void> {
    await this.initialize();
    
    try {
      this.logger.info(`Processing issue #${issueNumber}`);
      
      // Get Stone labels from the issue
      const stoneLabels = await this.getStoneLabels(issueNumber);
      
      if (stoneLabels.length === 0) {
        throw new Error(`No Stone label found on issue #${issueNumber}`);
      }
      
      // Prioritize labels according to workflow
      const prioritizedLabels = this.prioritizeLabels(stoneLabels);
      const currentLabel = prioritizedLabels[0];
      
      this.logger.info(`Processing issue #${issueNumber} with label: ${currentLabel}`);
      
      // Process the issue with the appropriate role
      await this.roleManager.processIssue(issueNumber, currentLabel);
      
      this.logger.success(`Successfully processed issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(`Error processing issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Process an issue with a specific label
   */
  public async processIssueWithLabel(issueNumber: number, label: string): Promise<void> {
    await this.initialize();
    
    try {
      // Validate label
      if (!await this.isStoneLabel(label)) {
        throw new Error(`Not a valid Stone label: ${label}`);
      }
      
      this.logger.info(`Processing issue #${issueNumber} with label: ${label}`);
      
      // Process the issue with the specified role
      await this.roleManager.processIssue(issueNumber, label);
      
      this.logger.success(`Successfully processed issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(`Error processing issue #${issueNumber} with label ${label}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Check if a label is a Stone label
   */
  public async isStoneLabel(label: string): Promise<boolean> {
    await this.initialize();
    
    const stoneLabels = [
      this.config!.workflow.stoneLabel,
      'stone-qa',
      'stone-feature-implement',
      'stone-feature-fix',
      'stone-audit',
      'stone-audit-pass',
      'stone-audit-fail',
      'stone-actions',
      'stone-ready-for-tests',
      'stone-test-failure',
      'stone-docs',
      'stone-pr',
      'stone-complete',
      'stone-feedback',
      'stone-dependency',
      'stone-error',
    ];
    
    return stoneLabels.includes(label);
  }
  
  /**
   * Get all Stone labels from an issue
   */
  public async getStoneLabels(issueNumber: number): Promise<string[]> {
    await this.initialize();
    
    try {
      const { data: issue } = await this.githubClient!.getIssue(issueNumber);
      
      // Extract label names
      const labelNames = issue.labels.map((label: string | {name?: string}) => {
        return typeof label === 'string' ? label : label.name;
      }).filter(Boolean) as string[];
      
      // Filter to only Stone labels
      const stoneLabels = [];
      for (const label of labelNames) {
        if (await this.isStoneLabel(label)) {
          stoneLabels.push(label);
        }
      }
      
      return stoneLabels;
    } catch (error) {
      this.logger.error(`Error getting Stone labels for issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Prioritize labels according to workflow
   */
  public prioritizeLabels(labels: string[]): string[] {
    // Define priority order (later stages first)
    const priorityOrder = [
      'stone-error', // Highest priority - error state
      'stone-audit', // Audit stage
      'stone-feature-fix', // Feature fix stage
      'stone-feature-implement', // Feature implementation stage
      'stone-actions', // GitHub Actions stage
      'stone-qa', // QA stage
      'stone-process', // Initial stage
    ];
    
    // Sort labels by priority
    return [...labels].sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);
      
      // If both labels are in priority order, sort by index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one label is in priority order, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // If neither label is in priority order, maintain original order
      return 0;
    });
  }
}