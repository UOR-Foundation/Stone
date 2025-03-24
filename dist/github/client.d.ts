import { Octokit } from 'octokit';
import { StoneConfig } from '../config';
export declare class GitHubClient {
    octokit: Octokit;
    private config;
    constructor(token: string, config: StoneConfig);
    /**
     * Get an issue by number
     */
    getIssue(issueNumber: number): Promise<any>;
    /**
     * Get all issues with a specific label
     */
    getIssuesByLabel(label: string): Promise<any>;
    /**
     * Create a comment on an issue
     */
    createIssueComment(issueNumber: number, body: string): Promise<any>;
    /**
     * Add labels to an issue
     */
    addLabelsToIssue(issueNumber: number, labels: string[]): Promise<any>;
    /**
     * Remove a label from an issue
     */
    removeLabelFromIssue(issueNumber: number, label: string): Promise<any>;
    /**
     * Assign users to an issue
     */
    assignIssue(issueNumber: number, assignees: string[]): Promise<any>;
    /**
     * Create a new pull request
     */
    createPullRequest(title: string, body: string, head: string, base: string): Promise<any>;
    /**
     * Get a repository file content
     */
    getFileContent(path: string, ref?: string): Promise<any>;
    /**
     * Create or update a file in the repository
     */
    createOrUpdateFile(path: string, message: string, content: string, branch: string, sha?: string): Promise<any>;
}
