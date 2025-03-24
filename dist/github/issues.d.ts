import { GitHubClient } from './client';
import { StoneConfig } from '../config';
export declare class IssueManager {
    private client;
    private config;
    constructor(client: GitHubClient, config: StoneConfig);
    /**
     * Get all issues with Stone processing label
     */
    getStoneIssues(): Promise<any>;
    /**
     * Process an issue to the next stage based on its current label
     */
    processIssue(issueNumber: number): Promise<"pm" | "qa" | "actions" | "feature" | "audit" | "testing" | "docs" | "pr" | "unknown">;
    /**
     * Assign issue to PM role
     */
    private assignToPM;
    /**
     * Assign issue to QA role
     */
    private assignToQA;
    /**
     * Assign issue to GitHub Actions role
     */
    private assignToActions;
    /**
     * Assign issue to Feature team
     */
    private assignToFeatureTeam;
    /**
     * Assign issue to Auditor
     */
    private assignToAuditor;
    /**
     * Prepare issue for test execution
     */
    private prepareForTesting;
}
