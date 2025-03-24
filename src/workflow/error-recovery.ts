import { FileSystemService } from '../services/filesystem-service';
import { GithubService } from '../services/github-service';
import { LoggerService } from '../services/logger-service';
import { NotificationService } from '../services/notification-service';
import * as path from 'path';

/**
 * Error state information
 */
export interface ErrorState {
  /**
   * Unique workflow ID
   */
  id: string;
  
  /**
   * Error that occurred
   */
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  
  /**
   * Context in which the error occurred
   */
  context: {
    issueNumber?: number;
    repoOwner?: string;
    repoName?: string;
    currentStep?: string;
    stepData?: any;
  };
  
  /**
   * Timestamp when the error occurred
   */
  timestamp: number;
  
  /**
   * Number of recovery attempts
   */
  recoveryAttempts: number;
}

/**
 * Result of recovery attempt
 */
export interface RecoveryResult {
  /**
   * Whether the recovery was successful
   */
  success: boolean;
  
  /**
   * The strategy used for recovery
   */
  recoveryStrategy: 'simple-retry' | 'advanced-retry' | 'team-notification' | 'none';
  
  /**
   * Result message
   */
  message: string;
}

/**
 * Provides error recovery capabilities for workflows
 */
export class ErrorRecovery {
  /**
   * Directory where error states are stored
   */
  private readonly errorStatesDir = '.github/stone/errors';
  
  /**
   * List of temporary error patterns
   */
  private readonly temporaryErrorPatterns = [
    /rate limit/i,
    /timeout/i,
    /temporarily unavailable/i,
    /too many requests/i,
    /connection reset/i,
    /network error/i,
    /socket hang up/i,
    /ECONNRESET/,
    /ETIMEDOUT/,
    /ECONNREFUSED/
  ];

  /**
   * Creates an instance of ErrorRecovery
   * @param fsService Service for file system operations
   * @param githubService Service for GitHub API operations
   * @param logger Service for logging
   * @param notificationService Service for sending notifications
   */
  constructor(
    private fsService: FileSystemService,
    private githubService: GithubService,
    private logger: LoggerService,
    private notificationService: NotificationService
  ) {}

  /**
   * Captures and saves the error state
   * @param workflowId Unique workflow ID
   * @param error The error that occurred
   * @param context Context in which the error occurred
   * @returns The captured error state
   */
  async captureErrorState(
    workflowId: string,
    error: Error,
    context: {
      issueNumber?: number;
      repoOwner?: string;
      repoName?: string;
      currentStep?: string;
      stepData?: any;
    }
  ): Promise<ErrorState> {
    try {
      this.logger.error(
        `Capturing error state for workflow ${workflowId}`,
        error,
        { workflowId, context }
      );

      const errorState: ErrorState = {
        id: workflowId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context,
        timestamp: Date.now(),
        recoveryAttempts: 0
      };
      
      // Ensure error states directory exists
      await this.fsService.ensureDirectoryExists(this.errorStatesDir);
      
      // Save error state to file
      const errorStateFile = path.join(this.errorStatesDir, `${workflowId}.json`);
      await this.fsService.writeFile(
        errorStateFile,
        JSON.stringify(errorState, null, 2)
      );
      
      this.logger.info(`Error state saved to ${errorStateFile}`, { workflowId });
      
      return errorState;
    } catch (error: any) {
      this.logger.error(
        `Failed to save error state for workflow ${workflowId}`,
        error,
        { workflowId }
      );
      throw new Error(`Failed to write error state: ${error.message}`);
    }
  }

  /**
   * Retrieves an error state
   * @param workflowId Unique workflow ID
   * @returns The error state, or null if not found
   */
  async getErrorState(workflowId: string): Promise<ErrorState | null> {
    try {
      const errorStateFile = path.join(this.errorStatesDir, `${workflowId}.json`);
      const content = await this.fsService.readFile(errorStateFile);
      
      return JSON.parse(content) as ErrorState;
    } catch (error: any) {
      this.logger.warn(`No error state found for workflow ${workflowId}`, { workflowId });
      return null;
    }
  }

