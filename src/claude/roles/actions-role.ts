import { Role } from './role';
import { ClaudeContext } from '../context/provider';
import { GitHubComment } from './types';

export class ActionsRole extends Role {
  public name = 'actions';
  
  constructor(token: string) {
    super(token);
  }
  
  /**
   * Process issue with Actions role
   */
  public async processIssue(issueNumber: number): Promise<void> {
    await super.processIssue(issueNumber);
    
    // After processing, apply Feature Implementation label to move to next stage
    const githubClient = await this.initializeGitHubClient();
    await githubClient.addLabelsToIssue(issueNumber, ['stone-feature-implement']);
  }
  
  /**
   * Generate prompt specific for Actions role
   */
  protected async generatePrompt(context: ClaudeContext): Promise<string> {
    let prompt = await super.generatePrompt(context);
    
    prompt += '\n\nAs the GitHub Actions Team role, you need to:';
    prompt += '\n1. Review the test files and commands';
    prompt += '\n2. Create or update GitHub Actions workflows';
    prompt += '\n3. Set up CI/CD for automated testing';
    prompt += '\n4. Ensure workflows integrate with Stone automation';
    prompt += '\n5. Provide workflow file content in code blocks';
    prompt += '\n6. List the file paths where workflows should be created';
    
    // Find the QA test information in issue comments
    if (context.issue && context.repository) {
      const githubClient = await this.initializeGitHubClient();
      try {
        const { data: comments } = await githubClient.octokit.rest.issues.listComments({
          owner: context.repository.owner,
          repo: context.repository.name,
          issue_number: context.issue.number,
        });
        
        // Find the QA information
        const qaComments = comments.filter((comment: GitHubComment) => 
          comment.body.includes('## QA Role Response')
        );
        
        if (qaComments.length > 0) {
          const lastQAComment = qaComments[qaComments.length - 1];
          prompt += '\n\nHere is the test information from the QA role:\n\n';
          prompt += lastQAComment.body.replace('## QA Role Response\n\n', '');
        }
        
        // Check for existing workflow files
        try {
          const { data: workflowFiles } = await githubClient.octokit.rest.repos.getContent({
            owner: context.repository.owner,
            repo: context.repository.name,
            path: '.github/workflows'
          });
          
          if (Array.isArray(workflowFiles)) {
            prompt += '\n\nExisting workflow files:\n';
            
            for (const file of workflowFiles) {
              prompt += `- ${file.name}\n`;
              
              // Get content of workflow file if it's a YAML file
              if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
                try {
                  const { data: fileData } = await githubClient.getFileContent(`.github/workflows/${file.name}`);
                  
                  if ('content' in fileData && 'encoding' in fileData) {
                    const content = Buffer.from(fileData.content as string, 'base64').toString('utf8');
                    prompt += '\n```yaml\n' + content + '\n```\n';
                  }
                } catch (error) {
                  this.logger.warning(`Error fetching workflow file ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
            }
          }
        } catch (error) {
          prompt += '\n\nNo existing workflow files found. You will need to create them from scratch.';
        }
      } catch (error) {
        this.logger.warning(`Error fetching data for issue #${context.issue.number}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return prompt;
  }
  
  // Using parent class initializeGitHubClient
}