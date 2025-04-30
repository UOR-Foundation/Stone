import { ConfigLoader, StoneConfig } from '../../config';
import { GitHubAuth, GitHubClient } from '../../github';
import { Logger } from '../../utils/logger';

/**
 * Issue context interface for Claude prompts
 */
export interface IssueContext {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

/**
 * Repository context interface for Claude prompts
 */
export interface RepositoryContext {
  owner: string;
  name: string;
}

/**
 * Role context interface for Claude prompts
 */
export interface RoleContext {
  name: string;
  instructions: string;
}

/**
 * Complete context interface for Claude prompts
 */
export interface ClaudeContext {
  issue?: IssueContext;
  repository?: RepositoryContext;
  role?: RoleContext;
}

/**
 * Provides context for Claude prompts
 */
export class ContextProvider {
  private config: StoneConfig | null = null;
  private githubClient: GitHubClient | null = null;
  private logger: Logger;
  
  /**
   * Create a new context provider
   * @param token GitHub token
   */
  constructor(private token: string) {
    this.logger = new Logger();
  }
  
  /**
   * Initialize the context provider
   */
  private async initialize(): Promise<void> {
    try {
      if (!this.config || !this.githubClient) {
        this.logger.info('Initializing context provider');
        const configLoader = new ConfigLoader();
        this.config = await configLoader.getConfig();
        this.githubClient = new GitHubClient(this.token, this.config);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize context provider: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to initialize context provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get context from a GitHub issue
   * @param issueNumber Issue number
   * @returns Issue context
   */
  public async getIssueContext(issueNumber: number): Promise<{ issue: IssueContext }> {
    try {
      await this.initialize();
      
      this.logger.info(`Getting issue context for issue #${issueNumber}`);
      const { data: issue } = await this.githubClient!.getIssue(issueNumber);
      
      return {
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body || '',
          labels: issue.labels.map((label: string | {name?: string}) => {
            return typeof label === 'string' ? label : label.name;
          }).filter(Boolean) as string[],
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get issue context: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get issue context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get repository structure context
   * @returns Repository context
   */
  public async getRepositoryContext(): Promise<{ repository: RepositoryContext }> {
    try {
      await this.initialize();
      
      this.logger.info('Getting repository context');
      return {
        repository: {
          owner: this.config!.repository.owner,
          name: this.config!.repository.name,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get repository context: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get repository context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get Claude file content for a specific role
   * @param roleName Name of the role
   * @returns Role instructions
   */
  public async getRoleFileContent(roleName: string): Promise<string> {
    try {
      await this.initialize();
      
      this.logger.info(`Getting role file content for ${roleName}`);
      const roleKey = roleName.toLowerCase();
      
      // Create a type for valid role keys
      type RoleKey = 'pm' | 'qa' | 'feature' | 'auditor' | 'actions';
      
      // Check if roleKey is a valid role key
      const isValidRole = (key: string): key is RoleKey => {
        return ['pm', 'qa', 'feature', 'auditor', 'actions'].includes(key);
      };
      
      if (!isValidRole(roleKey)) {
        this.logger.error(`Invalid role name: ${roleName}`);
        throw new Error(`Invalid role name: ${roleName}`);
      }
      
      const rolePath = this.config!.roles[roleKey]?.claudeFile;
      
      if (!rolePath) {
        this.logger.error(`Role file path not found for ${roleName}`);
        throw new Error(`Role file path not found for ${roleName}`);
      }
      
      const filePath = `${this.config!.github.stoneDirectory}/${rolePath}`;
      this.logger.info(`Fetching role file from ${filePath}`);
      const { data: fileData } = await this.githubClient!.getFileContent(filePath);
      
      if ('content' in fileData && 'encoding' in fileData) {
        const content = fileData.content as string;
        const encoding = fileData.encoding as string;
        
        if (encoding === 'base64') {
          return Buffer.from(content, 'base64').toString('utf8');
        }
        
        return content;
      }
      
      this.logger.error('Invalid file data returned');
      throw new Error('Invalid file data returned');
    } catch (error) {
      this.logger.error(`Failed to get role file content for ${roleName}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get role file content for ${roleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Build complete context for a role and issue
   * @param roleName Name of the role
   * @param issueNumber Issue number (optional)
   * @returns Complete context for Claude
   */
  public async buildContext(roleName: string, issueNumber?: number): Promise<ClaudeContext> {
    try {
      this.logger.info(`Building context for role ${roleName}${issueNumber ? ` and issue #${issueNumber}` : ''}`);
      const context: ClaudeContext = {};
      
      // Get repository context
      const repoContext = await this.getRepositoryContext();
      context.repository = repoContext.repository;
      
      // Get role instructions
      const instructions = await this.getRoleFileContent(roleName);
      context.role = {
        name: roleName,
        instructions,
      };
      
      // Get issue context if provided
      if (issueNumber) {
        const issueContext = await this.getIssueContext(issueNumber);
        context.issue = issueContext.issue;
      }
      
      this.logger.info('Context built successfully');
      return context;
    } catch (error) {
      this.logger.error(`Failed to build context: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to build context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