  /**
   * Attempts to recover from an error
   * @param workflowId Unique workflow ID
   * @returns Recovery result
   */
  async attemptRecovery(workflowId: string): Promise<RecoveryResult> {
    try {
      this.logger.info(`Attempting recovery for workflow ${workflowId}`, { workflowId });

      // Get error state
      const errorState = await this.getErrorState(workflowId);
      
      if (!errorState) {
        this.logger.warn(`No error state found for workflow ${workflowId}`, { workflowId });
        return {
          success: false,
          recoveryStrategy: 'none',
          message: `No error state found for workflow ${workflowId}`
        };
      }
      
      // Check if error is recoverable
      if (!this.isRecoverable(errorState.error)) {
        this.logger.error(`Permanent error detected, cannot recover automatically for workflow ${workflowId}`, 
        new Error(`Permanent error: ${errorState.error.message}`));
        
        // Notify team of unrecoverable error
        await this.notifyTeam(errorState);
        
        return {
          success: false,
          recoveryStrategy: 'team-notification',
          message: `Permanent error detected: ${errorState.error.message}`
        };
      }
      
      // Implement graduated recovery strategy based on attempts
      switch (errorState.recoveryAttempts) {
        case 0:
          // First attempt: simple retry
          return await this.simpleRetry(errorState);
        
        case 1:
          // Second attempt: advanced retry with more context
          return await this.advancedRetry(errorState);
        
        default:
          // More than two attempts: notify team
          return await this.escalateToTeam(errorState);
      }
    } catch (error: any) {
      this.logger.error(
        `Error during recovery attempt for workflow ${workflowId}`,
        error,
        { workflowId }
      );
      
      return {
        success: false,
        recoveryStrategy: 'none',
        message: `Error during recovery: ${error.message}`
      };
    }
  }

  /**
   * Clears an error state after successful recovery
   * @param workflowId Unique workflow ID
   */
  async clearErrorState(workflowId: string): Promise<void> {
    try {
      const errorStateFile = path.join(this.errorStatesDir, `${workflowId}.json`);
      await this.fsService.deleteFile(errorStateFile);
      
      this.logger.info(`Cleared error state for workflow ${workflowId}`, { workflowId });
    } catch (error: any) {
      this.logger.error(
        `Failed to clear error state for workflow ${workflowId}`,
        error,
        { workflowId }
      );
      throw new Error(`Failed to delete error state file: ${error.message}`);
    }
  }

