import { GitHubClient } from './client';
import { StoneConfig } from '../config';
export declare class IssueTemplateGenerator {
    private client;
    private config;
    constructor(client: GitHubClient, config: StoneConfig);
    /**
     * Create issue templates in the repository
     */
    createIssueTemplates(): Promise<void>;
    /**
     * Create the feature issue template
     */
    private createFeatureTemplate;
}
