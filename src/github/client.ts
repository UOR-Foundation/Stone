import { Octokit } from 'octokit';
import { StoneConfig } from '../config';
import { Logger } from '../utils/logger';

/**
 * GitHub API response types
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string }>;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  assignees?: Array<{ login: string }>;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  mergeable?: boolean;
  mergeable_state?: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GitHubFileContent {
  type: string;
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
  };
  committer: {
    login: string;
  };
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  author: {
    login: string;
  };
}

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubWebhook {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type: string;
    insecure_ssl: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Client for interacting with the GitHub API
 */
export class GitHubClient {
  public octokit: Octokit;
  private config: StoneConfig;
  private token: string;
  private logger: Logger;

  /**
   * Create a new GitHub client
   * @param token GitHub API token
   * @param config Stone configuration
   */
  constructor(token: string, config: StoneConfig) {
    this.token = token;
    this.octokit = new Octokit({ auth: token });
    this.config = config;
    this.logger = new Logger();
  }
  
  /**
   * Get the currently authenticated user
   * @returns Authenticated user information
   */
  public async getCurrentUser() {
    try {
      this.logger.info('Getting authenticated user');
      return await this.octokit.rest.users.getAuthenticated();
    } catch (error) {
      this.logger.error(`Failed to get authenticated user: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a repository
   * @param owner Repository owner
   * @param name Repository name
   * @returns Repository information
   */
  public async getRepository(owner: string, name: string) {
    try {
      this.logger.info(`Getting repository ${owner}/${name}`);
      return await this.octokit.rest.repos.get({
        owner,
        repo: name
      });
    } catch (error) {
      this.logger.error(`Failed to get repository ${owner}/${name}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List issues for a repository
   * @param state Issue state (open, closed, all)
   * @param labels Comma-separated list of label names
   * @returns List of issues
   */
  public async listIssues(state?: 'open' | 'closed' | 'all', labels?: string) {
    try {
      this.logger.info(`Listing issues for ${this.config.repository.owner}/${this.config.repository.name} with state=${state || 'open'} and labels=${labels || 'none'}`);
      return await this.octokit.rest.issues.listForRepo({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        state: state || 'open',
        labels
      });
    } catch (error) {
      this.logger.error(`Failed to list issues: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List pull requests for a repository
   * @param state Pull request state (open, closed, all)
   * @returns List of pull requests
   */
  public async listPullRequests(state?: 'open' | 'closed' | 'all') {
    try {
      this.logger.info(`Listing pull requests for ${this.config.repository.owner}/${this.config.repository.name} with state=${state || 'open'}`);
      return await this.octokit.rest.pulls.list({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        state: state || 'open'
      });
    } catch (error) {
      this.logger.error(`Failed to list pull requests: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get timeline for an issue
   * @param issueNumber Issue number
   * @returns Timeline events for the issue
   */
  public async getIssueTimeline(issueNumber: number) {
    try {
      this.logger.info(`Getting timeline for issue #${issueNumber}`);
      return await this.octokit.rest.issues.listEventsForTimeline({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: issueNumber
      });
    } catch (error) {
      this.logger.error(`Failed to get issue timeline for #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get the GitHub token used for authentication
   * @returns The GitHub token
   */
  public getToken(): string {
    return this.token;
  }

  /**
   * Get an issue by number
   * @param issueNumber Issue number
   * @returns Issue information
   */
  public async getIssue(issueNumber: number) {
    try {
      this.logger.info(`Getting issue #${issueNumber}`);
      return await this.octokit.rest.issues.get({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: issueNumber,
      });
    } catch (error) {
      this.logger.error(`Failed to get issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get all issues with a specific label
   * @param label Label name
   * @returns List of issues with the label
   */
  public async getIssuesByLabel(label: string) {
    try {
      this.logger.info(`Getting issues with label "${label}"`);
      return await this.octokit.rest.issues.listForRepo({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        labels: label,
        state: 'open',
      });
    } catch (error) {
      this.logger.error(`Failed to get issues with label "${label}": ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List comments on an issue
   * @param issueNumber Issue number
   * @returns List of comments
   */
  public async listIssueComments(issueNumber: number) {
    try {
      this.logger.info(`Listing comments for issue #${issueNumber}`);
      return await this.octokit.rest.issues.listComments({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: issueNumber,
      });
    } catch (error) {
      this.logger.error(`Failed to list comments for issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a comment on an issue
   * @param issueNumber Issue number
   * @param body Comment body
   * @returns Created comment
   */
  public async createIssueComment(issueNumber: number, body: string) {
    try {
      this.logger.info(`Creating comment on issue #${issueNumber}`);
      return await this.octokit.rest.issues.createComment({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: issueNumber,
        body,
      });
    } catch (error) {
      this.logger.error(`Failed to create comment on issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Update an existing comment
   * @param commentId Comment ID
   * @param body New comment body
   * @returns Updated comment
   */
  public async updateIssueComment(commentId: number, body: string) {
    try {
      this.logger.info(`Updating comment #${commentId}`);
      return await this.octokit.rest.issues.updateComment({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        comment_id: commentId,
        body,
      });
    } catch (error) {
      this.logger.error(`Failed to update comment #${commentId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Add labels to an issue
   * @param issueNumber Issue number
   * @param labels Array of label names
   * @returns Added labels
   */
  public async addLabelsToIssue(issueNumber: number, labels: string[]) {
    try {
      this.logger.info(`Adding labels ${labels.join(', ')} to issue #${issueNumber}`);
      return await this.octokit.rest.issues.addLabels({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: issueNumber,
        labels,
      });
    } catch (error) {
      this.logger.error(`Failed to add labels to issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Remove a label from an issue
   * @param issueNumber Issue number
   * @param label Label name
   * @returns API response
   */
  public async removeLabelFromIssue(issueNumber: number, label: string) {
    try {
      this.logger.info(`Removing label "${label}" from issue #${issueNumber}`);
      return await this.octokit.rest.issues.removeLabel({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: issueNumber,
        name: label,
      });
    } catch (error) {
      this.logger.error(`Failed to remove label "${label}" from issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Assign users to an issue
   * @param issueNumber Issue number
   * @param assignees Array of usernames
   * @returns API response
   */
  public async assignIssue(issueNumber: number, assignees: string[]) {
    try {
      this.logger.info(`Assigning users ${assignees.join(', ')} to issue #${issueNumber}`);
      return await this.octokit.rest.issues.addAssignees({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: issueNumber,
        assignees,
      });
    } catch (error) {
      this.logger.error(`Failed to assign users to issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a new pull request
   * @param title Pull request title
   * @param body Pull request body
   * @param head Head branch
   * @param base Base branch
   * @returns Created pull request
   */
  public async createPullRequest(title: string, body: string, head: string, base: string) {
    try {
      this.logger.info(`Creating pull request: ${title} (${head} → ${base})`);
      return await this.octokit.rest.pulls.create({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        title,
        body,
        head,
        base,
      });
    } catch (error) {
      this.logger.error(`Failed to create pull request: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a pull request by number
   * @param pullNumber Pull request number
   * @returns Pull request information
   */
  public async getPullRequest(pullNumber: number) {
    try {
      this.logger.info(`Getting pull request #${pullNumber}`);
      return await this.octokit.rest.pulls.get({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: pullNumber,
      });
    } catch (error) {
      this.logger.error(`Failed to get pull request #${pullNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a comment on a pull request
   * @param pullNumber Pull request number
   * @param body Comment body
   * @returns Created comment
   */
  public async createPullRequestComment(pullNumber: number, body: string) {
    try {
      this.logger.info(`Creating comment on pull request #${pullNumber}`);
      return await this.octokit.rest.issues.createComment({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        issue_number: pullNumber,
        body,
      });
    } catch (error) {
      this.logger.error(`Failed to create comment on pull request #${pullNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a review comment on a pull request
   * @param pullNumber Pull request number
   * @param body Comment body
   * @param commitId Commit ID
   * @param path File path
   * @param position Position in the diff
   * @returns Created review comment
   */
  public async createPullRequestReviewComment(pullNumber: number, body: string, commitId: string, path: string, position: number) {
    try {
      this.logger.info(`Creating review comment on pull request #${pullNumber}`);
      return await this.octokit.rest.pulls.createReviewComment({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: pullNumber,
        body,
        commit_id: commitId,
        path,
        position,
      });
    } catch (error) {
      this.logger.error(`Failed to create review comment on pull request #${pullNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Merge a pull request
   * @param pullNumber Pull request number
   * @param commitTitle Commit title (optional)
   * @param commitMessage Commit message (optional)
   * @param mergeMethod Merge method (merge, squash, rebase)
   * @returns Merge result
   */
  public async mergePullRequest(pullNumber: number, commitTitle?: string, commitMessage?: string, mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge') {
    try {
      this.logger.info(`Merging pull request #${pullNumber} using method: ${mergeMethod}`);
      return await this.octokit.rest.pulls.merge({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: pullNumber,
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: mergeMethod,
      });
    } catch (error) {
      this.logger.error(`Failed to merge pull request #${pullNumber}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a repository file content
   * @param path File path
   * @param ref Branch or commit reference
   * @returns File content
   */
  public async getFileContent(path: string, ref?: string) {
    try {
      this.logger.info(`Getting file content: ${path}${ref ? ` (ref: ${ref})` : ''}`);
      return await this.octokit.rest.repos.getContent({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        path,
        ref,
      });
    } catch (error) {
      this.logger.error(`Failed to get file content for ${path}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create or update a file in the repository
   * @param path File path
   * @param message Commit message
   * @param content File content
   * @param branch Branch name
   * @param sha File SHA (required for updates)
   * @returns API response
   */
  public async createOrUpdateFile(path: string, message: string, content: string, branch: string, sha?: string) {
    try {
      this.logger.info(`${sha ? 'Updating' : 'Creating'} file: ${path} on branch ${branch}`);
      return await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        sha, // Provide sha if updating an existing file
      });
    } catch (error) {
      this.logger.error(`Failed to ${sha ? 'update' : 'create'} file ${path}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Delete a file from the repository
   * @param path File path
   * @param message Commit message
   * @param branch Branch name
   * @param sha File SHA
   * @returns API response
   */
  public async deleteFile(path: string, message: string, branch: string, sha: string) {
    try {
      this.logger.info(`Deleting file: ${path} on branch ${branch}`);
      return await this.octokit.rest.repos.deleteFile({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        path,
        message,
        branch,
        sha,
      });
    } catch (error) {
      this.logger.error(`Failed to delete file ${path}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a branch
   * @param branch Branch name
   * @returns Branch information
   */
  public async getBranch(branch: string) {
    try {
      this.logger.info(`Getting branch: ${branch}`);
      return await this.octokit.rest.repos.getBranch({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        branch,
      });
    } catch (error) {
      this.logger.error(`Failed to get branch ${branch}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List branches for a repository
   * @param protected_only Only list protected branches
   * @returns List of branches
   */
  public async listBranches(protected_only?: boolean) {
    try {
      this.logger.info(`Listing branches${protected_only ? ' (protected only)' : ''}`);
      return await this.octokit.rest.repos.listBranches({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        protected: protected_only,
      });
    } catch (error) {
      this.logger.error(`Failed to list branches: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a new branch
   * @param branch Branch name
   * @param sha SHA of the commit to branch from
   * @returns API response
   */
  public async createBranch(branch: string, sha: string) {
    try {
      this.logger.info(`Creating branch: ${branch} from ${sha}`);
      return await this.octokit.rest.git.createRef({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        ref: `refs/heads/${branch}`,
        sha,
      });
    } catch (error) {
      this.logger.error(`Failed to create branch ${branch}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a commit
   * @param sha Commit SHA
   * @returns Commit information
   */
  public async getCommit(sha: string) {
    try {
      this.logger.info(`Getting commit: ${sha}`);
      return await this.octokit.rest.repos.getCommit({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        ref: sha,
      });
    } catch (error) {
      this.logger.error(`Failed to get commit ${sha}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List commits for a repository
   * @param branch Branch name
   * @param path File path
   * @param author Author username
   * @returns List of commits
   */
  public async listCommits(branch?: string, path?: string, author?: string) {
    try {
      this.logger.info(`Listing commits${branch ? ` for branch ${branch}` : ''}${path ? ` in path ${path}` : ''}${author ? ` by ${author}` : ''}`);
      return await this.octokit.rest.repos.listCommits({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        sha: branch,
        path,
        author,
      });
    } catch (error) {
      this.logger.error(`Failed to list commits: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Compare two commits
   * @param base Base commit
   * @param head Head commit
   * @returns Comparison result
   */
  public async compareCommits(base: string, head: string) {
    try {
      this.logger.info(`Comparing commits: ${base}...${head}`);
      return await this.octokit.rest.repos.compareCommits({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        base,
        head,
      });
    } catch (error) {
      this.logger.error(`Failed to compare commits ${base}...${head}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a release
   * @param tagName Tag name
   * @param name Release name
   * @param body Release description
   * @param targetCommitish Target commit/branch
   * @param draft Whether it's a draft release
   * @param prerelease Whether it's a prerelease
   * @returns Created release
   */
  public async createRelease(tagName: string, name: string, body: string, targetCommitish?: string, draft?: boolean, prerelease?: boolean) {
    try {
      this.logger.info(`Creating release: ${name} (${tagName})`);
      return await this.octokit.rest.repos.createRelease({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        tag_name: tagName,
        name,
        body,
        target_commitish: targetCommitish,
        draft,
        prerelease,
      });
    } catch (error) {
      this.logger.error(`Failed to create release ${name}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List releases for a repository
   * @returns List of releases
   */
  public async listReleases() {
    try {
      this.logger.info('Listing releases');
      return await this.octokit.rest.repos.listReleases({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
      });
    } catch (error) {
      this.logger.error(`Failed to list releases: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a workflow
   * @param workflowId Workflow ID
   * @returns Workflow information
   */
  public async getWorkflow(workflowId: number) {
    try {
      this.logger.info(`Getting workflow: ${workflowId}`);
      return await this.octokit.rest.actions.getWorkflow({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        workflow_id: workflowId,
      });
    } catch (error) {
      this.logger.error(`Failed to get workflow ${workflowId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List workflows for a repository
   * @returns List of workflows
   */
  public async listWorkflows() {
    try {
      this.logger.info('Listing workflows');
      return await this.octokit.rest.actions.listRepoWorkflows({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
      });
    } catch (error) {
      this.logger.error(`Failed to list workflows: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a webhook
   * @param url Webhook URL
   * @param events Events to trigger the webhook
   * @param active Whether the webhook is active
   * @returns Created webhook
   */
  public async createWebhook(url: string, events: string[] = ['push', 'pull_request'], active: boolean = true) {
    try {
      this.logger.info(`Creating webhook for ${url} with events: ${events.join(', ')}`);
      return await this.octokit.rest.repos.createWebhook({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        config: {
          url,
          content_type: 'json',
          insecure_ssl: '0',
        },
        events,
        active,
      });
    } catch (error) {
      this.logger.error(`Failed to create webhook for ${url}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List webhooks for a repository
   * @returns List of webhooks
   */
  public async listWebhooks() {
    try {
      this.logger.info('Listing webhooks');
      return await this.octokit.rest.repos.listWebhooks({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
      });
    } catch (error) {
      this.logger.error(`Failed to list webhooks: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
