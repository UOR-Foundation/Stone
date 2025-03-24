import { WorkflowGenerator } from '../../../src/github-actions/workflow-generator';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config/schema';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('WorkflowGenerator', () => {
  let mockClient: jest.Mocked<GitHubClient>;
  let mockConfig: StoneConfig;
  let generator: WorkflowGenerator;

  beforeEach(() => {
    mockClient = {
      octokit: {
        rest: {
          actions: {
            createWorkflowDispatch: jest.fn(),
            getWorkflow: jest.fn(),
            updateWorkflow: jest.fn(),
            createOrUpdateWorkflowFile: jest.fn(),
          },
        },
      },
      getIssue: jest.fn(),
      createIssueComment: jest.fn(),
      addLabelsToIssue: jest.fn(),
      removeLabelFromIssue: jest.fn(),
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
        pm: {
          enabled: true,
          claudeFile: 'PM.CLAUDE.md',
        },
        qa: {
          enabled: true,
          claudeFile: 'QA.CLAUDE.md',
        },
        feature: {
          enabled: true,
          claudeFile: 'FEATURE.CLAUDE.md',
        },
        auditor: {
          enabled: true,
          claudeFile: 'AUDITOR.CLAUDE.md',
        },
        actions: {
          enabled: true,
          claudeFile: 'ACTIONS.CLAUDE.md',
        },
      },
    };

    generator = new WorkflowGenerator(mockClient, mockConfig);

    // Mock fs functions
    const mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.existsSync = jest.fn().mockReturnValue(false);
    mockFs.mkdirSync = jest.fn();
    mockFs.writeFileSync = jest.fn();
    mockFs.readFileSync = jest.fn();

    // Mock path functions
    const mockPath = path as jest.Mocked<typeof path>;
    mockPath.join = jest.fn().mockImplementation((...args) => args.join('/'));
    mockPath.dirname = jest.fn().mockImplementation(filePath => {
      const parts = filePath.split('/');
      parts.pop();
      return parts.join('/');
    });
  });

  test('constructor initializes with client and config', () => {
    expect(generator).toBeDefined();
    expect(generator['client']).toBe(mockClient);
    expect(generator['config']).toBe(mockConfig);
  });

  test('createStoneWorkflow generates basic stone workflow', async () => {
    await generator.createStoneWorkflow();

    // Check if workflow directory was created
    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();

    // Verify that the generated workflow contains expected elements
    const writeFileCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const filePath = writeFileCall[0];
    const fileContent = writeFileCall[1];

    expect(filePath).toContain('.github/workflows/stone-workflow.yml');
    expect(fileContent).toContain('name: Stone Software Factory');
    expect(fileContent).toContain('on:');
    expect(fileContent).toContain('issues:');
    expect(fileContent).toContain('labeled');
  });

  test('createTestWorkflow generates test workflow file', async () => {
    await generator.createTestWorkflow();

    // Verify that the test workflow was created
    const writeFileCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const filePath = writeFileCall[0];
    const fileContent = writeFileCall[1];

    expect(filePath).toContain('.github/workflows/stone-test.yml');
    expect(fileContent).toContain('name: Stone Test Runner');
    expect(fileContent).toContain('stone-ready-for-tests');
    expect(fileContent).toContain('npx stone run --workflow test');
  });

  test('createWebhookWorkflow generates webhook handling workflow', async () => {
    await generator.createWebhookWorkflow();

    // Verify that the webhook workflow was created
    const writeFileCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const filePath = writeFileCall[0];
    const fileContent = writeFileCall[1];

    expect(filePath).toContain('.github/workflows/stone-webhook.yml');
    expect(fileContent).toContain('name: Stone Webhook Handler');
    expect(fileContent).toContain('repository_dispatch');
  });

  test('updateWorkflow can update an existing workflow', async () => {
    // Mock that file exists
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('existing content');

    await generator.updateWorkflow('stone-workflow.yml', { 
      name: 'Updated Workflow',
      on: { issues: { types: ['opened', 'edited'] } },
      jobs: { test: { name: 'Test Job', 'runs-on': 'ubuntu-latest', steps: [] } }
    });

    // Verify file was updated
    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeFileCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const fileContent = writeFileCall[1];
    
    expect(fileContent).toContain('name: Updated Workflow');
  });

  test('processIssueWithActionsLabel generates workflow for labeled issue', async () => {
    const issueNumber = 123;
    
    // Mock the getIssue response
    mockClient.getIssue.mockResolvedValue({
      data: {
        number: issueNumber,
        title: 'Test Issue',
        body: 'This is a test issue for GitHub Actions',
        labels: [{ name: 'stone-actions' }]
      }
    });
    
    await generator.processIssueWithActionsLabel(issueNumber);
    
    // Verify a comment was added to the issue
    expect(mockClient.createIssueComment).toHaveBeenCalledWith(
      issueNumber,
      expect.stringContaining('GitHub Actions')
    );
    
    // Verify labels were updated
    expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
      issueNumber,
      ['stone-feature-implement']
    );
    expect(mockClient.removeLabelFromIssue).toHaveBeenCalledWith(
      issueNumber,
      'stone-actions'
    );
  });
});