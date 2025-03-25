import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { LoggerService } from '../services/logger-service';

/**
 * Interface for workflow error details
 */
export interface WorkflowErrorDetails {
  type: string;
  message: string;
  issueNumber: number;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * Manages error recovery for workflow operations
 */
export class ErrorRecovery {
  constructor(
    private client: GitHubClient,
    private config: StoneConfig,
    private logger: LoggerService
  ) {}

  /**
   * Handle a workflow error by implementing recovery mechanisms
   * @param workflowType The type of workflow that failed
   * @param issueNumber The issue number being processed
   * @param error The error that occurred
   */
  public async handleWorkflowError(workflowType: string, issueNumber: number, error: unknown): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.info(`Attempting to recover from ${workflowType} error for issue #${issueNumber}`, {
        error: errorMessage,
        issueNumber,
        workflowType
      });
      
      // Add error label to the issue
      await this.client.addLabelsToIssue(issueNumber, ['stone-error']);
      
      // Add comment to the issue with error details
      const errorNotification = this.buildErrorNotification(workflowType, issueNumber, error);
      await this.client.createIssueComment(issueNumber, errorNotification);
      
      // Get issue details to determine current status
      const issueData = await this.client.getIssue(issueNumber);
      const labels = issueData.data.labels.map((label: { name: string }) => label.name);
      
      // Record error for analytics
      const errorDetails: WorkflowErrorDetails = {
        type: workflowType,
        message: errorMessage,
        issueNumber,
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          labels,
          title: issueData.data.title
        }
      };
      
      // Log the error details for future analysis
      this.logger.error(`Workflow error in ${workflowType}`, errorDetails);
      
      // Check if error is recoverable or requires manual intervention
      const requiresManualIntervention = this.requiresManualIntervention(errorMessage);
      
      if (requiresManualIntervention) {
        // Create tools for manual intervention
        await this.createManualInterventionTool(issueNumber, workflowType, errorMessage);
      } else {
        // Attempt automated recovery based on workflow type
        await this.recoverWorkflow(workflowType, issueNumber);
      }
      
