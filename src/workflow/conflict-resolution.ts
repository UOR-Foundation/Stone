import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { LoggerService } from '../services/logger-service';
import { GitService, GitCommandResult } from '../services/git-service';

/**
 * Interface representing a file with merge conflicts
 */
export interface ConflictFile {
  path: string;
  content: string;
}

/**
 * Interface representing the result of a conflict detection
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflictFiles: ConflictFile[];
  branchName: string;
}

/**
 * Handles git merge conflict resolution
 */
export class ConflictResolution {
  constructor(
    private client: GitHubClient,
    private config: StoneConfig,
    private logger: LoggerService,
    private gitService: GitService
  ) {}

  /**
   * Detect conflicts between a feature branch and main branch
   * @param issueNumber Issue number to check for conflicts
   * @returns Result of conflict detection
   */
  public async detectConflicts(issueNumber: number): Promise<ConflictDetectionResult> {
    try {
      this.logger.info(`Detecting conflicts for issue #${issueNumber}`);
      
      // Get issue details
      const issueData = await this.client.getIssue(issueNumber);
      
      // Determine branch name based on issue number
      const branchName = `${this.config.branches?.prefix || 'feature/'}${issueNumber}`;
      const mainBranch = this.config.branches?.main || 'main';
      
      // Get the repository path from config
      const repoPath = this.config.repository.path || process.cwd();
      
      // Find the common ancestor of the two branches
      const mergeBaseResult = await this.gitService.execGitCommand(
        repoPath,
        ['merge-base', mainBranch, branchName]
      );
      
      const commonAncestor = mergeBaseResult.output;
      
      // Use git merge-tree to simulate merge and detect conflicts
      const mergeTreeResult = await this.gitService.execGitCommand(
        repoPath,
        ['merge-tree', commonAncestor, mainBranch, branchName]
      );
      
      // Check for conflict markers in the output
      const hasConflicts = mergeTreeResult.output.includes('<<<<<<<') || 
                           mergeTreeResult.output.includes('=======') ||
                           mergeTreeResult.output.includes('>>>>>>>');
      
      let conflictFiles: ConflictFile[] = [];
      
      if (hasConflicts) {
        // Get list of conflicting files
        const diffResult = await this.gitService.execGitCommand(
          repoPath,
          ['diff', '--name-only', '--diff-filter=U']
        );
        
        // If the diff command didn't work (since we haven't actually started a merge),
        // use ls-files to get the affected files between branches
        const filePaths = diffResult.output ? 
          diffResult.output.split('\n').filter(Boolean) :
          await this.getChangedFiles(repoPath, mainBranch, branchName);
        
        // Get the content of each conflicting file
        for (const filePath of filePaths) {
          try {
            const fileContent = await this.getFileContent(repoPath, filePath, branchName);
            conflictFiles.push({
              path: filePath,
              content: fileContent
            });
          } catch (fileError) {
            this.logger.debug(`Error getting content for file ${filePath}`, { error: fileError });
          }
        }
      }
      
      return {
        hasConflicts,
        conflictFiles,
        branchName
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to detect conflicts for issue #${issueNumber}`, { error: errorMessage });
      throw new Error(`Conflict detection failed: ${errorMessage}`);
    }
  }

  /**
   * Get list of files changed between two branches
   * @param repoPath Repository path
   * @param mainBranch Main branch name
   * @param featureBranch Feature branch name
   * @returns Array of file paths
   */
  private async getChangedFiles(repoPath: string, mainBranch: string, featureBranch: string): Promise<string[]> {
    const diffResult = await this.gitService.execGitCommand(
      repoPath,
      ['diff', '--name-only', `${mainBranch}...${featureBranch}`]
    );
    
    return diffResult.output.split('\n').filter(Boolean);
  }

  /**
   * Get content of a file from a specific branch
   * @param repoPath Repository path
   * @param filePath File path
   * @param branchName Branch name
   * @returns File content
   */
  private async getFileContent(repoPath: string, filePath: string, branchName: string): Promise<string> {
    const catFileResult = await this.gitService.execGitCommand(
      repoPath,
      ['show', `${branchName}:${filePath}`]
    );
    
    return catFileResult.output;
  }

  /**
   * Attempt to automatically resolve conflicts
   * @param issueNumber Issue number
   * @param conflictFiles Files with conflicts
   * @param branchName Feature branch name
   * @returns True if conflicts were resolved, false otherwise
   */
  public async attemptAutomaticResolution(
    issueNumber: number,
    conflictFiles: ConflictFile[],
    branchName: string
  ): Promise<boolean> {
    try {
      this.logger.info(`Attempting automatic conflict resolution for issue #${issueNumber}`);
      const repoPath = this.config.repository.path || process.cwd();
      const mainBranch = this.config.branches?.main || 'main';
      
      // Ensure we're on the feature branch
      await this.gitService.execGitCommand(repoPath, ['checkout', branchName]);
      
      // Try to rebase on main
      try {
        await this.gitService.execGitCommand(repoPath, ['rebase', mainBranch]);
        // If we get here, rebase succeeded with no conflicts
        return true;
      } catch (rebaseError) {
        // Rebase failed, likely due to conflicts
        this.logger.debug('Rebase failed, attempting to resolve conflicts', { error: rebaseError });
        
        // Abort the rebase to try our custom resolution
        await this.gitService.execGitCommand(repoPath, ['rebase', '--abort']);
        
        // Try merge instead
        try {
          await this.gitService.execGitCommand(repoPath, ['merge', mainBranch]);
          // If we get here, merge succeeded with no conflicts
          return true;
        } catch (mergeError) {
          // Merge failed, attempt to resolve conflicts
          this.logger.debug('Merge failed, attempting to resolve conflicts', { error: mergeError });
          
          // For each conflicting file, attempt to resolve
          let allResolved = true;
          for (const file of conflictFiles) {
            const resolved = await this.resolveFileConflict(repoPath, file);
            if (!resolved) {
              allResolved = false;
            }
          }
          
          if (allResolved) {
            // Commit the resolved conflicts
            await this.gitService.execGitCommand(
              repoPath,
              ['commit', '-m', `Resolve conflicts with ${mainBranch} for issue #${issueNumber}`]
            );
            return true;
          } else {
            // Abort the merge since we couldn't resolve all conflicts
            await this.gitService.execGitCommand(repoPath, ['merge', '--abort']);
            return false;
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to automatically resolve conflicts for issue #${issueNumber}`, { error: errorMessage });
      return false;
    }
  }

  /**
   * Attempt to resolve conflicts in a single file
   * @param repoPath Repository path
   * @param file Conflicting file
   * @returns True if conflicts were resolved, false otherwise
   */
  private async resolveFileConflict(repoPath: string, file: ConflictFile): Promise<boolean> {
    try {
      // Simple strategy: If conflict markers exist, try to resolve by accepting "ours" or "theirs"
      // In a more sophisticated implementation, this would use more advanced conflict resolution strategies
      
      // Check if the file has conflict markers
      const catFileResult = await this.gitService.execGitCommand(
        repoPath,
        ['cat-file', '-p', `:${file.path}`]
      );
      
      const content = catFileResult.output;
      
      if (content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>')) {
        // Try to resolve with "ours" first
        await this.gitService.execGitCommand(repoPath, ['checkout', '--ours', file.path]);
        
        // Add the resolved file
        await this.gitService.execGitCommand(repoPath, ['add', file.path]);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.debug(`Failed to resolve conflicts in file ${file.path}`, { error });
      return false;
    }
  }

  /**
   * Track merge status for an issue
   * @param issueNumber Issue number
   */
  public async trackMergeStatus(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Tracking merge status for issue #${issueNumber}`);
      
      // Get issue details
      const issueData = await this.client.getIssue(issueNumber);
      
      // Determine branch name based on issue number
      const branchName = `${this.config.branches?.prefix || 'feature/'}${issueNumber}`;
      const mainBranch = this.config.branches?.main || 'main';
      
      // Get the repository path from config
      const repoPath = this.config.repository.path || process.cwd();
      
      // Get branch status
      const branchExists = await this.checkBranchExists(repoPath, branchName);
      const behindCount = branchExists ? 
        await this.getBranchBehindCount(repoPath, branchName, mainBranch) : 0;
      
      // Check if there are open PRs for this issue
      const prStatus = await this.getPullRequestStatus(issueNumber);
      
      // Generate merge status report
      const statusReport = `## Merge Status Report
      
Issue #${issueNumber} - ${issueData.data.title}

* Branch: ${branchName} ${branchExists ? 'exists' : 'does not exist'}
* Branch is ${behindCount} commit(s) behind ${mainBranch}
* Pull request: ${prStatus.hasPR ? `#${prStatus.prNumber} (${prStatus.status})` : 'No open PR found'}
* Merge conflicts: ${await this.hasMergeConflicts(repoPath, branchName, mainBranch) ? 'Yes' : 'No'}

Last updated: ${new Date().toISOString()}
`;
      
      // Add status report to issue
      await this.client.createIssueComment(issueNumber, statusReport);
      
      this.logger.info(`Merge status tracked for issue #${issueNumber}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to track merge status for issue #${issueNumber}`, { error: errorMessage });
      throw new Error(`Merge status tracking failed: ${errorMessage}`);
    }
  }

  /**
   * Check if a branch exists
   * @param repoPath Repository path
   * @param branchName Branch name
   * @returns True if branch exists, false otherwise
   */
  private async checkBranchExists(repoPath: string, branchName: string): Promise<boolean> {
    try {
      await this.gitService.execGitCommand(repoPath, ['rev-parse', '--verify', branchName]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the number of commits a branch is behind another
   * @param repoPath Repository path
   * @param branchName Branch name to check
   * @param baseBranch Base branch to compare against
   * @returns Number of commits behind
   */
  private async getBranchBehindCount(repoPath: string, branchName: string, baseBranch: string): Promise<number> {
    try {
      const result = await this.gitService.execGitCommand(
        repoPath,
        ['rev-list', '--count', `${branchName}..${baseBranch}`]
      );
      
      return parseInt(result.output, 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if a branch has merge conflicts with another
   * @param repoPath Repository path
   * @param branchName Branch name to check
   * @param baseBranch Base branch to compare against
   * @returns True if conflicts exist, false otherwise
   */
  private async hasMergeConflicts(repoPath: string, branchName: string, baseBranch: string): Promise<boolean> {
    if (!await this.checkBranchExists(repoPath, branchName)) {
      return false;
    }
    
    try {
      // Find common ancestor
      const mergeBaseResult = await this.gitService.execGitCommand(
        repoPath,
        ['merge-base', baseBranch, branchName]
      );
      
      const commonAncestor = mergeBaseResult.output;
      
      // Simulate merge
      const mergeTreeResult = await this.gitService.execGitCommand(
        repoPath,
        ['merge-tree', commonAncestor, baseBranch, branchName]
      );
      
      // Check for conflict markers
      return mergeTreeResult.output.includes('<<<<<<<') || 
             mergeTreeResult.output.includes('=======') ||
             mergeTreeResult.output.includes('>>>>>>>');
    } catch {
      // If any command fails, assume conflicts
      return true;
    }
  }

  /**
   * Get the status of pull requests for an issue
   * @param issueNumber Issue number
   * @returns PR status information
   */
  private async getPullRequestStatus(issueNumber: number): Promise<{ hasPR: boolean, prNumber?: number, status?: string }> {
    try {
      // Search for PRs that reference this issue
      const searchResult = await this.client.octokit.rest.search.issuesAndPullRequests({
        q: `repo:${this.config.repository.owner}/${this.config.repository.name} is:pr is:open issue:${issueNumber}`,
      });
      
      if (searchResult.data.items.length > 0) {
        const pr = searchResult.data.items[0];
        const prNumber = pr.number;
        
        // Get detailed PR info
        const prDetails = await this.client.octokit.rest.pulls.get({
          owner: this.config.repository.owner,
          repo: this.config.repository.name,
          pull_number: prNumber,
        });
        
        // Determine PR status
        let status = 'open';
        if (prDetails.data.merged) {
          status = 'merged';
        } else if (prDetails.data.mergeable === false) {
          status = 'conflicts';
        } else if (prDetails.data.mergeable === true) {
          status = 'ready to merge';
        }
        
        return {
          hasPR: true,
          prNumber,
          status
        };
      }
      
      return { hasPR: false };
    } catch (error) {
      this.logger.debug(`Error getting PR status for issue #${issueNumber}`, { error });
      return { hasPR: false };
    }
  }

  /**
   * Resolve conflicts for an issue branch
   * @param issueNumber Issue number
   */
  public async resolveConflicts(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Resolving conflicts for issue #${issueNumber}`);
      
      // Detect conflicts
      const conflictResult = await this.detectConflicts(issueNumber);
      
      if (!conflictResult.hasConflicts) {
        await this.client.createIssueComment(
          issueNumber,
          `## Conflict Resolution\n\nNo merge conflicts detected for issue #${issueNumber}. The branch can be merged cleanly.`
        );
        return;
      }
      
      // Attempt automatic resolution
      const resolved = await this.attemptAutomaticResolution(
        issueNumber,
        conflictResult.conflictFiles,
        conflictResult.branchName
      );
      
      if (resolved) {
        // Automatic resolution succeeded
        await this.client.createIssueComment(
          issueNumber,
          `## Conflict Resolution\n\nMerge conflicts were automatically resolved for issue #${issueNumber}. The branch can now be merged.`
        );
        
        await this.client.addLabelsToIssue(issueNumber, ['stone-conflicts-resolved']);
      } else {
        // Automatic resolution failed, manual intervention needed
        const conflictDetails = conflictResult.conflictFiles
          .map(file => `- ${file.path}`)
          .join('\n');
        
        await this.client.createIssueComment(
          issueNumber,
          `## Conflict Resolution\n\nMerge conflicts could not be automatically resolved for issue #${issueNumber}. Manual intervention is required.\n\nConflicting files:\n${conflictDetails}`
        );
        
        await this.client.addLabelsToIssue(issueNumber, ['stone-manual-resolution-needed']);
      }
      
      // Update merge status
      await this.trackMergeStatus(issueNumber);
      
      this.logger.info(`Conflict resolution completed for issue #${issueNumber}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to resolve conflicts for issue #${issueNumber}`, { error: errorMessage });
      throw new Error(`Conflict resolution failed: ${errorMessage}`);
    }
  }
}