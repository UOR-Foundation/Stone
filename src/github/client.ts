const { Octokit } = require('octokit');
import { StoneConfig } from '../config';

export class GitHubClient {
  public octokit: any;
  private config: StoneConfig;
  private token: string;

  constructor(token: string, config: StoneConfig) {
    this.token = token;
    this.octokit = new Octokit({ auth: token });
    this.config = config;
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
   */
  public async getIssue(issueNumber: number) {
    return this.octokit.rest.issues.get({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber,
    });
  }

  /**
   * Get all issues with a specific label
   */
  public async getIssuesByLabel(label: string) {
    return this.octokit.rest.issues.listForRepo({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      labels: label,
      state: 'open',
    });
  }

  /**
   * Create a comment on an issue
   */
  public async createIssueComment(issueNumber: number, body: string) {
    return this.octokit.rest.issues.createComment({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber,
      body,
    });
  }

  /**
   * Add labels to an issue
   */
  public async addLabelsToIssue(issueNumber: number, labels: string[]) {
    return this.octokit.rest.issues.addLabels({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber,
      labels,
    });
  }

  /**
   * Remove a label from an issue
   */
  public async removeLabelFromIssue(issueNumber: number, label: string) {
    return this.octokit.rest.issues.removeLabel({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber,
      name: label,
    });
  }

  /**
   * Assign users to an issue
   */
  public async assignIssue(issueNumber: number, assignees: string[]) {
    return this.octokit.rest.issues.addAssignees({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber,
      assignees,
    });
  }

  /**
   * Create a new pull request
   */
  public async createPullRequest(title: string, body: string, head: string, base: string) {
    return this.octokit.rest.pulls.create({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      title,
      body,
      head,
      base,
    });
  }

  /**
   * Get a repository file content
   */
  public async getFileContent(path: string, ref?: string) {
    return this.octokit.rest.repos.getContent({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      path,
      ref,
    });
  }

  /**
   * Create or update a file in the repository
   */
  public async createOrUpdateFile(path: string, message: string, content: string, branch: string, sha?: string) {
    return this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha, // Provide sha if updating an existing file
    });
  }
}