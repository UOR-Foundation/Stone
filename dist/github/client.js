"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubClient = void 0;
const octokit_1 = require("octokit");
class GitHubClient {
    constructor(token, config) {
        this.octokit = new octokit_1.Octokit({ auth: token });
        this.config = config;
    }
    /**
     * Get an issue by number
     */
    async getIssue(issueNumber) {
        return this.octokit.rest.issues.get({
            owner: this.config.repository.owner,
            repo: this.config.repository.name,
            issue_number: issueNumber,
        });
    }
    /**
     * Get all issues with a specific label
     */
    async getIssuesByLabel(label) {
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
    async createIssueComment(issueNumber, body) {
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
    async addLabelsToIssue(issueNumber, labels) {
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
    async removeLabelFromIssue(issueNumber, label) {
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
    async assignIssue(issueNumber, assignees) {
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
    async createPullRequest(title, body, head, base) {
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
    async getFileContent(path, ref) {
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
    async createOrUpdateFile(path, message, content, branch, sha) {
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
exports.GitHubClient = GitHubClient;
