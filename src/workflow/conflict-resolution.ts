import { GitService } from '../services/git-service';
import { GithubService } from '../services/github-service';
import { LoggerService } from '../services/logger-service';

/**
 * Result of conflict detection in a PR
 */
export interface ConflictDetectionResult {
  /**
   * Whether the PR has merge conflicts
   */
  hasConflicts: boolean;
  
  /**
   * List of files with conflicts
   */
  conflictingFiles: string[];
  
  /**
   * PR branch name
   */
  branchName: string;
  
  /**
   * Target branch name
   */
  targetBranch: string;
}

/**
 * Result of conflict resolution attempt
 */
export interface ConflictResolutionResult {
  /**
   * Whether the resolution was successful
   */
  success: boolean;
  
  /**
   * List of files that were resolved
   */
  resolvedFiles: string[];
  
  /**
   * Error message if resolution failed
   */
  error?: string;
  
  /**
   * Success message for PR comment
   */
  message?: string;
}

/**
 * Handles detection and resolution of merge conflicts in PRs
 */
export class ConflictResolution {
  /**
   * Creates an instance of ConflictResolution
   * @param gitService Service for Git operations
   * @param githubService Service for GitHub API operations
   * @param logger Service for logging
   */
  constructor(
    private gitService: GitService,
    private githubService: GithubService,
    private logger: LoggerService
  ) {}

