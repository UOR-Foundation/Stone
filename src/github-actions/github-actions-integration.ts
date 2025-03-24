import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config/schema';
import { Logger } from '../utils/logger';
import { WorkflowGenerator } from './workflow-generator';
import { WebhookHandler } from './webhook-handler';
import { CIPipeline } from './ci-pipeline';

/**
 * Main integration class for GitHub Actions functionality
 * Coordinates between WorkflowGenerator, WebhookHandler, and CIPipeline
 */
export class GitHubActionsIntegration {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;
  private workflowGenerator: WorkflowGenerator;
  private webhookHandler: WebhookHandler;
  private ciPipeline: CIPipeline;

  /**
   * Initialize the GitHub Actions integration with client and config
   */
  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
    
    // Initialize component classes
    this.workflowGenerator = new WorkflowGenerator(client, config);
    this.webhookHandler = new WebhookHandler(client, config);
    this.ciPipeline = new CIPipeline(client, config);
  }

  /**
   * Initialize GitHub Actions workflows
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing GitHub Actions workflows');
    
    // Create workflow files
    await this.workflowGenerator.createStoneWorkflow();
    await this.workflowGenerator.createTestWorkflow();
    if (this.config.workflow.useWebhooks) {
      await this.workflowGenerator.createWebhookWorkflow();
    }
    
    this.logger.success('GitHub Actions workflows initialized');
  }

  /**
   * Process a webhook event
   */
  public async processWebhook(eventType: string, payload: any): Promise<void> {
    this.logger.info(`Processing webhook event: ${eventType}`);
    await this.webhookHandler.handleWebhook(eventType, payload);
  }

  /**
   * Process an issue with the 'stone-actions' label
   */
  public async processActionsIssue(issueNumber: number): Promise<void> {
    this.logger.info(`Processing GitHub Actions for issue #${issueNumber}`);
    await this.workflowGenerator.processIssueWithActionsLabel(issueNumber);
  }

  /**
   * Process an issue with the 'stone-ready-for-tests' label
   */
  public async processTestingIssue(issueNumber: number): Promise<void> {
    this.logger.info(`Running tests for issue #${issueNumber}`);
    await this.ciPipeline.runTestsForIssue(issueNumber);
  }

  /**
   * Run a test pipeline for a branch
   */
  public async runTestPipeline(branch: string, testPath?: string): Promise<any> {
    this.logger.info(`Running test pipeline for branch ${branch}`);
    return await this.ciPipeline.runTestPipeline(branch, testPath);
  }

  /**
   * Update a pull request status based on test results
   */
  public async updatePRStatus(prNumber: number, sha: string, testResults: any): Promise<void> {
    this.logger.info(`Updating PR #${prNumber} status based on test results`);
    await this.ciPipeline.updatePRStatus(prNumber, sha, testResults);
  }

  /**
   * Process a deployment to an environment
   */
  public async processDeployment(environment: string, branch: string): Promise<any> {
    this.logger.info(`Processing deployment of ${branch} to ${environment}`);
    return await this.ciPipeline.processDeployment(environment, branch);
  }

  /**
   * Run the build process for a branch
   */
  public async processBuildStep(branch: string): Promise<any> {
    this.logger.info(`Running build process for branch ${branch}`);
    return await this.ciPipeline.processBuildStep(branch);
  }

  /**
   * Process an issue based on its labels
   */
  public async processIssue(issueNumber: number): Promise<void> {
    // Get the issue to determine its labels
    const { data: issue } = await this.client.octokit.rest.issues.get({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber
    });

    // Extract labels
    const labels = issue.labels.map((label: any) => 
      typeof label === 'string' ? label : label.name
    );

    // Process based on label
    if (labels.includes('stone-actions')) {
      await this.processActionsIssue(issueNumber);
    } else if (labels.includes('stone-ready-for-tests')) {
      await this.processTestingIssue(issueNumber);
    } else {
      this.logger.info(`Issue #${issueNumber} does not have a recognized GitHub Actions label`);
    }
  }

  /**
   * Create a comprehensive status report
   */
  public createStatusReport(branch: string, testResults: any, buildResult: any, deploymentResult?: any): string {
    return this.ciPipeline.createStatusReport(branch, testResults, buildResult, deploymentResult);
  }
}