import { GitHubActionsIntegration } from '../../../src/github-actions/github-actions-integration';
import { WorkflowGenerator } from '../../../src/github-actions/workflow-generator';
import { WebhookHandler } from '../../../src/github-actions/webhook-handler';
import { CIPipeline } from '../../../src/github-actions/ci-pipeline';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config/schema';

jest.mock('../../../src/github-actions/workflow-generator');
jest.mock('../../../src/github-actions/webhook-handler');
jest.mock('../../../src/github-actions/ci-pipeline');

describe('GitHubActionsIntegration', () => {
  let mockClient: jest.Mocked<GitHubClient>;
  let mockConfig: StoneConfig;
  let mockWorkflowGenerator: jest.Mocked<WorkflowGenerator>;
  let mockWebhookHandler: jest.Mocked<WebhookHandler>;
  let mockCIPipeline: jest.Mocked<CIPipeline>;
  let integration: GitHubActionsIntegration;

  beforeEach(() => {
    mockClient = {
      octokit: {
        rest: {
          issues: { get: jest.fn() },
        },
      },
    } as unknown as jest.Mocked<GitHubClient>;

    mockConfig = {
      repository: {
        owner: 'test-owner',
        name: 'test-repo',
      },
      packages: [
        {
          name: 'core',
          path: 'packages/core',
          team: 'core-team',
        },
      ],
      workflow: {
        issueTemplate: 'stone-feature.md',
        stoneLabel: 'stone-process',
        useWebhooks: true,
        testCommand: 'npm test',
        timeoutMinutes: 30,
      },
      github: {
        actionsDirectory: '.github/workflows',
        issueTemplateDirectory: '.github/ISSUE_TEMPLATE',
        stoneDirectory: '.github/stone',
      },
      audit: {
        minCodeCoverage: 80,
        requiredReviewers: 1,
        maxComplexity: 20,
        qualityChecks: ['lint', 'types', 'tests'],
      },
      roles: {
        pm: { enabled: true, claudeFile: 'PM.CLAUDE.md' },
        qa: { enabled: true, claudeFile: 'QA.CLAUDE.md' },
        feature: { enabled: true, claudeFile: 'FEATURE.CLAUDE.md' },
        auditor: { enabled: true, claudeFile: 'AUDITOR.CLAUDE.md' },
        actions: { enabled: true, claudeFile: 'ACTIONS.CLAUDE.md' },
      },
    };

    // Setup mocks for component classes
    mockWorkflowGenerator = {
      createStoneWorkflow: jest.fn(),
      createTestWorkflow: jest.fn(),
      createWebhookWorkflow: jest.fn(),
      processIssueWithActionsLabel: jest.fn(),
    } as unknown as jest.Mocked<WorkflowGenerator>;
    
    mockWebhookHandler = {
      handleWebhook: jest.fn(),
      handleIssueLabeled: jest.fn(),
      handlePullRequestEvent: jest.fn(),
    } as unknown as jest.Mocked<WebhookHandler>;
    
    mockCIPipeline = {
      runTestsForIssue: jest.fn(),
      runTestPipeline: jest.fn(),
      updatePRStatus: jest.fn(),
      processDeployment: jest.fn(),
      processBuildStep: jest.fn(),
    } as unknown as jest.Mocked<CIPipeline>;
    
    // Mock the constructors
    (WorkflowGenerator as jest.Mock).mockImplementation(() => mockWorkflowGenerator);
    (WebhookHandler as jest.Mock).mockImplementation(() => mockWebhookHandler);
    (CIPipeline as jest.Mock).mockImplementation(() => mockCIPipeline);
    
    integration = new GitHubActionsIntegration(mockClient, mockConfig);
  });

  test('constructor initializes with client and config', () => {
    expect(integration).toBeDefined();
    expect(integration['client']).toBe(mockClient);
    expect(integration['config']).toBe(mockConfig);
    
    // Check that component classes are instantiated
    expect(WorkflowGenerator).toHaveBeenCalledWith(mockClient, mockConfig);
    expect(WebhookHandler).toHaveBeenCalledWith(mockClient, mockConfig);
    expect(CIPipeline).toHaveBeenCalledWith(mockClient, mockConfig);
    
    expect(integration['workflowGenerator']).toBe(mockWorkflowGenerator);
    expect(integration['webhookHandler']).toBe(mockWebhookHandler);
    expect(integration['ciPipeline']).toBe(mockCIPipeline);
  });

  test('initialize creates all GitHub workflow files', async () => {
    await integration.initialize();
    
    expect(mockWorkflowGenerator.createStoneWorkflow).toHaveBeenCalled();
    expect(mockWorkflowGenerator.createTestWorkflow).toHaveBeenCalled();
    expect(mockWorkflowGenerator.createWebhookWorkflow).toHaveBeenCalled();
  });

  test('processWebhook passes event to webhook handler', async () => {
    const event = { type: 'issues.labeled', payload: { issue: { number: 123 } } };
    
    await integration.processWebhook(event.type, event.payload);
    
    expect(mockWebhookHandler.handleWebhook).toHaveBeenCalledWith(
      event.type,
      event.payload
    );
  });

  test('processActionsIssue calls workflow generator', async () => {
    const issueNumber = 123;
    
    await integration.processActionsIssue(issueNumber);
    
    expect(mockWorkflowGenerator.processIssueWithActionsLabel).toHaveBeenCalledWith(
      issueNumber
    );
  });

  test('processTestingIssue calls CI pipeline', async () => {
    const issueNumber = 123;
    
    await integration.processTestingIssue(issueNumber);
    
    expect(mockCIPipeline.runTestsForIssue).toHaveBeenCalledWith(
      issueNumber
    );
  });

  test('processDeployment calls CI pipeline', async () => {
    const environment = 'production';
    const branch = 'main';
    
    await integration.processDeployment(environment, branch);
    
    expect(mockCIPipeline.processDeployment).toHaveBeenCalledWith(
      environment,
      branch
    );
  });

  test('processIssue routes to appropriate handler based on label', async () => {
    // Mock getIssue to return different labels
    const issueNumber = 123;
    
    // Test stone-actions label
    mockClient.octokit.rest.issues.get.mockResolvedValueOnce({
      data: {
        number: issueNumber,
        labels: [{ name: 'stone-actions' }]
      }
    });
    
    await integration.processIssue(issueNumber);
    expect(mockWorkflowGenerator.processIssueWithActionsLabel).toHaveBeenCalledWith(issueNumber);
    
    // Test stone-ready-for-tests label
    mockClient.octokit.rest.issues.get.mockResolvedValueOnce({
      data: {
        number: issueNumber,
        labels: [{ name: 'stone-ready-for-tests' }]
      }
    });
    
    await integration.processIssue(issueNumber);
    expect(mockCIPipeline.runTestsForIssue).toHaveBeenCalledWith(issueNumber);
    
    // Test unrecognized label
    mockClient.octokit.rest.issues.get.mockResolvedValueOnce({
      data: {
        number: issueNumber,
        labels: [{ name: 'other-label' }]
      }
    });
    
    await integration.processIssue(issueNumber);
    // Should not call any handlers for unrecognized labels
    expect(mockWorkflowGenerator.processIssueWithActionsLabel).toHaveBeenCalledTimes(1);
    expect(mockCIPipeline.runTestsForIssue).toHaveBeenCalledTimes(1);
  });
});