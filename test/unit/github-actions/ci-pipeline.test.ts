import { CIPipeline } from '../../../src/github-actions/ci-pipeline';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config/schema';
import { Bash } from '../../../src/utils/bash';

jest.mock('../../../src/utils/bash');

describe('CIPipeline', () => {
  let mockClient: jest.Mocked<GitHubClient>;
  let mockConfig: StoneConfig;
  let mockBash: jest.Mocked<Bash>;
  let pipeline: CIPipeline;

  beforeEach(() => {
    mockClient = {
      octokit: {
        rest: {
          issues: {
            get: jest.fn(),
            createComment: jest.fn(),
            addLabels: jest.fn(),
            removeLabel: jest.fn(),
          },
          repos: {
            createCommitStatus: jest.fn(),
          },
          checks: {
            create: jest.fn(),
            update: jest.fn(),
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
        pm: { enabled: true, claudeFile: 'PM.CLAUDE.md' },
        qa: { enabled: true, claudeFile: 'QA.CLAUDE.md' },
        feature: { enabled: true, claudeFile: 'FEATURE.CLAUDE.md' },
        auditor: { enabled: true, claudeFile: 'AUDITOR.CLAUDE.md' },
        actions: { enabled: true, claudeFile: 'ACTIONS.CLAUDE.md' },
      },
    };

    mockBash = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<Bash>;

    (Bash as jest.Mock).mockImplementation(() => mockBash);

    pipeline = new CIPipeline(mockClient, mockConfig);
  });

  test('constructor initializes with client and config', () => {
    expect(pipeline).toBeDefined();
    expect(pipeline['client']).toBe(mockClient);
    expect(pipeline['config']).toBe(mockConfig);
  });

  test('runTestsForIssue runs tests and updates issue with success', async () => {
    const issueNumber = 123;
    
    // Mock the getIssue response
    mockClient.getIssue.mockResolvedValue({
      data: {
        number: issueNumber,
        title: 'Test Issue',
        body: 'This is a test issue',
        labels: [{ name: 'stone-ready-for-tests' }]
      }
    });
    
    // Mock test execution success
    mockBash.execute.mockResolvedValue({
      stdout: 'All tests passed',
      stderr: '',
      exitCode: 0
    });
    
    await pipeline.runTestsForIssue(issueNumber);
    
    // Check bash command was executed
    expect(mockBash.execute).toHaveBeenCalledWith(
      expect.stringContaining(mockConfig.workflow.testCommand)
    );
    
    // Verify issue was updated with test results
    expect(mockClient.createIssueComment).toHaveBeenCalledWith(
      issueNumber,
      expect.stringContaining('Test Results')
    );
    
    // Verify labels were updated to indicate success
    expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
      issueNumber,
      ['stone-docs']
    );
    expect(mockClient.removeLabelFromIssue).toHaveBeenCalledWith(
      issueNumber,
      'stone-ready-for-tests'
    );
  });

  test('runTestsForIssue handles test failures', async () => {
    const issueNumber = 123;
    
    // Mock the getIssue response
    mockClient.getIssue.mockResolvedValue({
      data: {
        number: issueNumber,
        title: 'Test Issue',
        body: 'This is a test issue',
        labels: [{ name: 'stone-ready-for-tests' }]
      }
    });
    
    // Mock test execution failure
    mockBash.execute.mockResolvedValue({
      stdout: '',
      stderr: 'Error: Test failed',
      exitCode: 1
    });
    
    await pipeline.runTestsForIssue(issueNumber);
    
    // Verify issue was updated with test results
    expect(mockClient.createIssueComment).toHaveBeenCalledWith(
      issueNumber,
      expect.stringContaining('Test Failure')
    );
    
    // Verify labels were updated to indicate failure
    expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
      issueNumber,
      ['stone-test-failure']
    );
  });

  test('runTestPipeline executes tests in sequence', async () => {
    // Mock successful executions
    mockBash.execute
      .mockResolvedValueOnce({ stdout: 'Unit tests passed', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'Integration tests passed', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'E2E tests passed', stderr: '', exitCode: 0 });
    
    const result = await pipeline.runTestPipeline('my-branch', '/path/to/test');
    
    // Should have called bash execute 3 times for the different test types
    expect(mockBash.execute).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.testResults.length).toBe(3);
  });

  test('runTestPipeline stops at first failure', async () => {
    // Mock a failure in integration tests
    mockBash.execute
      .mockResolvedValueOnce({ stdout: 'Unit tests passed', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'Integration tests failed', exitCode: 1 });
    
    const result = await pipeline.runTestPipeline('my-branch', '/path/to/test');
    
    // Should have stopped after 2 executions
    expect(mockBash.execute).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.testResults.length).toBe(2);
    expect(result.testResults[1].success).toBe(false);
  });

  test('updatePRStatus updates PR status based on test results', async () => {
    const prNumber = 456;
    const sha = '123abc';
    const testResults = {
      success: true,
      testResults: [
        { 
          type: 'unit', 
          success: true, 
          output: 'Unit tests passed', 
          duration: 1.5 
        },
        { 
          type: 'integration', 
          success: true, 
          output: 'Integration tests passed', 
          duration: 2.3 
        }
      ]
    };
    
    await pipeline.updatePRStatus(prNumber, sha, testResults);
    
    // Check that PR status was updated
    expect(mockClient.octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: mockConfig.repository.owner,
        repo: mockConfig.repository.name,
        sha,
        state: 'success'
      })
    );
  });

  test('processDeployment executes deployment steps', async () => {
    // Mock a successful deployment
    mockBash.execute.mockResolvedValue({
      stdout: 'Deployment successful',
      stderr: '',
      exitCode: 0
    });
    
    const result = await pipeline.processDeployment('production', 'my-branch');
    
    expect(mockBash.execute).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('processBuildStep executes build process', async () => {
    // Mock a successful build
    mockBash.execute.mockResolvedValue({
      stdout: 'Build completed successfully',
      stderr: '',
      exitCode: 0
    });
    
    const result = await pipeline.processBuildStep('my-branch');
    
    expect(mockBash.execute).toHaveBeenCalledWith(
      expect.stringContaining('npm run build')
    );
    expect(result.success).toBe(true);
  });

  test('createStatusReport generates comprehensive status report', async () => {
    const testResults = {
      success: true,
      testResults: [
        { type: 'unit', success: true, output: 'Unit tests passed', duration: 1.5 },
        { type: 'integration', success: true, output: 'Integration tests passed', duration: 2.3 }
      ]
    };
    
    const buildResult = {
      success: true,
      output: 'Build completed successfully',
      duration: 3.2
    };
    
    const deploymentResult = {
      success: true,
      environment: 'production',
      output: 'Deployment successful',
      duration: 5.1
    };
    
    const report = pipeline.createStatusReport('my-branch', testResults, buildResult, deploymentResult);
    
    expect(report).toContain('## CI/CD Status Report');
    expect(report).toContain('Unit Tests');
    expect(report).toContain('Build');
    expect(report).toContain('Deployment');
    expect(report).toContain('✅ Success');
  });
});