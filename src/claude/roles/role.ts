import { ClaudeClient } from '../api/client';
import { ClaudeContext, ContextProvider } from '../context/provider';
import { ResponseParser } from '../parsers/response-parser';
import { ConfigLoader } from '../../config';
import { GitHubClient } from '../../github';
import { Logger } from '../../utils/logger';

export abstract class Role {
  protected claudeClient: ClaudeClient;
  protected contextProvider: ContextProvider;
  protected responseParser: ResponseParser;
  protected logger: Logger;
  protected githubClient: GitHubClient | null = null;
  
  abstract name: string;
  
  constructor(protected token: string) {
    this.claudeClient = new ClaudeClient(token);
    this.contextProvider = new ContextProvider(token);
    this.responseParser = new ResponseParser();
    this.logger = new Logger();
  }
  
  /**
   * Initialize GitHub client if not already initialized
   */
  protected async initializeGitHubClient(): Promise<GitHubClient> {
    if (!this.githubClient) {
      const configLoader = new ConfigLoader();
      const config = await configLoader.getConfig();
      this.githubClient = new GitHubClient(this.token, config);
    }
    return this.githubClient;
  }
  
  /**
   * Process an issue with this role
   */
  public async processIssue(issueNumber: number): Promise<void> {
    try {
      // Get context for the issue
      const context = await this.contextProvider.buildContext(this.name, issueNumber);
      
      // Generate prompts
      const prompt = await this.generatePrompt(context);
      const systemPrompt = await this.generateSystemPrompt(context);
      
      // Generate response from Claude
      const response = await this.claudeClient.generateResponse(prompt, systemPrompt);
      
      // Add comment to the issue
      await this.addCommentToIssue(issueNumber, response);
      
      this.logger.info(`${this.name} role processed issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(`Error in ${this.name} role processing issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Generate the main prompt for Claude
   */
  protected async generatePrompt(context: ClaudeContext): Promise<string> {
    let prompt = '';
    
    // Add issue information
    if (context.issue) {
      prompt += `Issue: #${context.issue.number} ${context.issue.title}\n\n`;
      prompt += `Description:\n${context.issue.body}\n\n`;
      
      if (context.issue.labels.length > 0) {
        prompt += `Labels: ${context.issue.labels.join(', ')}\n\n`;
      }
    }
    
    // Add repository information
    if (context.repository) {
      prompt += `Repository: ${context.repository.owner}/${context.repository.name}\n\n`;
    }
    
    // Add task instructions
    prompt += 'Your task:\n';
    prompt += '1. Analyze the issue description\n';
    prompt += '2. Complete the tasks according to your role\n';
    prompt += '3. Provide any necessary code, documentation, or analysis\n';
    prompt += '4. List specific action items at the end of your response under an "Actions:" heading\n\n';
    
    prompt += 'Please begin!';
    
    return prompt;
  }
  
  /**
   * Generate the system prompt for Claude
   */
  protected async generateSystemPrompt(context: ClaudeContext): Promise<string> {
    let systemPrompt = '';
    
    // Add role instructions
    if (context.role?.instructions) {
      systemPrompt += context.role.instructions;
    } else {
      systemPrompt += `You are the ${this.name} role in the Stone software factory.\n`;
    }
    
    return systemPrompt;
  }
  
  /**
   * Add a comment to the issue with Claude's response
   */
  protected async addCommentToIssue(issueNumber: number, response: string): Promise<void> {
    const githubClient = await this.initializeGitHubClient();
    
    const commentBody = `## ${this.name.toUpperCase()} Role Response\n\n${response}`;
    
    await githubClient.createIssueComment(issueNumber, commentBody);
  }
}