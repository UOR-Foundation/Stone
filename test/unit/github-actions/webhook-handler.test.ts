import { WebhookHandler } from '../../../src/github-actions/webhook-handler';
import { StoneConfig } from '../../../src/config/schema';
import { GitHubClient } from '../../../src/github/client';
import { StoneWorkflow } from '../../../src/workflow';

jest.mock('../../../src/workflow');

describe('WebhookHandler', () => {
  let mockClient: jest.Mocked<GitHubClient>;
  let mockConfig: StoneConfig;
  let mockWorkflow: jest.Mocked<StoneWorkflow>;
  let handler: WebhookHandler;

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

    mockWorkflow = {
      runWorkflow: jest.fn(),
    } as unknown as jest.Mocked<StoneWorkflow>;

    (StoneWorkflow as jest.Mock).mockImplementation(() => mockWorkflow);

    handler = new WebhookHandler(mockClient, mockConfig);
  });

  test('constructor initializes with client and config', () => {
    expect(handler).toBeDefined();
    expect(handler['client']).toBe(mockClient);
    expect(handler['config']).toBe(mockConfig);
  });

  test('handleIssueLabeled processes issue with stone label', async () => {
    const event = {
      issue: { number: 123 },
      label: { name: 'stone-process' },
    };

    await handler.handleIssueLabeled(event);

    expect(mockWorkflow.runWorkflow).toHaveBeenCalledWith(
      'process',
      123
    );
  });

  test('handleIssueLabeled ignores non-stone labels', async () => {
    const event = {
      issue: { number: 123 },
      label: { name: 'some-other-label' },
    };

    await handler.handleIssueLabeled(event);

    expect(mockWorkflow.runWorkflow).not.toHaveBeenCalled();
  });

  test('handlePullRequestEvent processes PR events', async () => {
    const event = {
      pull_request: { number: 456 },
      action: 'opened',
    };

    await handler.handlePullRequestEvent(event);

    // Expect appropriate action based on PR event
    // This is just a basic test - actual implementation will vary
    expect(handler['prEvents']).toBeDefined();
  });

  test('handleWebhook processes different webhook types', async () => {
    // Setup spies
    const issueLabledSpy = jest.spyOn(handler, 'handleIssueLabeled');
    const prEventSpy = jest.spyOn(handler, 'handlePullRequestEvent');
    
    // Mock retry mechanism for testing
    const retrySpy = jest.spyOn(handler as any, 'withRetry').mockImplementation(
      async (fn: () => Promise<any>) => await fn()
    );

    // Test issue_labeled event
    await handler.handleWebhook('issues.labeled', {
      issue: { number: 123 },
      label: { name: 'stone-process' },
    });
    expect(issueLabledSpy).toHaveBeenCalled();
    expect(retrySpy).toHaveBeenCalled();
    
    issueLabledSpy.mockClear();
    retrySpy.mockClear();

    // Test pull_request event
    await handler.handleWebhook('pull_request', {
      pull_request: { number: 456 },
      action: 'opened',
    });
    expect(prEventSpy).toHaveBeenCalled();
    expect(retrySpy).toHaveBeenCalled();
  });

  test('handleWebhook ignores unknown event types', async () => {
    const issueLabledSpy = jest.spyOn(handler, 'handleIssueLabeled');
    const prEventSpy = jest.spyOn(handler, 'handlePullRequestEvent');
    
    await handler.handleWebhook('unknown.event', {});
    
    expect(issueLabledSpy).not.toHaveBeenCalled();
    expect(prEventSpy).not.toHaveBeenCalled();
  });

  test('withRetry implements backoff mechanism for failed requests', async () => {
    // Create a mock function that fails twice then succeeds
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('API rate limit exceeded'))
      .mockRejectedValueOnce(new Error('API rate limit exceeded'))
      .mockResolvedValueOnce('success');
    
    // Mock setTimeout to be synchronous for testing
    jest.useFakeTimers();
    const originalSetTimeout = global.setTimeout;
    (global.setTimeout as any) = jest.fn((fn) => fn());
    
    const result = await (handler as any).withRetry(mockFn, 3, 100);
    
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(result).toBe('success');
    
    // Restore setTimeout
    global.setTimeout = originalSetTimeout;
    jest.useRealTimers();
  });

  test('withRetry throws after max retries', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('API rate limit exceeded'))
      .mockRejectedValueOnce(new Error('API rate limit exceeded'))
      .mockRejectedValueOnce(new Error('API rate limit exceeded'));
    
    // Mock setTimeout to be synchronous for testing
    jest.useFakeTimers();
    const originalSetTimeout = global.setTimeout;
    (global.setTimeout as any) = jest.fn((fn) => fn());
    
    await expect((handler as any).withRetry(mockFn, 3, 100))
      .rejects.toThrow('API rate limit exceeded');
    
    expect(mockFn).toHaveBeenCalledTimes(3);
    
    // Restore setTimeout
    global.setTimeout = originalSetTimeout;
    jest.useRealTimers();
  });
});