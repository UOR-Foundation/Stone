import { Role } from './role';
import { ClaudeContext } from '../context/provider';
import { GitHubComment } from './types';

export class QARole extends Role {
  public name = 'qa';
  
  constructor(token: string) {
    super(token);
  }
  
  /**
   * Process issue with QA role
   */
  public async processIssue(issueNumber: number): Promise<void> {
    await super.processIssue(issueNumber);
    
    // After processing, apply Actions label to move to next stage
    const githubClient = await this.initializeGitHubClient();
    await githubClient.addLabelsToIssue(issueNumber, ['stone-actions']);
  }
  
  /**
   * Generate prompt specific for QA role
   */
  protected async generatePrompt(context: ClaudeContext): Promise<string> {
    let prompt = await super.generatePrompt(context);
    
    prompt += '\n\nAs the QA Team role, you need to:';
    prompt += '\n1. Read the Gherkin specification in the issue';
    prompt += '\n2. Create appropriate test files based on the specification';
    prompt += '\n3. Identify which packages are involved';
    prompt += '\n4. Provide code blocks for unit, integration, and end-to-end tests';
    prompt += '\n5. List the file paths where tests should be created';
    prompt += '\n6. Provide a test command to run the tests';
    
    // Find Gherkin spec in issue comments
    if (context.issue) {
      const githubClient = await this.initializeGitHubClient();
      try {
        const { data: comments } = await githubClient.octokit.rest.issues.listComments({
          owner: context.repository!.owner,
          repo: context.repository!.name,
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
          } else {
            prompt += lastPMComment.body;
          }
        }
      } catch (error) {
        this.logger.warning(`Error fetching comments for issue #${context.issue.number}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return prompt;
  }
  
  // Using parent class initializeGitHubClient
}