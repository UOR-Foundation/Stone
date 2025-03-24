import { ConfigLoader, StoneConfig } from '../../config';
import { GitHubAuth, GitHubClient } from '../../github';

export interface IssueContext {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export interface RepositoryContext {
  owner: string;
  name: string;
}

export interface RoleContext {
  name: string;
  instructions: string;
}

export interface ClaudeContext {
  issue?: IssueContext;
  repository?: RepositoryContext;
  role?: RoleContext;
}

export class ContextProvider {
  private config: StoneConfig | null = null;
  private githubClient: GitHubClient | null = null;
  
  constructor(private token: string) {}
  
  /**
   * Initialize the context provider
   */
  private async initialize(): Promise<void> {
    if (!this.config || !this.githubClient) {
      const configLoader = new ConfigLoader();
      this.config = await configLoader.getConfig();
      this.githubClient = new GitHubClient(this.token, this.config);
    }
  }
  
  /**
   * Get context from a GitHub issue
   */
  public async getIssueContext(issueNumber: number): Promise<{ issue: IssueContext }> {
    try {
      await this.initialize();
      
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
      throw new Error(`Failed to get issue context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get repository structure context
   */
  public async getRepositoryContext(): Promise<{ repository: RepositoryContext }> {
    await this.initialize();
    
    return {
      repository: {
        owner: this.config!.repository.owner,
        name: this.config!.repository.name,
      },
    };
  }
  
  /**
   * Get Claude file content for a specific role
   */
  public async getRoleFileContent(roleName: string): Promise<string> {
    try {
      await this.initialize();
      
      const roleKey = roleName.toLowerCase();
      
      // Create a type for valid role keys
      type RoleKey = 'pm' | 'qa' | 'feature' | 'auditor' | 'actions';
      
      // Check if roleKey is a valid role key
      const isValidRole = (key: string): key is RoleKey => {
        return ['pm', 'qa', 'feature', 'auditor', 'actions'].includes(key);
      };
      
      if (!isValidRole(roleKey)) {
        throw new Error(`Invalid role name: ${roleName}`);
      }
      
      const rolePath = this.config!.roles[roleKey]?.claudeFile;
      
      if (!rolePath) {
        throw new Error(`Role file path not found for ${roleName}`);
      }
      
      const filePath = `${this.config!.github.stoneDirectory}/${rolePath}`;
      const { data: fileData } = await this.githubClient!.getFileContent(filePath);
      
      if ('content' in fileData && 'encoding' in fileData) {
        const content = fileData.content as string;
        const encoding = fileData.encoding as string;
        
        if (encoding === 'base64') {
          return Buffer.from(content, 'base64').toString('utf8');
        }
        
        return content;
      }
      
      throw new Error('Invalid file data returned');
    } catch (error) {
      throw new Error(`Failed to get role file content for ${roleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Build complete context for a role and issue
   */
  public async buildContext(roleName: string, issueNumber?: number): Promise<ClaudeContext> {
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
    
    return context;
  }
}