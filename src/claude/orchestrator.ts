import { ConfigLoader, StoneConfig } from '../config';
import { GitHubClient } from '../github/client';
import { RoleManager } from './roles/role-manager';
import { Logger } from '../utils/logger';

/**
 * Role information interface for role-based permissions
 */
export interface RoleInfo {
  name: string;
  permissions: string[];
}

/**
 * Orchestrates role-based processing of GitHub issues
 * Manages the workflow between different Claude roles (PM, QA, Feature, Auditor, Actions)
 */
export class RoleOrchestrator {
  private roleManager: RoleManager;
  private githubClient: GitHubClient | null = null;
  private config: StoneConfig | null = null;
  private logger: Logger;
  private currentRole: RoleInfo | null = null;
  
  /**
   * Create a new role orchestrator
   * @param token GitHub API token
   */
  constructor(private token: string) {
    this.roleManager = new RoleManager();
    this.logger = new Logger();
  }
  
  /**
   * Initialize dependencies if not already initialized
   * Loads config and creates GitHub client
   */
  private async initialize(): Promise<void> {
    try {
      if (!this.githubClient || !this.config) {
        this.logger.info('Initializing role orchestrator dependencies');
        const configLoader = new ConfigLoader();
        this.config = await configLoader.getConfig();
        this.githubClient = new GitHubClient(this.token, this.config);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize role orchestrator: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to initialize role orchestrator: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the token being used for GitHub API access
   * @returns The GitHub API token
   */
  public getToken(): string {
    return this.token;
  }

  /**
   * Get information about the current role
   * @returns Information about the current role
   */
  public async getCurrentRole(): Promise<RoleInfo> {
    // If no role is set, use a default role
    if (!this.currentRole) {
      this.logger.info('No current role set, using default system role');
      this.currentRole = {
        name: 'system',
        permissions: ['workflow:execute:*']
      };
    }
    
    return this.currentRole;
  }

  /**
   * Process an issue based on its Stone labels
   * Automatically determines the appropriate role based on labels
   * @param issueNumber Issue number to process
   */
  public async processIssue(issueNumber: number): Promise<void> {
    await this.initialize();
    
    try {
      this.logger.info(`Processing issue #${issueNumber}`);
      
      // Get Stone labels from the issue
      const stoneLabels = await this.getStoneLabels(issueNumber);
      
      if (stoneLabels.length === 0) {
        this.logger.error(`No Stone label found on issue #${issueNumber}`);
        throw new Error(`No Stone label found on issue #${issueNumber}`);
      }
      
      // Prioritize labels according to workflow
      const prioritizedLabels = this.prioritizeLabels(stoneLabels);
      const currentLabel = prioritizedLabels[0];
      
      this.logger.info(`Processing issue #${issueNumber} with label: ${currentLabel}`);
      
      // Process the issue with the appropriate role
      await this.roleManager.processIssue(issueNumber, currentLabel);
      
      this.logger.success(`Successfully processed issue #${issueNumber}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing issue #${issueNumber}: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Process an issue with a specific label
   * @param issueNumber Issue number to process
   * @param label Stone label to process with
   */
  public async processIssueWithLabel(issueNumber: number, label: string): Promise<void> {
    await this.initialize();
    
    try {
      // Validate label
      if (!await this.isStoneLabel(label)) {
        this.logger.error(`Not a valid Stone label: ${label}`);
        throw new Error(`Not a valid Stone label: ${label}`);
      }
      
      this.logger.info(`Processing issue #${issueNumber} with label: ${label}`);
      
      // Process the issue with the specified role
      await this.roleManager.processIssue(issueNumber, label);
      
      this.logger.success(`Successfully processed issue #${issueNumber}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing issue #${issueNumber} with label ${label}: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Process an issue with the PM role
   * PM role is responsible for creating Gherkin specifications
   * @param issueNumber Issue number to process
   */
  public async processWithPMRole(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Processing issue #${issueNumber} with PM role`);
      
      this.currentRole = {
        name: 'pm',
        permissions: [
          'repository:read',
          'docs:write',
          'issues:write',
          'pr:write',
          'workflow:execute:*'
        ]
      };
      
      await this.processIssueWithLabel(issueNumber, 'stone-process');
    } catch (error) {
      this.logger.error(`Error in PM role processing: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process an issue with the QA role
   * QA role is responsible for creating tests
   * @param issueNumber Issue number to process
   */
  public async processWithQARole(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Processing issue #${issueNumber} with QA role`);
      
      this.currentRole = {
        name: 'qa',
        permissions: [
          'repository:read',
          'tests:write',
          'benchmarks:write',
          'test-utils:write',
          'workflow:execute:*'
        ]
      };
      
      await this.processIssueWithLabel(issueNumber, 'stone-qa');
    } catch (error) {
      this.logger.error(`Error in QA role processing: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process an issue with the Feature role
   * Feature role is responsible for implementing code
   * @param issueNumber Issue number to process
   */
  public async processWithFeatureRole(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Processing issue #${issueNumber} with Feature role`);
      
      this.currentRole = {
        name: 'feature',
        permissions: [
          'repository:read',
          'src:write',
          'workflow:execute:*'
        ]
      };
      
      await this.processIssueWithLabel(issueNumber, 'stone-feature-implement');
    } catch (error) {
      this.logger.error(`Error in Feature role processing: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process an issue with the Auditor role
   * Auditor role is responsible for code review
   * @param issueNumber Issue number to process
   */
  public async processWithAuditorRole(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Processing issue #${issueNumber} with Auditor role`);
      
      this.currentRole = {
        name: 'auditor',
        permissions: [
          'repository:read',
          'issues:write',
          'workflow:execute:*'
        ]
      };
      
      await this.processIssueWithLabel(issueNumber, 'stone-audit');
    } catch (error) {
      this.logger.error(`Error in Auditor role processing: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process an issue with the Actions role
   * Actions role is responsible for GitHub Actions workflows
   * @param issueNumber Issue number to process
   */
  public async processWithActionsRole(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Processing issue #${issueNumber} with Actions role`);
      
      this.currentRole = {
        name: 'actions',
        permissions: [
          'repository:read',
          'github-actions:write',
          'workflow:execute:*'
        ]
      };
      
      await this.processIssueWithLabel(issueNumber, 'stone-actions');
    } catch (error) {
      this.logger.error(`Error in Actions role processing: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Check if a label is a Stone label
   * @param label Label to check
   * @returns True if the label is a Stone label
   */
  public async isStoneLabel(label: string): Promise<boolean> {
    try {
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
    } catch (error) {
      this.logger.error(`Error checking if label is a Stone label: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Get all Stone labels from an issue
   * @param issueNumber Issue number to get labels from
   * @returns Array of Stone labels
   */
  public async getStoneLabels(issueNumber: number): Promise<string[]> {
    await this.initialize();
    
    try {
      this.logger.info(`Getting Stone labels for issue #${issueNumber}`);
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
      
      this.logger.info(`Found ${stoneLabels.length} Stone labels for issue #${issueNumber}`);
      return stoneLabels;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting Stone labels for issue #${issueNumber}: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Prioritize labels according to workflow
   * @param labels Array of labels to prioritize
   * @returns Prioritized array of labels
   */
  public prioritizeLabels(labels: string[]): string[] {
    try {
      this.logger.info(`Prioritizing ${labels.length} labels`);
      
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
    } catch (error) {
      this.logger.error(`Error prioritizing labels: ${error instanceof Error ? error.message : String(error)}`);
      return [...labels]; // Return original labels if prioritization fails
    }
  }
}
