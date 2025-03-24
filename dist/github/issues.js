"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueManager = void 0;
class IssueManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }
    /**
     * Get all issues with Stone processing label
     */
    async getStoneIssues() {
        return this.client.getIssuesByLabel(this.config.workflow.stoneLabel);
    }
    /**
     * Process an issue to the next stage based on its current label
     */
    async processIssue(issueNumber) {
        const { data: issue } = await this.client.getIssue(issueNumber);
        const labels = issue.labels.map((label) => {
            return typeof label === 'string' ? label : label.name;
        }).filter(Boolean);
        // Determine the next stage based on current labels
        if (labels.includes(this.config.workflow.stoneLabel)) {
            // Initial stone-process label, move to PM stage
            await this.assignToPM(issueNumber);
            return 'pm';
        }
        else if (labels.includes('stone-qa')) {
            // QA stage
            await this.assignToQA(issueNumber);
            return 'qa';
        }
        else if (labels.includes('stone-actions')) {
            // GitHub Actions stage
            await this.assignToActions(issueNumber);
            return 'actions';
        }
        else if (labels.includes('stone-feature-implement')) {
            // Feature implementation stage
            await this.assignToFeatureTeam(issueNumber);
            return 'feature';
        }
        else if (labels.includes('stone-audit')) {
            // Audit stage
            await this.assignToAuditor(issueNumber);
            return 'audit';
        }
        else if (labels.includes('stone-ready-for-tests')) {
            // Test execution stage
            await this.prepareForTesting(issueNumber);
            return 'testing';
        }
        else if (labels.includes('stone-docs')) {
            // Documentation stage
            await this.assignToPM(issueNumber, 'docs');
            return 'docs';
        }
        else if (labels.includes('stone-pr')) {
            // PR creation stage
            await this.assignToPM(issueNumber, 'pr');
            return 'pr';
        }
        return 'unknown';
    }
    /**
     * Assign issue to PM role
     */
    async assignToPM(issueNumber, task) {
        const comment = task === 'docs'
            ? 'Assigning to PM for documentation updates.'
            : task === 'pr'
                ? 'Assigning to PM for pull request creation.'
                : 'Assigning to PM for Gherkin specification creation.';
        await this.client.createIssueComment(issueNumber, comment);
        // In a real implementation, we would use actual GitHub users for assignees
        // but for now we just use the label to indicate assignment
    }
    /**
     * Assign issue to QA role
     */
    async assignToQA(issueNumber) {
        await this.client.createIssueComment(issueNumber, 'Assigning to QA team for test creation.');
        // Add labels if not already present
        await this.client.addLabelsToIssue(issueNumber, ['stone-qa']);
        // Remove previous stage label if present
        try {
            await this.client.removeLabelFromIssue(issueNumber, this.config.workflow.stoneLabel);
        }
        catch (error) {
            // Ignore if label doesn't exist
        }
    }
    /**
     * Assign issue to GitHub Actions role
     */
    async assignToActions(issueNumber) {
        await this.client.createIssueComment(issueNumber, 'Assigning to GitHub Actions team for workflow setup.');
        // Add labels if not already present
        await this.client.addLabelsToIssue(issueNumber, ['stone-actions']);
        // Remove previous stage label if present
        try {
            await this.client.removeLabelFromIssue(issueNumber, 'stone-qa');
        }
        catch (error) {
            // Ignore if label doesn't exist
        }
    }
    /**
     * Assign issue to Feature team
     */
    async assignToFeatureTeam(issueNumber) {
        const { data: issue } = await this.client.getIssue(issueNumber);
        // Find the appropriate team based on the issue content
        // This is a simplified implementation. In reality, we would analyze the issue
        // to determine which package/team should handle it.
        const team = this.config.packages.length > 0 ? this.config.packages[0].team : 'core-team';
        await this.client.createIssueComment(issueNumber, `Assigning to ${team} for feature implementation.`);
        // Add labels if not already present
        await this.client.addLabelsToIssue(issueNumber, ['stone-feature-implement']);
        // Remove previous stage label if present
        try {
            await this.client.removeLabelFromIssue(issueNumber, 'stone-actions');
        }
        catch (error) {
            // Ignore if label doesn't exist
        }
    }
    /**
     * Assign issue to Auditor
     */
    async assignToAuditor(issueNumber) {
        await this.client.createIssueComment(issueNumber, 'Assigning to Auditor for implementation verification.');
        // Add labels if not already present
        await this.client.addLabelsToIssue(issueNumber, ['stone-audit']);
        // Remove previous stage label if present
        try {
            await this.client.removeLabelFromIssue(issueNumber, 'stone-feature-implement');
        }
        catch (error) {
            // Ignore if label doesn't exist
        }
    }
    /**
     * Prepare issue for test execution
     */
    async prepareForTesting(issueNumber) {
        await this.client.createIssueComment(issueNumber, 'Preparing to run tests for this implementation.');
        // Add labels if not already present
        await this.client.addLabelsToIssue(issueNumber, ['stone-ready-for-tests']);
        // Remove previous stage label if present
        try {
            await this.client.removeLabelFromIssue(issueNumber, 'stone-audit');
        }
        catch (error) {
            // Ignore if label doesn't exist
        }
    }
}
exports.IssueManager = IssueManager;
