import { Role } from './role';
import { ClaudeContext } from '../context/provider';
import { GitHubComment } from './types';

export class FeatureRole extends Role {
  public name = 'feature';
  
  constructor(token: string) {
    super(token);
  }
  
  /**
   * Process issue with Feature role
   */
  public async processIssue(issueNumber: number): Promise<void> {
    await super.processIssue(issueNumber);
    
    // After processing, apply Audit label to move to next stage
    const githubClient = await this.initializeGitHubClient();
    await githubClient.addLabelsToIssue(issueNumber, ['stone-audit']);
  }
  
  /**
   * Generate prompt specific for Feature role
   */
  protected async generatePrompt(context: ClaudeContext): Promise<string> {
    let prompt = await super.generatePrompt(context);
    
    prompt += '\n\nAs the Feature Team role, you need to:';
    prompt += '\n1. Read the Gherkin specification and test files created by QA';
    prompt += '\n2. Implement the feature according to the specification';
    prompt += '\n3. Ensure all tests pass with your implementation';
    prompt += '\n4. Provide implementation code with file paths';
    prompt += '\n5. Explain any technical decisions you made';
    prompt += '\n6. Follow best practices and coding standards';
    prompt += '\n7. Consider edge cases and error handling';
    
    // Find Gherkin and test info in issue comments
    if (context.issue && context.repository) {
      const githubClient = await this.initializeGitHubClient();
      try {
        const { data: comments } = await githubClient.octokit.rest.issues.listComments({
          owner: context.repository.owner,
          repo: context.repository.name,
          issue_number: context.issue.number,
        });
        
        // Find the last comment from PM role that contains Gherkin
        const pmComments = comments.filter((comment: GitHubComment) => 
          comment.body.includes('## PM Role Response') &&
          comment.body.includes('```gherkin')
        );
        
        if (pmComments.length > 0) {
          const lastPMComment = pmComments[pmComments.length - 1];
          prompt += '\n\nHere is the Gherkin specification from the PM role:\n\n';
          
          // Extract Gherkin block
          const gherkinMatch = lastPMComment.body.match(/```gherkin\n([\s\S]*?)```/);
          if (gherkinMatch) {
            prompt += '```gherkin\n' + gherkinMatch[1] + '```\n';
          }
        }
        
        // Find the last comment from QA role that contains test information
        const qaComments = comments.filter((comment: GitHubComment) => 
          comment.body.includes('## QA Role Response')
        );
        
        if (qaComments.length > 0) {
          const lastQAComment = qaComments[qaComments.length - 1];
          prompt += '\n\nHere is the test information from the QA role:\n\n';
          prompt += lastQAComment.body.replace('## QA Role Response\n\n', '');
        }
      } catch (error) {
        this.logger.warning(`Error fetching comments for issue #${context.issue.number}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return prompt;
  }
  
  // Using parent class initializeGitHubClient
}
