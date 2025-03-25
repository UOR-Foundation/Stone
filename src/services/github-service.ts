import { Octokit } from 'octokit';
import { LoggerService } from './logger-service';

/**
 * Service for interacting with GitHub API
 */
export class GitHubService {
  private octokit: Octokit;

  constructor(
    private token: string,
    private logger: LoggerService
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * Get information about a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @returns Repository information
   */
  public async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get repository: ${owner}/${repo}`, { error: error.message });
      throw new Error(`Failed to get repository: ${error.message}`);
    }
  }

  /**
   * List issues in a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @param options Additional options for filtering issues
   * @returns List of issues
   */
  public async listIssues(owner: string, repo: string, options: any = {}): Promise<any[]> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/issues', {
        owner,
        repo,
        ...options
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to list issues: ${owner}/${repo}`, { error: error.message });
      throw new Error(`Failed to list issues: ${error.message}`);
    }
  }

  /**
   * Create a comment on an issue
   * @param owner Repository owner
   * @param repo Repository name
   * @param issueNumber Issue number
   * @param body Comment text
   * @returns Created comment
   */
  public async createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<any> {
    try {
      const response = await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: issueNumber,
        body
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create issue comment: ${owner}/${repo}#${issueNumber}`, { error: error.message });
      throw new Error(`Failed to create issue comment: ${error.message}`);
    }
  }

  /**
   * Create a pull request
   * @param owner Repository owner
   * @param repo Repository name
   * @param head The name of the branch where changes are implemented
   * @param base The name of the branch you want the changes pulled into
   * @param title Pull request title
   * @param body Pull request description
   * @returns Created pull request
   */
  public async createPullRequest(owner: string, repo: string, head: string, base: string, title: string, body: string): Promise<any> {
    try {
      const response = await this.octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        head,
        base,
        title,
        body
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create pull request: ${owner}/${repo}`, { error: error.message });
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }
}
