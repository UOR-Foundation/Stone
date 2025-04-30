import { Role } from './role';
import { ClaudeContext } from '../context/provider';
import { GitHubComment } from './types';

export class AuditorRole extends Role {
  public name = 'auditor';
  
  constructor(token: string) {
    super(token);
  }
  
  /**
   * Process issue with Auditor role
   */
  public async processIssue(issueNumber: number): Promise<void> {
    await super.processIssue(issueNumber);
    
    // Get the audit result from the response
    const context = await this.contextProvider.buildContext(this.name, issueNumber);
    const prompt = await this.generatePrompt(context);
    const systemPrompt = await this.generateSystemPrompt(context);
    const response = await this.claudeClient.generateResponse(prompt, systemPrompt);
    
    // Determine if audit passed or failed
    const auditPassed = this.checkAuditPassed(response);
    
    // Add appropriate labels based on audit result
    const githubClient = await this.initializeGitHubClient();
    
    if (auditPassed) {
      await githubClient.addLabelsToIssue(issueNumber, ['stone-audit-pass', 'stone-ready-for-tests']);
    } else {
      await githubClient.addLabelsToIssue(issueNumber, ['stone-audit-fail', 'stone-feature-fix']);
    }
  }
  
  /**
   * Generate prompt specific for Auditor role
   */
  protected async generatePrompt(context: ClaudeContext): Promise<string> {
    let prompt = await super.generatePrompt(context);
    
    prompt += '\n\nAs the Auditor role, you need to:';
    prompt += '\n1. Verify the feature implementation against the Gherkin specification';
    prompt += '\n2. Check for placeholder code, TODOs, or incomplete implementations';
    prompt += '\n3. Validate test coverage adequacy';
    prompt += '\n4. Ensure code quality standards are met';
    prompt += '\n5. Check for security vulnerabilities or performance issues';
    prompt += '\n6. Provide a clear audit result (PASS or FAIL)';
    prompt += '\n7. List specific issues if the audit fails';
    
    // Find Gherkin, test info, and implementation in issue comments
    if (context.issue && context.repository) {
      const githubClient = await this.initializeGitHubClient();
      try {
        const { data: comments } = await githubClient.octokit.rest.issues.listComments({
          owner: context.repository.owner,
          repo: context.repository.name,
          issue_number: context.issue.number,
        });
        
        // Find the Gherkin specification
        const pmComments = comments.filter((comment: GitHubComment) => 
          comment.body.includes('## PM Role Response') &&
          comment.body.includes('```gherkin')
        );
        
        if (pmComments.length > 0) {
          const lastPMComment = pmComments[pmComments.length - 1];
          prompt += '\n\nHere is the Gherkin specification:\n\n';
          
          // Extract Gherkin block
          const gherkinMatch = lastPMComment.body.match(/```gherkin\n([\s\S]*?)```/);
          if (gherkinMatch) {
            prompt += '```gherkin\n' + gherkinMatch[1] + '```\n';
          }
        }
        
        // Find the QA information
        const qaComments = comments.filter((comment: GitHubComment) => 
          comment.body.includes('## QA Role Response')
        );
        
        if (qaComments.length > 0) {
          const lastQAComment = qaComments[qaComments.length - 1];
          prompt += '\n\nHere is the test information:\n\n';
          prompt += lastQAComment.body.replace('## QA Role Response\n\n', '');
        }
        
        // Find the feature implementation
        const featureComments = comments.filter((comment: GitHubComment) => 
          comment.body.includes('## FEATURE Role Response')
        );
        
        if (featureComments.length > 0) {
          const lastFeatureComment = featureComments[featureComments.length - 1];
          prompt += '\n\nHere is the feature implementation:\n\n';
          prompt += lastFeatureComment.body.replace('## FEATURE Role Response\n\n', '');
        }
      } catch (error) {
        this.logger.warning(`Error fetching comments for issue #${context.issue.number}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return prompt;
  }
  
  /**
   * Check if audit passed based on response
   */
  private checkAuditPassed(response: string): boolean {
    // Check for explicit pass/fail indicators
    const passIndicators = [
      'AUDIT: PASS',
      'AUDIT RESULT: PASS',
      'AUDIT STATUS: PASS',
      'The audit has passed',
      'All audit checks have passed',
    ];
    
    const failIndicators = [
      'AUDIT: FAIL',
      'AUDIT RESULT: FAIL',
      'AUDIT STATUS: FAIL',
      'The audit has failed',
      'The implementation has issues',
    ];
    
    // Check for pass indicators
    for (const indicator of passIndicators) {
      if (response.includes(indicator)) {
        return true;
      }
    }
    
    // Check for fail indicators
    for (const indicator of failIndicators) {
      if (response.includes(indicator)) {
        return false;
      }
    }
    
    // If no explicit indicators, check for issue lists which indicate failure
    const issueIndicators = [
      'Issues found:',
      'Problems:',
      'The following issues were found:',
    ];
    
    for (const indicator of issueIndicators) {
      if (response.includes(indicator)) {
        return false;
      }
    }
    
    // Default to pass if no clear indicators found
    return true;
  }
  
  // Using parent class initializeGitHubClient
}
