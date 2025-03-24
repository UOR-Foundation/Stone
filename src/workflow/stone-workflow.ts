import { ConflictResolution, ConflictDetectionResult, ConflictResolutionResult } from './conflict-resolution';
import { FeedbackHandler, FeedbackAnalysisResult, FeedbackIssueCreationResult, FeedbackRoutingResult, FeedbackPrioritizationResult } from './feedback-handler';
import { DocumentationManager, DocumentationGenerationResult, DocumentationVerificationResult, DocumentationPRResult } from './docs-manager';
import { ErrorRecovery, ErrorState, RecoveryResult } from './error-recovery';
import { LoggerService } from '../services/logger-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Main workflow class that integrates all advanced features
 */
export class StoneWorkflow {
  /**
   * Creates an instance of StoneWorkflow
   * @param conflictResolution Conflict resolution component
   * @param feedbackHandler Feedback handler component
   * @param documentationManager Documentation manager component
   * @param errorRecovery Error recovery component
   * @param logger Logger service instance
   */
  constructor(
    private conflictResolution: ConflictResolution,
    private feedbackHandler: FeedbackHandler,
    private documentationManager: DocumentationManager,
    private errorRecovery: ErrorRecovery,
    private logger: LoggerService
  ) {}

  /**
   * Detects and resolves merge conflicts in a pull request
   * @param prNumber PR number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @returns Result of conflict resolution
   */
  async handleMergeConflicts(
    prNumber: number,
    repoOwner: string,
    repoName: string
  ): Promise<ConflictResolutionResult> {
    const workflowId = `conflict-${prNumber}-${uuidv4().slice(0, 8)}`;
    
    try {
      this.logger.info(`Starting merge conflict handling for PR #${prNumber}`, {
        prNumber,
        repoOwner,
        repoName,
        workflowId
      });

      // Step 1: Detect conflicts
      const detectionResult = await this.conflictResolution.detectConflicts(
        prNumber,
        repoOwner,
        repoName
      );
      
      if (!detectionResult.hasConflicts) {
        this.logger.info(`No conflicts detected in PR #${prNumber}`, { prNumber });
        return {
          success: true,
          resolvedFiles: [],
          message: 'No conflicts detected'
        };
      }
      
      this.logger.info(`Conflicts detected in PR #${prNumber}: ${detectionResult.conflictingFiles.join(', ')}`, {
        prNumber,
        conflictingFiles: detectionResult.conflictingFiles
      });
      
      // Step 2: Resolve conflicts
      const resolutionResult = await this.conflictResolution.resolveConflicts(
        prNumber,
        repoOwner,
        repoName,
        detectionResult.conflictingFiles
      );
      
      // Step 3: Update PR status
      await this.conflictResolution.updatePRStatus(
        prNumber,
        repoOwner,
        repoName,
        resolutionResult
      );
      
      return resolutionResult;
    } catch (error: any) {
      this.logger.error(`Error handling merge conflicts for PR #${prNumber}`, error, {
        prNumber,
        repoOwner,
        repoName,
        workflowId
      });
      
      // Capture error state for potential recovery
      await this.errorRecovery.captureErrorState(workflowId, error, {
        issueNumber: prNumber,
        repoOwner,
        repoName,
        currentStep: 'merge-conflict-resolution'
      });
      
      return {
        success: false,
        resolvedFiles: [],
        error: `Failed to handle merge conflicts: ${error.message}`
      };
    }
  }

