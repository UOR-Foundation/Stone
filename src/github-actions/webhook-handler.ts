import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config/schema';
import { Logger } from '../utils/logger';
import { createWorkflowForCLI } from '../workflow/cli-adapter';

/**
 * Handles GitHub webhook events with retry mechanism
 */
export class WebhookHandler {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;
  private workflow: any; // Using any since we're using the adapter
  private issueEvents: { [key: string]: (event: any) => Promise<void> } = {};
  private prEvents: { [key: string]: (event: any) => Promise<void> } = {};

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
    this.workflow = createWorkflowForCLI(client, config);

    // Register event handlers
    this.registerEventHandlers();
  }

  /**
   * Handle webhook events with retry mechanism
   */
  public async handleWebhook(
    eventType: string,
    payload: any
  ): Promise<void> {
    try {
      await this.withRetry(async () => {
        if (eventType === 'issues.labeled') {
          await this.handleIssueLabeled(payload);
        } else if (eventType.startsWith('pull_request')) {
          await this.handlePullRequestEvent(payload);
        } else {
          this.logger.info(`Unhandled event type: ${eventType}`);
        }
      });
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error}`);
    }
  }

  /**
   * Handle the 'labeled' event for issues
   */
  public async handleIssueLabeled(event: any): Promise<void> {
    const issueNumber = event.issue.number;
    const labelName = event.label.name;

    this.logger.info(`Processing issue #${issueNumber} with label '${labelName}'`);

    // Check if the label is a Stone label
    if (this.isStoneLabel(labelName)) {
      // Determine the workflow type based on the label
      const workflowType = this.mapLabelToWorkflowType(labelName);
      
      if (workflowType) {
        await this.workflow.runWorkflow(workflowType, issueNumber);
      }
    }
  }

  /**
   * Handle pull request events
   */
  public async handlePullRequestEvent(event: any): Promise<void> {
    const prNumber = event.pull_request.number;
    const action = event.action;

    this.logger.info(`Processing PR #${prNumber} with action '${action}'`);

    // Handle different PR events
    if (this.prEvents[action]) {
      await this.prEvents[action](event);
    } else {
      this.logger.info(`Unhandled PR action: ${action}`);
    }
  }

  /**
   * Register event handlers for different event types
   */
  private registerEventHandlers(): void {
    // PR event handlers
    this.prEvents['opened'] = this.handlePROpened.bind(this);
    this.prEvents['reopened'] = this.handlePROpened.bind(this);
    this.prEvents['synchronize'] = this.handlePRSync.bind(this);
    this.prEvents['closed'] = this.handlePRClosed.bind(this);
  }

  /**
   * Handle a newly opened PR
   */
  private async handlePROpened(event: any): Promise<void> {
    const prNumber = event.pull_request.number;
    const prTitle = event.pull_request.title || '';
    
    this.logger.info(`PR #${prNumber} opened: ${prTitle}`);
    
    // Check if PR references a Stone issue
    const issueMatch = prTitle.match(/#(\d+)/);
    if (issueMatch) {
      const issueNumber = parseInt(issueMatch[1], 10);
      this.logger.info(`PR #${prNumber} references issue #${issueNumber}`);
      
      // Could trigger additional actions here based on the issue status
    }
  }

  /**
   * Handle a PR synchronization (new commits pushed)
   */
  private async handlePRSync(event: any): Promise<void> {
    const prNumber = event.pull_request.number;
    this.logger.info(`PR #${prNumber} updated with new commits`);
    
    // Could trigger test runs or other CI actions here
  }

  /**
   * Handle a PR being closed
   */
  private async handlePRClosed(event: any): Promise<void> {
    const prNumber = event.pull_request.number;
    const merged = event.pull_request.merged;
    
    if (merged) {
      this.logger.info(`PR #${prNumber} was merged`);
      // Handle post-merge actions
    } else {
      this.logger.info(`PR #${prNumber} was closed without merging`);
    }
  }

  /**
   * Check if a label is a Stone label
   */
  private isStoneLabel(label: string): boolean {
    return label.startsWith('stone-');
  }

  /**
   * Map a label to a workflow type
   */
  private mapLabelToWorkflowType(label: string): string | null {
    const labelMap: { [key: string]: string } = {
      'stone-process': 'process',
      'stone-pm': 'pm',
      'stone-qa': 'qa',
      'stone-feature-implement': 'feature',
      'stone-audit': 'audit',
      'stone-ready-for-tests': 'test',
      'stone-feature-fix': 'feature',
      'stone-docs': 'pm',
      'stone-pr': 'pm'
    };

    return labelMap[label] || null;
  }

  /**
   * Retry a function with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let retries = 0;
    let delay = initialDelay;

    while (true) {
      try {
        return await fn();
      } catch (error: any) {
        retries++;
        
        // If we've reached max retries, throw the error
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Check for rate limit error or test error with specific message
        if (
          (error.status === 403 && error.message?.includes('API rate limit exceeded')) ||
          error.message?.includes('API rate limit exceeded')
        ) {
          this.logger.info(`Rate limit exceeded, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          // For other errors, re-throw
          throw error;
        }
      }
    }
  }
}