import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
export declare class StoneWorkflow {
    private client;
    private config;
    private logger;
    constructor(client: GitHubClient, config: StoneConfig);
    /**
     * Run a specific workflow for an issue
     */
    runWorkflow(workflowType: string, issueNumber: number): Promise<void>;
    /**
     * Run Product Manager workflow
     */
    private runPMWorkflow;
    /**
     * Run QA workflow
     */
    private runQAWorkflow;
    /**
     * Run Feature team workflow
     */
    private runFeatureWorkflow;
    /**
     * Run Auditor workflow
     */
    private runAuditorWorkflow;
    /**
     * Run GitHub Actions workflow
     */
    private runActionsWorkflow;
    /**
     * Run Test execution workflow
     */
    private runTestWorkflow;
    /**
     * Run Documentation workflow
     */
    private runDocsWorkflow;
    /**
     * Run Pull Request workflow
     */
    private runPRWorkflow;
}
