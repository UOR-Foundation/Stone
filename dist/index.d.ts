import { StoneConfig } from './config';
/**
 * Initialize Stone in a repository
 */
export declare function init(options?: {
    owner?: string;
    name?: string;
    token?: string;
}): Promise<void>;
/**
 * Process a GitHub webhook event
 */
export declare function processEvent(event: any): Promise<void>;
/**
 * Run a specific workflow manually
 */
export declare function runWorkflow(workflowType: string, issueNumber: number, options?: {
    token?: string;
}): Promise<void>;
export { StoneConfig };