  /**
   * Detects merge conflicts in a PR
   * @param prNumber PR number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @returns Conflict detection result
   */
  async detectConflicts(
    prNumber: number, 
    repoOwner: string, 
    repoName: string
  ): Promise<ConflictDetectionResult> {
    try {
      this.logger.info(`Checking PR #${prNumber} for merge conflicts`, { 
        prNumber, 
        repoOwner, 
        repoName 
      });

      // Get PR details
      const pr = await this.githubService.getPullRequest(prNumber, repoOwner, repoName);
      const branchName = pr.head.ref;
      const targetBranch = pr.base.ref;
      
      // Build repo path
      const repoPath = `/tmp/${repoOwner}-${repoName}-${prNumber}`;
      const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`;
      
      // Clone repository if needed (or use cached path)
      await this.gitService.cloneRepository(repoUrl);
      
      // Check merge status
      const mergeStatus = await this.gitService.checkMergeStatus(
        repoPath, 
        branchName, 
        targetBranch
      );
      
      if (mergeStatus.canMerge) {
        this.logger.info(`PR #${prNumber} can be merged without conflicts`, { prNumber });
        return {
          hasConflicts: false,
          conflictingFiles: [],
          branchName,
          targetBranch
        };
      } else {
        this.logger.warn(`PR #${prNumber} has merge conflicts`, { 
          prNumber, 
          conflictingFiles: mergeStatus.conflictingFiles 
        });
        return {
          hasConflicts: true,
          conflictingFiles: mergeStatus.conflictingFiles,
          branchName,
          targetBranch
        };
      }
    } catch (error: any) {
      this.logger.error(
        `Error detecting conflicts for PR #${prNumber}`, 
        error,
        { prNumber, repoOwner, repoName }
      );
      throw new Error(`Failed to detect conflicts: ${error.message}`);
    }
  }

  /**
   * Attempts to resolve merge conflicts in a PR
   * @param prNumber PR number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @param conflictingFiles List of files with conflicts
   * @returns Conflict resolution result
   */
  async resolveConflicts(
    prNumber: number, 
    repoOwner: string, 
    repoName: string,
    conflictingFiles: string[]
  ): Promise<ConflictResolutionResult> {
    try {
      this.logger.info(`Attempting to resolve conflicts in PR #${prNumber}`, { 
        prNumber, 
        conflictingFiles 
      });

      // Get PR details
      const pr = await this.githubService.getPullRequest(prNumber, repoOwner, repoName);
      const branchName = pr.head.ref;
      const targetBranch = pr.base.ref;
      
      // Build repo path and URL
      const repoPath = `/tmp/${repoOwner}-${repoName}-${prNumber}`;
      const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`;
      
      // Clone repository
      await this.gitService.cloneRepository(repoUrl);
      
      // Checkout PR branch
      await this.gitService.checkoutBranch(repoPath, branchName);
      
      // Rebase onto target branch
      await this.gitService.rebaseBranch(repoPath, targetBranch);
      
      // Resolve conflicts
      const resolutionResult = await this.gitService.resolveConflicts(
        repoPath, 
        conflictingFiles
      );
      
      if (resolutionResult.success) {
        // Push resolved changes
        await this.gitService.pushChanges(repoPath, branchName);
        
        // Update PR
        await this.githubService.updatePullRequest(prNumber, repoOwner, repoName, {
          body: `Updated branch with resolved merge conflicts.`
        });
        
        this.logger.info(`Successfully resolved conflicts in PR #${prNumber}`, { 
          prNumber, 
          resolvedFiles: resolutionResult.resolvedFiles 
        });
        
        return {
          success: true,
          resolvedFiles: resolutionResult.resolvedFiles,
          message: `Successfully resolved merge conflicts in ${resolutionResult.resolvedFiles.length} files.`
        };
      } else {
        // If automatic resolution failed, comment on PR
        const failureMessage = `Could not automatically resolve conflicts in PR #${prNumber}. ${resolutionResult.error}`;
        
        await this.githubService.commentOnPullRequest(
          prNumber, 
          repoOwner, 
          repoName, 
          `Failed to automatically resolve merge conflicts. Please resolve conflicts manually.\n\nDetails: ${resolutionResult.error}`
        );
        
        this.logger.warn(failureMessage, { prNumber, error: resolutionResult.error });
        
        return {
          success: false,
          resolvedFiles: [],
          error: resolutionResult.error
        };
      }
    } catch (error: any) {
      const errorMessage = `Error resolving conflicts for PR #${prNumber}: ${error.message}`;
      
      this.logger.error(errorMessage, error, { prNumber, repoOwner, repoName });
      
      // Comment on PR about the failure
      await this.githubService.commentOnPullRequest(
        prNumber, 
        repoOwner, 
        repoName, 
        `Error while attempting to resolve merge conflicts automatically: ${error.message}\n\nPlease resolve conflicts manually.`
      );
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Updates PR status with resolution results
   * @param prNumber PR number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @param resolutionResult Result of conflict resolution
   */
  async updatePRStatus(
    prNumber: number, 
    repoOwner: string, 
    repoName: string,
    resolutionResult: ConflictResolutionResult
  ): Promise<void> {
    try {
      if (resolutionResult.success) {
        // Add success comment
        await this.githubService.commentOnPullRequest(
          prNumber, 
          repoOwner, 
          repoName, 
          `✅ Stone automatically resolved merge conflicts in this PR.\n\n${resolutionResult.message}`
        );
        
        // Update PR with success status
        await this.githubService.updatePullRequest(prNumber, repoOwner, repoName, {
          state: 'open',
          mergeable_state: 'clean'
        });
        
        this.logger.info(`Updated PR #${prNumber} status after successful conflict resolution`, { prNumber });
      } else {
        // Add failure comment
        await this.githubService.commentOnPullRequest(
          prNumber, 
          repoOwner, 
          repoName, 
          `⚠️ Stone could not automatically resolve merge conflicts in this PR.\n\nPlease resolve conflicts manually.\n\nDetails: ${resolutionResult.error}`
        );
        
        // Add label for manual attention
        await this.githubService.addLabelToPullRequest(
          prNumber, 
          repoOwner, 
          repoName, 
          'needs-manual-merge'
        );
        
        this.logger.warn(`Updated PR #${prNumber} status after failed conflict resolution`, { 
          prNumber, 
          error: resolutionResult.error 
        });
      }
    } catch (error: any) {
      this.logger.error(`Error updating PR #${prNumber} status`, error, { prNumber });
      throw new Error(`Failed to update PR status: ${error.message}`);
    }
  }
}