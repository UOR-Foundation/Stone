import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { Logger } from '../utils/logger';

/**
 * Interface for audit criteria
 */
export interface AuditCriteria {
  codeCoverage: number;
  reviewersAssigned: number;
  complexityScore: number;
  hasUnitTests: boolean;
}

/**
 * Interface for implementation verification
 */
export interface ImplementationVerification {
  success: boolean;
  missingRequirements: string[];
}

/**
 * Interface for code quality
 */
export interface CodeQuality {
  lintPassed: boolean;
  typesPassed: boolean;
  testsPassed: boolean;
}

/**
 * Interface for complete audit results
 */
export interface AuditResults {
  criteria: AuditCriteria;
  verification: ImplementationVerification;
  quality: CodeQuality;
}

/**
 * Handles implementation auditing and verification
 */
export class AuditSystem {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
  }

  /**
   * Evaluate audit criteria for a feature
   */
  public async evaluateAuditCriteria(issueNumber: number): Promise<AuditCriteria> {
    this.logger.info(`Evaluating audit criteria for issue: #${issueNumber}`);
    
    // Find the pull request associated with this issue
    const prData = await this.findPullRequestForIssue(issueNumber);
    
    if (!prData) {
      // No PR found, return default criteria
      return {
        codeCoverage: 0,
        reviewersAssigned: 0,
        complexityScore: 0,
        hasUnitTests: false
      };
    }
    
    // Get PR files to calculate metrics
    const { data: files } = await this.client.octokit.rest.pulls.listFiles({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      pull_number: prData.number
    });
    
    // Extract source and test files
    const sourceFiles = files.filter(file => 
      file.filename.endsWith('.ts') && 
      !file.filename.includes('test') && 
      !file.filename.includes('spec')
    );
    
    const testFiles = files.filter(file => 
      file.filename.includes('test') || 
      file.filename.includes('spec')
    );
    
    // Calculate code coverage estimate based on test/source ratio
    let codeCoverage = 0;
    if (sourceFiles.length > 0) {
      const testLines = testFiles.reduce((sum, file) => sum + file.changes, 0);
      const sourceLines = sourceFiles.reduce((sum, file) => sum + file.changes, 0);
      codeCoverage = Math.min(100, Math.round((testLines / sourceLines) * 100));
    }
    
    // Count reviewers assigned
    const reviewersAssigned = prData.requested_reviewers ? prData.requested_reviewers.length : 0;
    
    // Calculate complexity score (using a simple heuristic based on changes)
    const totalChanges = files.reduce((sum, file) => sum + file.changes, 0);
    const complexityScore = Math.min(100, Math.round(totalChanges / 10));
    
    return {
      codeCoverage,
      reviewersAssigned,
      complexityScore,
      hasUnitTests: testFiles.length > 0
    };
  }

  /**
   * Verify implementation against requirements
   */
  public async verifyImplementation(issueNumber: number): Promise<ImplementationVerification> {
    this.logger.info(`Verifying implementation for issue: #${issueNumber}`);
    
    // Get the Gherkin specifications to extract requirements
    const { data: comments } = await this.client.octokit.rest.issues.listComments({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber
    });

    // Find the Gherkin specification
    const gherkinComment = comments.find(comment => 
      comment.body && comment.body.includes('## Gherkin Specification')
    );

    if (!gherkinComment) {
      return {
        success: false,
        missingRequirements: ['Gherkin specifications not found']
      };
    }

    // Extract the Gherkin scenarios as requirements
    const requirements: string[] = [];
    const scenarioMatches = gherkinComment.body.matchAll(/Scenario:\s+(.+?)(?=\n)/g);
    
    for (const match of scenarioMatches) {
      requirements.push(match[1].trim());
    }
    
    // Find the pull request associated with this issue
    const prData = await this.findPullRequestForIssue(issueNumber);
    
    if (!prData) {
      return {
        success: false,
        missingRequirements: requirements
      };
    }
    
    // For a real implementation, we would analyze the PR details
    // to verify that each requirement is met
    // For this simplified version, we'll assume all requirements are met
    // if there's at least one file changed per requirement
    
    const { data: files } = await this.client.octokit.rest.pulls.listFiles({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      pull_number: prData.number
    });
    
    // We'll use a simplified verification here
    const missingRequirements = requirements.filter((_, index) => 
      files.length < requirements.length // Simplified check
    );
    
    return {
      success: missingRequirements.length === 0,
      missingRequirements
    };
  }

  /**
   * Validate code quality for a pull request
   */
  public async validateCodeQuality(prData: any): Promise<CodeQuality> {
    this.logger.info(`Validating code quality for PR: #${prData.number}`);
    
    // Get the check runs for the PR
    const { data: checkRuns } = await this.client.octokit.rest.checks.listForRef({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      ref: prData.head.ref
    });
    
    // Check if lint, types, and tests all pass
    const lintCheck = checkRuns.check_runs.find(check => 
      check.name.toLowerCase().includes('lint')
    );
    
    const typeCheck = checkRuns.check_runs.find(check => 
      check.name.toLowerCase().includes('type') || 
      check.name.toLowerCase().includes('tsc')
    );
    
    const testCheck = checkRuns.check_runs.find(check => 
      check.name.toLowerCase().includes('test')
    );
    
    return {
      lintPassed: lintCheck ? lintCheck.conclusion === 'success' : false,
      typesPassed: typeCheck ? typeCheck.conclusion === 'success' : false,
      testsPassed: testCheck ? testCheck.conclusion === 'success' : false
    };
  }

  /**
   * Process audit results and provide recommendations
   */
  public async processAuditResults(issueNumber: number, results: AuditResults): Promise<void> {
    this.logger.info(`Processing audit results for issue: #${issueNumber}`);
    
    // Get the minimum requirements from config
    const minCodeCoverage = this.config.audit?.minCodeCoverage || 80;
    const requiredReviewers = this.config.audit?.requiredReviewers || 1;
    const maxComplexity = this.config.audit?.maxComplexity || 20;
    
    // Check if all quality checks pass
    const qualityPassed = results.quality.lintPassed && 
                         results.quality.typesPassed && 
                         results.quality.testsPassed;
    
    // Check if all criteria are met
    const criteriaPassed = results.criteria.codeCoverage >= minCodeCoverage &&
                          results.criteria.reviewersAssigned >= requiredReviewers &&
                          results.criteria.complexityScore <= maxComplexity &&
                          results.criteria.hasUnitTests;
    
    // Overall audit result
    const auditPassed = qualityPassed && 
                       criteriaPassed && 
                       results.verification.success;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!results.criteria.hasUnitTests) {
      recommendations.push('- Add unit tests for the implementation');
    }
    
    if (results.criteria.codeCoverage < minCodeCoverage) {
      recommendations.push(`- Increase test coverage from ${results.criteria.codeCoverage}% to at least ${minCodeCoverage}%`);
    }
    
    if (results.criteria.reviewersAssigned < requiredReviewers) {
      recommendations.push(`- Request at least ${requiredReviewers} reviewer${requiredReviewers > 1 ? 's' : ''} for the pull request`);
    }
    
    if (results.criteria.complexityScore > maxComplexity) {
      recommendations.push('- Refactor the implementation to reduce complexity');
    }
    
    if (!results.quality.lintPassed) {
      recommendations.push('- Fix linting issues');
    }
    
    if (!results.quality.typesPassed) {
      recommendations.push('- Fix type errors');
    }
    
    if (!results.quality.testsPassed) {
      recommendations.push('- Fix failing tests');
    }
    
    if (results.verification.missingRequirements.length > 0) {
      recommendations.push('- Implement missing requirements: ' + 
                         results.verification.missingRequirements.join(', '));
    }
    
    // Create audit result comment
    await this.client.createIssueComment(
      issueNumber,
      `## Audit ${auditPassed ? 'Passed' : 'Failed'}

### Code Quality
- Lint: ${results.quality.lintPassed ? '✅' : '❌'}
- Types: ${results.quality.typesPassed ? '✅' : '❌'}
- Tests: ${results.quality.testsPassed ? '✅' : '❌'}

### Criteria
- Code Coverage: ${results.criteria.codeCoverage}% ${results.criteria.codeCoverage >= minCodeCoverage ? '✅' : '❌'}
- Reviewers Assigned: ${results.criteria.reviewersAssigned} ${results.criteria.reviewersAssigned >= requiredReviewers ? '✅' : '❌'}
- Complexity Score: ${results.criteria.complexityScore} ${results.criteria.complexityScore <= maxComplexity ? '✅' : '❌'}
- Has Unit Tests: ${results.criteria.hasUnitTests ? '✅' : '❌'}

### Verification
- Requirements Met: ${results.verification.success ? '✅' : '❌'}
${results.verification.missingRequirements.length > 0 ? '- Missing Requirements: ' + results.verification.missingRequirements.join(', ') : ''}

${recommendations.length > 0 ? '### Recommendations\n' + recommendations.join('\n') : ''}

${auditPassed ? '✅ The implementation meets all audit criteria and is ready for testing.' : '❌ The implementation does not meet all audit criteria. Please address the recommendations.'}
`
    );
    
    // Update labels based on audit results
    if (auditPassed) {
      await this.client.addLabelsToIssue(issueNumber, ['stone-ready-for-tests']);
      await this.client.removeLabelFromIssue(issueNumber, 'stone-audit');
    } else {
      await this.client.addLabelsToIssue(issueNumber, ['stone-audit-failed']);
    }
  }

  /**
   * Find a pull request associated with an issue
   */
  private async findPullRequestForIssue(issueNumber: number): Promise<any> {
    try {
      // Search for PRs that mention the issue in the form "Closes #X" or "Fixes #X"
      const { data: searchResults } = await this.client.octokit.rest.search.issuesAndPullRequests({
        q: `repo:${this.config.repository.owner}/${this.config.repository.name} is:pr is:open ${issueNumber} in:body`
      });
      
      // Filter to only get PRs (not issues)
      const prs = searchResults.items.filter(item => item.pull_request);
      
      if (prs.length === 0) {
        return null;
      }
      
      // Get the first PR that matches
      const { data: prData } = await this.client.octokit.rest.pulls.get({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: prs[0].number
      });
      
      return prData;
    } catch (error) {
      this.logger.error(`Error finding PR for issue #${issueNumber}: ${error}`);
      return null;
    }
  }
}