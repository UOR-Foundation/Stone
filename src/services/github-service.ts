/**
 * Service for GitHub API operations
 */
export interface GithubService {
  /**
   * Gets a pull request by number
   * @param prNumber The PR number
   * @param owner Repository owner
   * @param repo Repository name
   * @returns The pull request data
   */
  getPullRequest(prNumber: number, owner: string, repo: string): Promise<{
    number: number;
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
  }>;

  /**
   * Gets comments on a pull request
   * @param prNumber The PR number
   * @param owner Repository owner
   * @param repo Repository name
   * @returns Array of PR comments
   */
  getPullRequestComments(prNumber: number, owner: string, repo: string): Promise<Array<{
    id: number;
    user: { login: string };
    body: string;
    created_at: string;
  }>>;

  /**
   * Updates a pull request
   * @param prNumber The PR number
   * @param owner Repository owner
   * @param repo Repository name
   * @param data The data to update
   */
  updatePullRequest(prNumber: number, owner: string, repo: string, data: any): Promise<void>;

  /**
   * Adds a comment to a pull request
   * @param prNumber The PR number
   * @param owner Repository owner
   * @param repo Repository name
   * @param comment The comment text
   */
  commentOnPullRequest(prNumber: number, owner: string, repo: string, comment: string): Promise<void>;

  /**
   * Adds a label to a pull request
   * @param prNumber The PR number
   * @param owner Repository owner
   * @param repo Repository name
   * @param label The label to add
   */
  addLabelToPullRequest(prNumber: number, owner: string, repo: string, label: string): Promise<void>;

  /**
   * Creates a new issue
   * @param owner Repository owner
   * @param repo Repository name
   * @param title Issue title
   * @param body Issue body
   * @returns The created issue data
   */
  createIssue(owner: string, repo: string, title: string, body: string): Promise<{ number: number }>;

  /**
   * Adds a label to an issue
   * @param issueNumber The issue number
   * @param owner Repository owner
   * @param repo Repository name
   * @param label The label to add
   */
  addLabelToIssue(issueNumber: number, owner: string, repo: string, label: string): Promise<void>;

  /**
   * Adds a comment to an issue
   * @param issueNumber The issue number
   * @param owner Repository owner
   * @param repo Repository name
   * @param comment The comment text
   */
  commentOnIssue(issueNumber: number, owner: string, repo: string, comment: string): Promise<void>;

  /**
   * Assigns an issue to a team
   * @param issueNumber The issue number
   * @param owner Repository owner
   * @param repo Repository name
   * @param team The team to assign
   */
  assignIssueToTeam(issueNumber: number, owner: string, repo: string, team: string): Promise<void>;

  /**
   * Creates a new branch
   * @param owner Repository owner
   * @param repo Repository name
   * @param baseBranch The base branch
   * @param newBranch The new branch name
   * @returns The created branch name
   */
  createBranch(owner: string, repo: string, baseBranch: string, newBranch: string): Promise<string>;

  /**
   * Commits files to a branch
   * @param owner Repository owner
   * @param repo Repository name
   * @param branch The branch to commit to
   * @param files The files to commit
   * @param message The commit message
   * @returns The commit SHA
   */
  commitFiles(owner: string, repo: string, branch: string, files: string[], message: string): Promise<string>;

  /**
   * Creates a pull request
   * @param owner Repository owner
   * @param repo Repository name
   * @param title PR title
   * @param body PR body
   * @param head Head branch
   * @param base Base branch
   * @returns The created PR data
   */
  createPullRequest(owner: string, repo: string, title: string, body: string, head: string, base: string): Promise<{ number: number }>;

  /**
   * Gets the status of a workflow
   * @param owner Repository owner
   * @param repo Repository name
   * @param workflowId The workflow ID
   * @returns The workflow status
   */
  getWorkflowStatus(owner: string, repo: string, workflowId: string): Promise<string>;
}
