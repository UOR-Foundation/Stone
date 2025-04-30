import { Role } from './role';
import { ClaudeContext } from '../context/provider';

export class PMRole extends Role {
  public name = 'pm';
  
  constructor(token: string) {
    super(token);
  }
  
  /**
   * Process issue with PM role
   */
  public async processIssue(issueNumber: number): Promise<void> {
    await super.processIssue(issueNumber);
    
    // After processing, apply QA label to move to next stage
    const githubClient = await this.initializeGitHubClient();
    await githubClient.addLabelsToIssue(issueNumber, ['stone-qa']);
  }
  
  /**
   * Generate prompt specific for PM role
   */
  protected async generatePrompt(context: ClaudeContext): Promise<string> {
    let prompt = await super.generatePrompt(context);
    
    prompt += '\n\nAs the Product Manager (PM) role, you need to:';
    prompt += '\n1. Create a detailed Gherkin specification based on the issue description';
    prompt += '\n2. Format the Gherkin specification in a code block starting with ```gherkin';
    prompt += '\n3. Include User stories (As a... I want... So that...)';
    prompt += '\n4. Define specific scenarios with Given/When/Then format';
    prompt += '\n5. Include acceptance criteria for each scenario';
    prompt += '\n6. Ensure all requirements from the issue are covered';
    
    return prompt;
  }
  
  // Using parent class initializeGitHubClient
}
