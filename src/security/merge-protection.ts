import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config/schema';
import { Logger } from '../utils/logger';

/**
 * Protection rule result
 */
export interface ProtectionRuleResult {
  rule: string;
  passed: boolean;
  message: string;
}

/**
 * Merge check result
 */
export interface MergeCheckResult {
  canMerge: boolean;
  rules: ProtectionRuleResult[];
}

/**
 * Enforces merge protections
 */
export class MergeProtection {
  private logger: Logger;

  constructor(
    private client: GitHubClient,
    private config: StoneConfig
  ) {
    this.logger = new Logger();
  }

  /**
   * Check if a pull request can be merged
   * @param prNumber Pull request number
   * @returns Whether the PR can be merged and rule results
   */
  public async canMerge(prNumber: number): Promise<MergeCheckResult> {
    try {
      this.logger.info(`Checking merge protection for PR #${prNumber}`);
      
      const rules: ProtectionRuleResult[] = [];
      
      const { data: pr } = await this.client.getPullRequest(prNumber);
      
      if (!pr.mergeable) {
        rules.push({
          rule: 'no-conflicts',
          passed: false,
          message: 'PR has conflicts and cannot be merged'
        });
      } else {
        rules.push({
          rule: 'no-conflicts',
          passed: true,
          message: 'PR has no conflicts'
        });
      }
      
      const { data: reviews } = await this.client.octokit.rest.pulls.listReviews({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: prNumber
      });
      
      const approvedReviews = reviews.filter((review: { state: string }) => review.state === 'APPROVED');
      
      const requiredReviewers = this.config.audit?.requiredReviewers || 1;
      
      const hasEnoughReviews = approvedReviews.length >= requiredReviewers;
      rules.push({
        rule: 'required-reviews',
        passed: hasEnoughReviews,
        message: hasEnoughReviews 
          ? `PR has ${approvedReviews.length} approved reviews (${requiredReviewers} required)`
          : `PR needs ${requiredReviewers} approved reviews, has ${approvedReviews.length}`
      });
      
      const { data: statuses } = await this.client.octokit.rest.repos.getCombinedStatusForRef({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        ref: pr.head.sha
      });
      
      const ciPassed = statuses.state === 'success';
      rules.push({
        rule: 'ci-status',
        passed: ciPassed,
        message: ciPassed
          ? 'CI checks passed'
          : `CI status is ${statuses.state}, not 'success'`
      });
      
      const branchProtection = await this.checkBranchProtection(pr.base.ref);
      rules.push(...branchProtection);
      
      const canMerge = rules.every(rule => rule.passed);
      
      this.logger.info(`PR #${prNumber} ${canMerge ? 'can' : 'cannot'} be merged`);
      
      return {
        canMerge,
        rules
      };
    } catch (error) {
      this.logger.error(`Error checking merge protection: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        canMerge: false,
        rules: [{
          rule: 'error',
          passed: false,
          message: `Error checking merge protection: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
  
  /**
   * Check branch protection rules
   * @param branchName Branch name
   * @returns Protection rule results
   */
  private async checkBranchProtection(branchName: string): Promise<ProtectionRuleResult[]> {
    try {
      const rules: ProtectionRuleResult[] = [];
      
      let protection;
      try {
        const { data } = await this.client.octokit.rest.repos.getBranchProtection({
          owner: this.config.repository.owner,
          repo: this.config.repository.name,
          branch: branchName
        });
        protection = data;
      } catch (error) {
        if ((error as any).status === 404) {
          return [];
        }
        throw error;
      }
      
      if (!protection) {
        rules.push({
          rule: 'branch-protection',
          passed: true,
          message: `No branch protection rules found for ${branchName}`
        });
        return rules;
      }
      
      if (protection.required_status_checks) {
        rules.push({
          rule: 'required-status-checks',
          passed: true,
          message: `Branch requires status checks: ${protection.required_status_checks.contexts.join(', ')}`
        });
      }
      
      if (protection.required_pull_request_reviews) {
        const requiredReviewers = protection.required_pull_request_reviews.required_approving_review_count || 0;
        rules.push({
          rule: 'required-pr-reviews',
          passed: true,
          message: `Branch requires ${requiredReviewers} PR reviews`
        });
      }
      
      if (protection.restrictions) {
        rules.push({
          rule: 'branch-restrictions',
          passed: true,
          message: 'Branch has push restrictions'
        });
      }
      
      return rules;
    } catch (error) {
      this.logger.error(`Error checking branch protection: ${error instanceof Error ? error.message : String(error)}`);
      
      return [{
        rule: 'branch-protection-error',
        passed: false,
        message: `Error checking branch protection: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }
  
  /**
   * Enforce branch protection on a repository
   * @param branchName Branch name
   * @returns Whether protection was successfully enforced
   */
  public async enforceBranchProtection(branchName: string): Promise<boolean> {
    try {
      this.logger.info(`Enforcing branch protection for ${branchName}`);
      
      const requiredReviewers = this.config.audit?.requiredReviewers || 1;
      const requiredChecks = this.config.audit?.qualityChecks || ['lint', 'tests'];
      
      await this.client.octokit.rest.repos.updateBranchProtection({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        branch: branchName,
        required_status_checks: {
          strict: true,
          contexts: requiredChecks
        },
        enforce_admins: false,
        required_pull_request_reviews: {
          dismissal_restrictions: {},
          dismiss_stale_reviews: true,
          require_code_owner_reviews: false,
          required_approving_review_count: requiredReviewers
        },
        restrictions: null
      });
      
      this.logger.success(`Branch protection enforced for ${branchName}`);
      return true;
    } catch (error) {
      this.logger.error(`Error enforcing branch protection: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