  /**
   * Determines if an error is recoverable
   * @param error The error to check
   * @returns Whether the error is recoverable
   */
  isRecoverable(error: { name: string; message: string }): boolean {
    // Check against known temporary error patterns
    return this.temporaryErrorPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Performs a simple retry
   * @param errorState The error state
   * @returns Recovery result
   */
  private async simpleRetry(errorState: ErrorState): Promise<RecoveryResult> {
    try {
      this.logger.info(`Attempting simple recovery for workflow ${errorState.id}`, {
        workflowId: errorState.id,
        attempt: errorState.recoveryAttempts + 1
      });

      // Update recovery attempts
      errorState.recoveryAttempts += 1;
      
      // Save updated error state
      const errorStateFile = path.join(this.errorStatesDir, `${errorState.id}.json`);
      await this.fsService.writeFile(
        errorStateFile,
        JSON.stringify(errorState, null, 2)
      );
      
      return {
        success: true,
        recoveryStrategy: 'simple-retry',
        message: `Simple retry scheduled for workflow ${errorState.id}`
      };
    } catch (error: any) {
      this.logger.error(
        `Simple retry failed for workflow ${errorState.id}`,
        error,
        { workflowId: errorState.id }
      );
      
      return {
        success: false,
        recoveryStrategy: 'simple-retry',
        message: `Simple retry failed: ${error.message}`
      };
    }
  }

  /**
   * Performs an advanced retry with more context
   * @param errorState The error state
   * @returns Recovery result
   */
  private async advancedRetry(errorState: ErrorState): Promise<RecoveryResult> {
    try {
      this.logger.info(`Attempting advanced recovery for workflow ${errorState.id}`, {
        workflowId: errorState.id,
        attempt: errorState.recoveryAttempts + 1
      });

      // Update recovery attempts
      errorState.recoveryAttempts += 1;
      
      // Save updated error state
      const errorStateFile = path.join(this.errorStatesDir, `${errorState.id}.json`);
      await this.fsService.writeFile(
        errorStateFile,
        JSON.stringify(errorState, null, 2)
      );
      
      // Check GitHub workflow status if available
      if (errorState.context.repoOwner && errorState.context.repoName) {
        const status = await this.githubService.getWorkflowStatus(
          errorState.context.repoOwner,
          errorState.context.repoName,
          errorState.id
        );
        
        this.logger.info(`GitHub workflow status: ${status}`, {
          workflowId: errorState.id,
          status
        });
      }
      
      return {
        success: true,
        recoveryStrategy: 'advanced-retry',
        message: `Advanced retry scheduled for workflow ${errorState.id}`
      };
    } catch (error: any) {
      this.logger.error(
        `Advanced retry failed for workflow ${errorState.id}`,
        error,
        { workflowId: errorState.id }
      );
      
      return {
        success: false,
        recoveryStrategy: 'advanced-retry',
        message: `Advanced retry failed: ${error.message}`
      };
    }
  }

  /**
   * Escalates error to team after multiple failed attempts
   * @param errorState The error state
   * @returns Recovery result
   */
  private async escalateToTeam(errorState: ErrorState): Promise<RecoveryResult> {
    try {
      this.logger.warn(`Recovery failed after multiple attempts for workflow ${errorState.id}`, {
        workflowId: errorState.id,
        attempts: errorState.recoveryAttempts
      });

      // Update recovery attempts
      errorState.recoveryAttempts += 1;
      
      // Save updated error state
      const errorStateFile = path.join(this.errorStatesDir, `${errorState.id}.json`);
      await this.fsService.writeFile(
        errorStateFile,
        JSON.stringify(errorState, null, 2)
      );
      
      // Notify team
      await this.notifyTeam(errorState);
      
      return {
        success: false,
        recoveryStrategy: 'team-notification',
        message: `Escalated to team after ${errorState.recoveryAttempts - 1} failed recovery attempts`
      };
    } catch (error: any) {
      this.logger.error(
        `Team notification failed for workflow ${errorState.id}`,
        error,
        { workflowId: errorState.id }
      );
      
      return {
        success: false,
        recoveryStrategy: 'team-notification',
        message: `Team notification failed: ${error.message}`
      };
    }
  }

  /**
   * Notifies team about an error
   * @param errorState The error state
   */
  private async notifyTeam(errorState: ErrorState): Promise<void> {
    try {
      this.logger.info(`Notifying team about error in workflow ${errorState.id}`, {
        workflowId: errorState.id
      });

      // Add comment to issue if available
      if (errorState.context.issueNumber && 
          errorState.context.repoOwner && 
          errorState.context.repoName) {
        
        const errorMessage = `## Workflow Error

An error occurred in Stone workflow:

- **Workflow ID:** ${errorState.id}
- **Step:** ${errorState.context.currentStep || 'Unknown'}
- **Error:** ${errorState.error.message}
- **Recovery Attempts:** ${errorState.recoveryAttempts}
- **Timestamp:** ${new Date(errorState.timestamp).toISOString()}

Please check the logs and resolve the issue manually.`;

        await this.githubService.commentOnIssue(
          errorState.context.issueNumber,
          errorState.context.repoOwner,
          errorState.context.repoName,
          errorMessage
        );
      }
      
      // Send alert to team
      await this.notificationService.sendAlert(
        `Stone Workflow Error: ${errorState.id}`,
        `Error: ${errorState.error.message}\nStep: ${errorState.context.currentStep || 'Unknown'}\nRecovery Attempts: ${errorState.recoveryAttempts}`,
        ['stone-maintainers'],
        'error'
      );
      
      this.logger.info(`Team notification sent for workflow ${errorState.id}`, {
        workflowId: errorState.id
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to notify team about error in workflow ${errorState.id}`,
        error,
        { workflowId: errorState.id }
      );
      
      throw new Error(`Failed to notify team: ${error.message}`);
    }
  }
}