  /**
   * Processes feedback from PR comments
   * @param prNumber PR number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @param teamMappings Mapping of affected areas to teams
   * @returns Results of feedback processing
   */
  async handleFeedback(
    prNumber: number,
    repoOwner: string,
    repoName: string,
    teamMappings: Record<string, string>
  ): Promise<{
    analysis: FeedbackAnalysisResult;
    issues: FeedbackIssueCreationResult;
    routing: FeedbackRoutingResult;
    prioritization: FeedbackPrioritizationResult;
  }> {
    const workflowId = `feedback-${prNumber}-${uuidv4().slice(0, 8)}`;
    
    try {
      this.logger.info(`Starting feedback handling for PR #${prNumber}`, {
        prNumber,
        repoOwner,
        repoName,
        workflowId
      });

      // Step 1: Analyze feedback from PR comments
      const analysis = await this.feedbackHandler.analyzeFeedback(
        prNumber,
        repoOwner,
        repoName
      );
      
      if (analysis.actionItems.length === 0) {
        this.logger.info(`No actionable feedback found in PR #${prNumber}`, { prNumber });
        return {
          analysis,
          issues: { createdIssues: [], summary: 'No issues created' },
          routing: { routedIssues: [], summary: 'No issues routed' },
          prioritization: { prioritizedIssues: [], summary: 'No issues prioritized' }
        };
      }
      
      // Step 2: Create issues from feedback
      const issues = await this.feedbackHandler.createFeedbackIssues(
        analysis.actionItems,
        prNumber,
        repoOwner,
        repoName
      );
      
      // Get issue numbers
      const issueNumbers = issues.createdIssues.map(issue => issue.issueNumber);
      
      // Step 3: Route issues to appropriate teams
      const routing = await this.feedbackHandler.routeFeedbackToTeams(
        analysis.actionItems,
        issueNumbers,
        repoOwner,
        repoName,
        teamMappings
      );
      
      // Step 4: Prioritize issues
      const prioritization = await this.feedbackHandler.prioritizeFeedback(
        analysis.actionItems,
        issueNumbers,
        repoOwner,
        repoName
      );
      
      return {
        analysis,
        issues,
        routing,
        prioritization
      };
    } catch (error: any) {
      this.logger.error(`Error handling feedback for PR #${prNumber}`, error, {
        prNumber,
        repoOwner,
        repoName,
        workflowId
      });
      
      // Capture error state for potential recovery
      await this.errorRecovery.captureErrorState(workflowId, error, {
        issueNumber: prNumber,
        repoOwner,
        repoName,
        currentStep: 'feedback-handling'
      });
      
      throw new Error(`Failed to handle feedback: ${error.message}`);
    }
  }

  /**
   * Manages documentation for a package
   * @param packagePath Path to the package
   * @param requiredSections Required documentation sections
   * @param issueNumber Related issue number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @returns Results of documentation management
   */
  async handleDocumentation(
    packagePath: string,
    requiredSections: string[],
    issueNumber: number,
    repoOwner: string,
    repoName: string
  ): Promise<{
    generation: DocumentationGenerationResult;
    verification: DocumentationVerificationResult;
    pr?: DocumentationPRResult;
  }> {
    const packageName = packagePath.split('/').pop() || 'unknown';
    const workflowId = `documentation-${packageName}-${uuidv4().slice(0, 8)}`;
    
    try {
      this.logger.info(`Starting documentation handling for package ${packageName}`, {
        packagePath,
        repoOwner,
        repoName,
        workflowId
      });

      // Step 1: Generate documentation from source code
      const generation = await this.documentationManager.generateDocumentation(packagePath);
      
      // Step 2: Verify documentation meets requirements
      const verification = await this.documentationManager.verifyDocumentation(
        packagePath,
        requiredSections
      );
      
      // Return early if no docs were generated
      if (generation.generatedFiles.length === 0) {
        return {
          generation,
          verification
        };
      }
      
      // Step 3: Create PR for documentation changes
      const pr = await this.documentationManager.createDocumentationPR(
        packageName,
        generation.generatedFiles,
        issueNumber,
        repoOwner,
        repoName
      );
      
      return {
        generation,
        verification,
        pr
      };
    } catch (error: any) {
      this.logger.error(`Error handling documentation for package ${packageName}`, error, {
        packagePath,
        repoOwner,
        repoName,
        workflowId
      });
      
      // Capture error state for potential recovery
      await this.errorRecovery.captureErrorState(workflowId, error, {
        issueNumber,
        repoOwner,
        repoName,
        currentStep: 'documentation-management',
        stepData: { packagePath, packageName }
      });
      
      throw new Error(`Failed to handle documentation: ${error.message}`);
    }
  }

  /**
   * Attempts to recover from a workflow error
   * @param workflowId Unique workflow ID
   * @returns Result of recovery attempt
   */
  async handleErrorRecovery(workflowId: string): Promise<RecoveryResult> {
    try {
      this.logger.info(`Starting error recovery for workflow ${workflowId}`, { workflowId });

      // Attempt recovery
      const recoveryResult = await this.errorRecovery.attemptRecovery(workflowId);
      
      // Clear error state if recovery was successful
      if (recoveryResult.success) {
        await this.errorRecovery.clearErrorState(workflowId);
      }
      
      return recoveryResult;
    } catch (error: any) {
      this.logger.error(`Error during recovery for workflow ${workflowId}`, error, { workflowId });
      
      return {
        success: false,
        recoveryStrategy: 'none',
        message: `Error during recovery attempt: ${error.message}`
      };
    }
  }

  /**
   * Gets the current error state for a workflow
   * @param workflowId Unique workflow ID
   * @returns Error state or null if not found
   */
  async getWorkflowErrorState(workflowId: string): Promise<ErrorState | null> {
    return this.errorRecovery.getErrorState(workflowId);
  }
}