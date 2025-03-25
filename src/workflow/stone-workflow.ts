import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { Logger } from '../utils/logger';
import { LoggerService } from '../services/logger-service';
import { FileSystemService } from '../services/filesystem-service';
import { RoleOrchestrator } from '../claude/orchestrator';

// Import conflict resolution and feedback handler
import { ConflictResolution } from './conflict-resolution';
import { FeedbackHandler } from './feedback-handler';
import { DocsManager } from './docs-manager';
import { ErrorRecovery } from './error-recovery';

/**
 * Main class for orchestrating Stone workflow
 */
export class StoneWorkflow {
  private logger: Logger;
  private fsService: FileSystemService;
  private roleOrchestrator: RoleOrchestrator;
  private conflictResolution: ConflictResolution;
  private feedbackHandler: FeedbackHandler;
  private docsManager: DocsManager;
  private errorRecovery: ErrorRecovery;
  
  constructor(
    private client: GitHubClient,
    private config: StoneConfig
  ) {
    this.logger = new Logger();
    
    // Initialize services
    const loggerService = new LoggerService();
    this.fsService = new FileSystemService(loggerService);
    this.roleOrchestrator = new RoleOrchestrator(this.client.getToken());
    
    // Initialize workflow components
    this.conflictResolution = new ConflictResolution(this.client, this.config, loggerService);
    this.feedbackHandler = new FeedbackHandler(this.client, this.config, loggerService);
    this.docsManager = new DocsManager(this.client, this.config, loggerService);
    this.errorRecovery = new ErrorRecovery(this.client, this.config, loggerService);
  }
  
  /**
   * Run a specific workflow
   * @param workflowType Type of workflow to run
   * @param issueNumber Issue number to process
   */
  public async runWorkflow(workflowType: string, issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Executing workflow: ${workflowType} for issue #${issueNumber}`);
      
      // Execute workflow based on type
      switch (workflowType) {
        case 'pm':
          await this.roleOrchestrator.processWithPMRole(issueNumber);
          break;
        case 'qa':
          await this.roleOrchestrator.processWithQARole(issueNumber);
          break;
        case 'feature':
          await this.roleOrchestrator.processWithFeatureRole(issueNumber);
          break;
        case 'audit':
          await this.roleOrchestrator.processWithAuditorRole(issueNumber);
          break;
        case 'actions':
          await this.roleOrchestrator.processWithActionsRole(issueNumber);
          break;
        case 'conflict-resolution':
          await this.conflictResolution.resolveConflicts(issueNumber);
          break;
        case 'feedback':
          await this.feedbackHandler.processFeedback(issueNumber);
          break;
        case 'docs':
          await this.docsManager.updateDocumentation(issueNumber);
          break;
        case 'pr':
          await this.createPullRequest(issueNumber);
          break;
        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }
      
      this.logger.info(`Workflow ${workflowType} completed successfully for issue #${issueNumber}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Workflow ${workflowType} failed for issue #${issueNumber}`, { error: errorMessage });
      
      // Handle error recovery
      await this.errorRecovery.handleWorkflowError(workflowType, issueNumber, error);
      
      throw error;
    }
  }

  /**
   * Create a pull request for a completed issue
   * @param issueNumber Issue number to create PR for
   */
  private async createPullRequest(issueNumber: number): Promise<void> {
    // Implementation would use the GitHub client to create a PR
    // This is a placeholder for future implementation
    this.logger.info(`Creating pull request for issue #${issueNumber}`);
    
    // In a real implementation, we would:
    // 1. Get the issue details
    // 2. Get the branch name (from issue or config)
    // 3. Create a PR with appropriate title and body
    // 4. Link the PR to the issue
  }
}