      this.logger.info(`Error recovery completed for issue #${issueNumber}`);
    } catch (recoveryError: unknown) {
      // Just log the recovery error, don't throw
      const errorMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
      this.logger.error(`Failed to recover from error for issue #${issueNumber}`, { 
        error: errorMessage,
        issueNumber,
        workflowType
      });
    }
  }

  /**
   * Build notification message for an error
   * @param workflowType The type of workflow that failed
   * @param issueNumber The issue number being processed
   * @param error The error that occurred
   * @returns Formatted error notification
   */
  public buildErrorNotification(workflowType: string, issueNumber: number, error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    let notification = `## Error in ${workflowType} workflow\n\n`;
    notification += `An error occurred during processing of issue #${issueNumber}:\n\n`;
    notification += `\`\`\`\n${errorMessage}\n\`\`\`\n\n`;
    
    if (errorStack && this.config.errorRecovery?.includeStackTrace !== false) {
      notification += `<details><summary>Error Details</summary>\n\n`;
      notification += `\`\`\`\n${errorStack}\n\`\`\`\n\n`;
      notification += `</details>\n\n`;
    }
    
    notification += `The system will attempt to recover automatically. If this error persists, manual intervention may be required.`;
    
    return notification;
  }

  /**
   * Determine if an error requires manual intervention
   * @param errorMessage Error message to check
   * @returns True if manual intervention is required
   */
  private requiresManualIntervention(errorMessage: string): boolean {
    // Check for errors that typically require manual intervention
    const manualInterventionTriggers = [
      'permission denied',
      'authentication failed',
      'rate limit exceeded',
      'network error',
      'merge conflict',
      'validation failed',
      'invalid configuration',
      'not authorized',
      'cannot access'
    ];
    
    const message = errorMessage.toLowerCase();
    return manualInterventionTriggers.some(trigger => message.includes(trigger));
  }

  /**
   * Create manual intervention tools for an issue
   * @param issueNumber Issue number
   * @param workflowType Workflow type that failed
   * @param errorMessage Error message
   */
  public async createManualInterventionTool(
    issueNumber: number,
    workflowType: string,
    errorMessage: string
  ): Promise<void> {
    try {
      this.logger.info(`Creating manual intervention tool for issue #${issueNumber}`);
      
      // Add manual intervention label
      await this.client.addLabelsToIssue(issueNumber, ['stone-manual-intervention']);
      
      // Get issue details
      const issueData = await this.client.getIssue(issueNumber);
      
      // Create comment with intervention instructions
      let interventionComment = `## Manual Intervention Required\n\n`;
      interventionComment += `The automated workflow for this issue has encountered an error that requires manual intervention.\n\n`;
      
      // Add error details
      interventionComment += `### Error Details\n\n`;
      interventionComment += `- **Workflow Type**: ${workflowType}\n`;
      interventionComment += `- **Error Message**: ${errorMessage}\n`;
      interventionComment += `- **Issue Title**: ${issueData.data.title}\n`;
      interventionComment += `- **Current Labels**: ${issueData.data.labels.map((l: any) => l.name).join(', ')}\n\n`;
      
      // Add recommended actions based on workflow type
      interventionComment += `### Recommended Actions\n\n`;
      
      switch (workflowType) {
        case 'pm':
          interventionComment += `1. Verify that the issue template is correctly formatted\n`;
          interventionComment += `2. Check if the necessary labels are applied\n`;
          interventionComment += `3. Manually generate Gherkin specifications if needed\n`;
          break;
        case 'qa':
          interventionComment += `1. Check if test files can be generated manually\n`;
          interventionComment += `2. Verify that test requirements are clearly specified\n`;
          interventionComment += `3. Consider moving to feature implementation if tests cannot be created\n`;
          break;
        case 'feature':
          interventionComment += `1. Check for merge conflicts in the feature branch\n`;
          interventionComment += `2. Verify that implementation requirements are clear\n`;
          interventionComment += `3. Consider manually creating a PR if the automated process failed\n`;
          break;
        case 'audit':
          interventionComment += `1. Verify that the PR meets audit criteria\n`;
          interventionComment += `2. Check for failing tests or lint errors\n`;
          interventionComment += `3. Consider manually approving the PR if appropriate\n`;
          break;
        default:
          interventionComment += `1. Review the error message and determine the cause\n`;
          interventionComment += `2. Check repository permissions and configuration\n`;
          interventionComment += `3. Apply appropriate labels to continue the workflow\n`;
      }
      
      // Add resolution instructions
      interventionComment += `\n### Resolution\n\n`;
      interventionComment += `Once the issue is resolved manually, apply the \`stone-recovery-complete\` label to resume automated processing.\n`;
      
      await this.client.createIssueComment(issueNumber, interventionComment);
      
      this.logger.info(`Manual intervention tool created for issue #${issueNumber}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create manual intervention tool for issue #${issueNumber}`, { error: errorMessage });
      throw error;
    }
  }

  /**
   * Implement recovery mechanisms for different workflow types
   * @param workflowType Workflow type to recover
   * @param issueNumber Issue number
   */
  public async recoverWorkflow(workflowType: string, issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Recovering ${workflowType} workflow for issue #${issueNumber}`);
      
      // Get issue details
      const issueData = await this.client.getIssue(issueNumber);
      
      // Add recovery comment
      await this.client.createIssueComment(
        issueNumber,
        `## Recovery Process\n\nRecovery process initiated for the ${workflowType} workflow. Attempting to resume normal operation.`
      );
      
      // Implement recovery logic based on workflow type
      switch (workflowType) {
        case 'pm':
          await this.recoverPMWorkflow(issueNumber);
          break;
        case 'qa':
          await this.recoverQAWorkflow(issueNumber);
          break;
        case 'feature':
          await this.recoverFeatureWorkflow(issueNumber);
          break;
        case 'audit':
          await this.recoverAuditWorkflow(issueNumber);
          break;
        default:
          await this.recoverGenericWorkflow(issueNumber);
      }
      
      // Remove error label
      await this.client.removeLabelFromIssue(issueNumber, 'stone-error');
      
      // Add recovery complete label
      await this.client.addLabelsToIssue(issueNumber, ['stone-recovery-complete']);
      
      this.logger.info(`Recovery completed for issue #${issueNumber}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to recover workflow for issue #${issueNumber}`, { error: errorMessage });
      throw error;
    }
  }

  /**
   * Recover a PM workflow
   * @param issueNumber Issue number
   */
  private async recoverPMWorkflow(issueNumber: number): Promise<void> {
    // For PM workflow, reset to initial state and retry
    // Remove any PM-specific labels
    try {
      await this.client.removeLabelFromIssue(issueNumber, 'stone-pm');
    } catch (error) {
      // Ignore errors if label doesn't exist
    }
    
    // Re-add the process label to trigger a fresh start
    await this.client.addLabelsToIssue(issueNumber, ['stone-process']);
    
    // Add recovery note
    await this.client.createIssueComment(
      issueNumber,
      `PM workflow recovery strategy: Reset workflow to initial state and retry processing.`
    );
  }

  /**
   * Recover a QA workflow
   * @param issueNumber Issue number
   */
  private async recoverQAWorkflow(issueNumber: number): Promise<void> {
    // For QA workflow, try to move to feature implementation if test generation failed
    try {
      await this.client.removeLabelFromIssue(issueNumber, 'stone-qa');
    } catch (error) {
      // Ignore errors if label doesn't exist
    }
    
    // Add feature-implement label to move forward
    await this.client.addLabelsToIssue(issueNumber, ['stone-feature-implement']);
    
    // Add recovery note
    await this.client.createIssueComment(
      issueNumber,
      `QA workflow recovery strategy: Proceeding to feature implementation phase. Tests can be added manually later if needed.`
    );
  }

  /**
   * Recover a feature workflow
   * @param issueNumber Issue number
   */
  private async recoverFeatureWorkflow(issueNumber: number): Promise<void> {
    // For feature workflow, check for common issues like branch conflicts
    
    // Add recovery note with guidance
    await this.client.createIssueComment(
      issueNumber,
      `Feature workflow recovery strategy: Please check for potential merge conflicts and ensure the feature branch is up to date with the main branch. Retrying feature implementation.`
    );
    
    // Retry by removing and re-adding label
    try {
      await this.client.removeLabelFromIssue(issueNumber, 'stone-feature-implement');
    } catch (error) {
      // Ignore errors if label doesn't exist
    }
    
    // Wait a short time before re-adding the label to avoid race conditions
    setTimeout(async () => {
      await this.client.addLabelsToIssue(issueNumber, ['stone-feature-implement']);
    }, 2000);
  }

  /**
   * Recover an audit workflow
   * @param issueNumber Issue number
   */
  private async recoverAuditWorkflow(issueNumber: number): Promise<void> {
    // For audit workflow, suggest manual audit
    
    // Add recovery note with guidance
    await this.client.createIssueComment(
      issueNumber,
      `Audit workflow recovery strategy: Automated audit failed. Recommending manual audit review. If code quality is acceptable, add \`stone-audit-passed\` label manually.`
    );
    
    // Remove audit label
    try {
      await this.client.removeLabelFromIssue(issueNumber, 'stone-audit');
    } catch (error) {
      // Ignore errors if label doesn't exist
    }
    
    // Add manual audit label
    await this.client.addLabelsToIssue(issueNumber, ['stone-manual-audit']);
  }

  /**
   * Recover a generic workflow
   * @param issueNumber Issue number
   */
  private async recoverGenericWorkflow(issueNumber: number): Promise<void> {
    // For generic workflow, reset to initial state
    // Get current labels
    const issueData = await this.client.getIssue(issueNumber);
    const currentLabels = issueData.data.labels.map((label: { name: string }) => label.name);
    
    // Remove all stone-* labels except for stone-process
    for (const label of currentLabels) {
      if (label.startsWith('stone-') && label !== 'stone-process') {
        try {
          await this.client.removeLabelFromIssue(issueNumber, label);
        } catch (error) {
          // Ignore errors if label doesn't exist
        }
      }
    }
    
    // Add stone-process label to restart the workflow
    if (!currentLabels.includes('stone-process')) {
      await this.client.addLabelsToIssue(issueNumber, ['stone-process']);
    }
    
    // Add recovery note
    await this.client.createIssueComment(
      issueNumber,
      `Generic workflow recovery strategy: Reset workflow to initial state and restart processing.`
    );
  }
}