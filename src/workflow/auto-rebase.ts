import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config/schema';
import { LoggerService } from '../services/logger-service';
import { GitService } from '../services/git-service';

/**
 * Handles automatic rebasing of feature branches
 */
export class AutoRebase {
  private logger: LoggerService;
  
  constructor(
    private client: GitHubClient,
    private config: StoneConfig,
    private gitService: GitService
  ) {
    this.logger = new LoggerService();
  }
  
  /**
   * Attempt to rebase a feature branch on the main branch
   * @param issueNumber Issue number
   * @param prNumber Pull request number
   * @returns True if rebase was successful, false otherwise
   */
  public async attemptRebase(issueNumber: number, prNumber: number): Promise<boolean> {
    try {
      this.logger.info(`Attempting to rebase PR #${prNumber} for issue #${issueNumber}`);
      
      const repoPath = this.config.repository.path || process.cwd();
      
      const mainBranch = this.config.branches?.main || 'main';
      const featureBranch = `${this.config.branches?.prefix || 'stone/'}${issueNumber}`;
      
      await this.gitService.execGitCommand(repoPath, ['fetch', 'origin', mainBranch]);
      
      await this.gitService.execGitCommand(repoPath, ['checkout', featureBranch]);
      
      try {
        const rebaseResult = await this.gitService.execGitCommand(
          repoPath,
          ['rebase', `origin/${mainBranch}`]
        );
        
        await this.gitService.execGitCommand(repoPath, ['push', 'origin', featureBranch, '--force']);
        
        await this.client.createPullRequestComment(
          prNumber,
          `## Auto-Rebase\n\nSuccessfully rebased branch \`${featureBranch}\` on \`${mainBranch}\`.\n\n${rebaseResult.output}`
        );
        
        this.logger.info(`Successfully rebased PR #${prNumber} for issue #${issueNumber}`);
        return true;
      } catch (rebaseError) {
        await this.gitService.execGitCommand(repoPath, ['rebase', '--abort']);
        
        await this.client.createPullRequestComment(
          prNumber,
          `## Auto-Rebase Failed\n\nFailed to rebase branch \`${featureBranch}\` on \`${mainBranch}\`.\n\nManual intervention required to resolve conflicts.`
        );
        
        await this.client.addLabelsToIssue(issueNumber, ['stone-conflict']);
        
        this.logger.warn(`Rebase failed for PR #${prNumber}, manual intervention required`);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Auto-rebase failed: ${errorMessage}`);
      
      try {
        await this.client.createPullRequestComment(
          prNumber,
          `## Auto-Rebase Error\n\nAn error occurred during auto-rebase: ${errorMessage}`
        );
      } catch (commentError) {
        this.logger.error(`Failed to add error comment to PR: ${commentError instanceof Error ? commentError.message : String(commentError)}`);
      }
      
      return false;
    }
  }
  
  /**
   * Process a pull request for auto-rebasing
   * @param prNumber Pull request number
   * @returns True if processing was successful, false otherwise
   */
  public async processPullRequest(prNumber: number): Promise<boolean> {
    try {
      this.logger.info(`Processing PR #${prNumber} for auto-rebase`);
      
      const pr = await this.client.getPullRequest(prNumber);
      
      if (!pr || !pr.data) {
        this.logger.error(`Failed to get PR #${prNumber} details`);
        return false;
      }
      
      const issueNumberMatch = pr.data.title.match(/#(\d+)/) || pr.data.body?.match(/#(\d+)/);
      
      if (!issueNumberMatch) {
        this.logger.warn(`Could not find issue number in PR #${prNumber}`);
        return false;
      }
      
      const issueNumber = parseInt(issueNumberMatch[1], 10);
      
      const labels = pr.data.labels.map((label: any) => label.name);
      
      if (!labels.includes('stone-feature')) {
        this.logger.info(`PR #${prNumber} is not from feature role, skipping auto-rebase`);
        return false;
      }
      
      return await this.attemptRebase(issueNumber, prNumber);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process PR #${prNumber} for auto-rebase: ${errorMessage}`);
      return false;
    }
  }
  
  /**
   * Check if a pull request needs rebasing
   * @param prNumber Pull request number
   * @returns True if PR needs rebasing, false otherwise
   */
  public async needsRebase(prNumber: number): Promise<boolean> {
    try {
      this.logger.info(`Checking if PR #${prNumber} needs rebasing`);
      
      const pr = await this.client.getPullRequest(prNumber);
      
      if (!pr || !pr.data) {
        this.logger.error(`Failed to get PR #${prNumber} details`);
        return false;
      }
      
      const repoPath = this.config.repository.path || process.cwd();
      
      const mainBranch = this.config.branches?.main || 'main';
      const featureBranch = pr.data.head.ref;
      
      await this.gitService.execGitCommand(repoPath, ['fetch', 'origin', mainBranch, featureBranch]);
      
      const mergeBaseResult = await this.gitService.execGitCommand(
        repoPath,
        ['merge-base', `origin/${mainBranch}`, `origin/${featureBranch}`]
      );
      
      const mergeBase = mergeBaseResult.output.trim();
      
      const mainHeadResult = await this.gitService.execGitCommand(
        repoPath,
        ['rev-parse', `origin/${mainBranch}`]
      );
      
      const mainHead = mainHeadResult.output.trim();
      
      const needsRebase = mergeBase !== mainHead;
      
      this.logger.info(`PR #${prNumber} ${needsRebase ? 'needs' : 'does not need'} rebasing`);
      
      return needsRebase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check if PR #${prNumber} needs rebasing: ${errorMessage}`);
      return false;
    }
  }
}
