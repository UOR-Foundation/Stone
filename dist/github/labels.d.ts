import { GitHubClient } from './client';
import { StoneConfig } from '../config';
export declare class LabelManager {
    private client;
    private config;
    constructor(client: GitHubClient, config: StoneConfig);
    /**
     * Create all required Stone labels in the repository
     */
    createLabels(): Promise<void>;
    /**
     * Create a single label
     */
    private createLabel;
    /**
     * Update an existing label
     */
    private updateLabel;
}
