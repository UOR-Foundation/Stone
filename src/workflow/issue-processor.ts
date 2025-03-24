import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { Logger } from '../utils/logger';

/**
 * Handles issue processing and manages the workflow progression through stages
 */
export class IssueProcessor {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
  }

  /**
   * Process an issue to determine its current stage and execute appropriate actions
   */
  public async processIssue(issueNumber: number): Promise<string> {
    const { data: issue } = await this.client.getIssue(issueNumber);
    const labels = issue.labels.map((label: any) => {
      return typeof label === 'string' ? label : label.name;
    }).filter(Boolean) as string[];

    // Record issue history entry for tracking
    await this.recordHistoryEntry(issueNumber, 'Processing started');

    // Determine the current stage based on labels
    if (labels.includes(this.config.workflow.stoneLabel)) {
      await this.handleNewIssue(issueNumber, issue);
      return 'pm';
    } else if (labels.includes('stone-pm')) {
      await this.handlePMStage(issueNumber, issue);
      return 'pm';
    } else if (labels.includes('stone-qa')) {
      await this.handleQAStage(issueNumber, issue);
      return 'qa';
    } else if (labels.includes('stone-feature-implement')) {
      await this.handleFeatureImplementationStage(issueNumber, issue);
      return 'feature';
    } else if (labels.includes('stone-audit')) {
      await this.handleAuditStage(issueNumber, issue);
      return 'audit';
    } else if (labels.includes('stone-ready-for-tests')) {
      await this.handleTestingStage(issueNumber, issue);
      return 'testing';
    } else if (labels.includes('stone-docs')) {
      await this.handleDocsStage(issueNumber, issue);
      return 'docs';
    } else if (labels.includes('stone-pr')) {
      await this.handlePRStage(issueNumber, issue);
      return 'pr';
    }

    // If we can't determine the stage, return unknown
    await this.recordHistoryEntry(issueNumber, 'Unknown stage');
    return 'unknown';
  }

  /**
   * Handle a new issue with the stone-process label
   */
  private async handleNewIssue(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing new Stone issue: #${issueNumber} - ${issue.title}`);
    
    // Add a comment about the process
    await this.client.createIssueComment(
      issueNumber,
      `## Stone Workflow Started\n\nThis issue will be processed through the Stone workflow system.`
    );

    // Transition to PM stage
    await this.client.addLabelsToIssue(issueNumber, ['stone-pm']);
    await this.client.removeLabelFromIssue(issueNumber, this.config.workflow.stoneLabel);
    
    // Generate Gherkin specifications
    await this.generateGherkinSpec(issueNumber);
    
    await this.recordHistoryEntry(issueNumber, 'Workflow Stage: PM');
  }

  /**
   * Handle an issue in the PM stage
   */
  private async handlePMStage(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing PM stage for issue: #${issueNumber}`);
    
    // Check if Gherkin spec has been generated
    const { data: comments } = await this.client.octokit.rest.issues.listComments({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber
    });

    // Check if any of the comments contain a Gherkin spec
    const hasGherkinSpec = comments.some((comment: { body?: string }) => 
      comment.body && comment.body.includes('## Gherkin Specification')
    );

    if (!hasGherkinSpec) {
      // Generate Gherkin specification
      await this.generateGherkinSpec(issueNumber);
    } else {
      // If Gherkin spec exists, move to QA stage
      await this.client.createIssueComment(
        issueNumber,
        `## Moving to QA Stage\n\nThe Gherkin specifications have been generated. Moving this issue to the QA stage for test creation.`
      );
      
      await this.client.addLabelsToIssue(issueNumber, ['stone-qa']);
      await this.client.removeLabelFromIssue(issueNumber, 'stone-pm');
      
      await this.recordHistoryEntry(issueNumber, 'Workflow Stage: QA');
    }
  }

  /**
   * Handle an issue in the QA stage
   */
  private async handleQAStage(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing QA stage for issue: #${issueNumber}`);
    
    await this.client.createIssueComment(
      issueNumber,
      `## QA Stage Active\n\nGenerating test files based on Gherkin specifications.`
    );
    
    // Test framework integration would happen here, but we'll implement that in test-framework.ts
    
    await this.recordHistoryEntry(issueNumber, 'Workflow Stage: QA - Generating tests');
  }

  /**
   * Handle an issue in the feature implementation stage
   */
  private async handleFeatureImplementationStage(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing feature implementation stage for issue: #${issueNumber}`);
    
    await this.client.createIssueComment(
      issueNumber,
      `## Feature Implementation Stage\n\nImplementing feature based on specifications and tests.`
    );
    
    await this.recordHistoryEntry(issueNumber, 'Workflow Stage: Feature Implementation');
  }

  /**
   * Handle an issue in the audit stage
   */
  private async handleAuditStage(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing audit stage for issue: #${issueNumber}`);
    
    await this.client.createIssueComment(
      issueNumber,
      `## Audit Stage\n\nVerifying implementation against requirements and quality standards.`
    );
    
    await this.recordHistoryEntry(issueNumber, 'Workflow Stage: Audit');
  }

  /**
   * Handle an issue in the testing stage
   */
  private async handleTestingStage(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing testing stage for issue: #${issueNumber}`);
    
    await this.client.createIssueComment(
      issueNumber,
      `## Testing Stage\n\nRunning tests for the implemented feature.`
    );
    
    await this.recordHistoryEntry(issueNumber, 'Workflow Stage: Testing');
  }

  /**
   * Handle an issue in the docs stage
   */
  private async handleDocsStage(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing docs stage for issue: #${issueNumber}`);
    
    await this.client.createIssueComment(
      issueNumber,
      `## Documentation Stage\n\nUpdating documentation for the implemented feature.`
    );
    
    await this.recordHistoryEntry(issueNumber, 'Workflow Stage: Documentation');
  }

  /**
   * Handle an issue in the PR stage
   */
  private async handlePRStage(issueNumber: number, issue: any): Promise<void> {
    this.logger.info(`Processing PR stage for issue: #${issueNumber}`);
    
    await this.client.createIssueComment(
      issueNumber,
      `## Pull Request Stage\n\nCreating or updating pull request for the implemented feature.`
    );
    
    await this.recordHistoryEntry(issueNumber, 'Workflow Stage: Pull Request');
  }

  /**
   * Generate Gherkin specifications for a feature
   */
  public async generateGherkinSpec(issueNumber: number): Promise<void> {
    this.logger.info(`Generating Gherkin specifications for issue: #${issueNumber}`);
    
    // Get the issue details
    const { data: issue } = await this.client.getIssue(issueNumber);
    
    // Extract the feature title and description
    const featureTitle = issue.title;
    const featureDescription = issue.body || '';
    
    // Generate a basic Gherkin specification based on the issue
    const gherkinSpec = this.createGherkinFromIssue(featureTitle, featureDescription);
    
    // Add a comment with the generated Gherkin
    await this.client.createIssueComment(
      issueNumber,
      `## Gherkin Specification\n\n${gherkinSpec}\n\nPlease review and adjust the specification as needed.`
    );
    
    await this.recordHistoryEntry(issueNumber, 'Gherkin specification generated');
  }

  /**
   * Create a Gherkin specification from issue title and description
   */
  private createGherkinFromIssue(title: string, description: string): string {
    // Extract potential scenarios from the description
    const scenariosText = this.extractScenariosFromDescription(description);
    
    // Create the Gherkin spec
    return `Feature: ${title}
  ${description.split('\n')[0] || 'Description not provided'}

${scenariosText}`;
  }

  /**
   * Extract scenarios from issue description
   */
  private extractScenariosFromDescription(description: string): string {
    // Look for acceptance criteria or similar sections
    const acceptanceCriteriaMatch = description.match(/## Acceptance Criteria([\s\S]*?)(?=## |$)/i);
    
    if (acceptanceCriteriaMatch && acceptanceCriteriaMatch[1]) {
      const criteria = acceptanceCriteriaMatch[1].trim();
      
      // Convert bullet points to scenarios
      return criteria.split(/[\r\n]+/).filter(line => line.trim().startsWith('-')).map(line => {
        const criterionText = line.replace(/^-/, '').trim();
        return this.criterionToScenario(criterionText);
      }).join('\n\n');
    }
    
    // If no acceptance criteria found, create a generic scenario
    return `  Scenario: Successful implementation
    Given the feature is implemented
    When the feature is used
    Then it should work as expected`;
  }

  /**
   * Convert a criterion text to a Gherkin scenario
   */
  private criterionToScenario(criterionText: string): string {
    return `  Scenario: ${criterionText}
    Given the feature is being used
    When the specific condition is met
    Then ${criterionText.toLowerCase()}`;
  }

  /**
   * Record entry in issue history for tracking workflow
   */
  private async recordHistoryEntry(issueNumber: number, status: string): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Update issue history in a structured hidden format
    // This could be stored in a database or a separate system in a real implementation
    // For now, we'll just add a comment with a special format that can be parsed later
    
    await this.client.createIssueComment(
      issueNumber,
      `<!-- STONE_HISTORY_ENTRY
      {
        "timestamp": "${timestamp}",
        "status": "${status}"
      }
      -->`
    );
  }
}