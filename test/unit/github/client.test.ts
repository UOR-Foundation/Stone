import { Octokit } from 'octokit';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config/schema';
import { Logger } from '../../../src/utils/logger';

jest.mock('octokit');
jest.mock('../../../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockOctokit: jest.Mocked<Octokit>;
  let mockConfig: StoneConfig;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOctokit = {
      rest: {
        users: {
          getAuthenticated: jest.fn().mockResolvedValue({ data: { login: 'test-user' } }),
        },
        repos: {
          get: jest.fn().mockResolvedValue({ data: { name: 'test-repo' } }),
          getContent: jest.fn().mockResolvedValue({ data: { content: 'dGVzdCBjb250ZW50', sha: 'abc123' } }),
          createOrUpdateFileContents: jest.fn().mockResolvedValue({ data: { content: { sha: 'def456' } } }),
          deleteFile: jest.fn().mockResolvedValue({ data: {} }),
          getBranch: jest.fn().mockResolvedValue({ data: { name: 'main' } }),
          listBranches: jest.fn().mockResolvedValue({ data: [{ name: 'main' }] }),
          createRelease: jest.fn().mockResolvedValue({ data: { id: 123 } }),
          listReleases: jest.fn().mockResolvedValue({ data: [{ id: 123 }] }),
          compareCommits: jest.fn().mockResolvedValue({ data: {} }),
          getCommit: jest.fn().mockResolvedValue({ data: {} }),
          listCommits: jest.fn().mockResolvedValue({ data: [] }),
          createWebhook: jest.fn().mockResolvedValue({ data: {} }),
          listWebhooks: jest.fn().mockResolvedValue({ data: [] }),
        },
        git: {
          createRef: jest.fn().mockResolvedValue({ data: {} }),
        },
        issues: {
          get: jest.fn().mockResolvedValue({ data: { number: 123 } }),
          listForRepo: jest.fn().mockResolvedValue({ data: [] }),
          listComments: jest.fn().mockResolvedValue({ data: [] }),
          createComment: jest.fn().mockResolvedValue({ data: { id: 456 } }),
          updateComment: jest.fn().mockResolvedValue({ data: {} }),
          addLabels: jest.fn().mockResolvedValue({ data: {} }),
          removeLabel: jest.fn().mockResolvedValue({ data: {} }),
          addAssignees: jest.fn().mockResolvedValue({ data: {} }),
          listEventsForTimeline: jest.fn().mockResolvedValue({ data: [] }),
        },
        pulls: {
          list: jest.fn().mockResolvedValue({ data: [] }),
          get: jest.fn().mockResolvedValue({ data: { number: 789 } }),
          create: jest.fn().mockResolvedValue({ data: { number: 789 } }),
          createReviewComment: jest.fn().mockResolvedValue({ data: {} }),
          merge: jest.fn().mockResolvedValue({ data: { merged: true } }),
        },
        actions: {
          getWorkflow: jest.fn().mockResolvedValue({ data: {} }),
          listRepoWorkflows: jest.fn().mockResolvedValue({ data: { workflows: [] } }),
        },
      },
    } as unknown as jest.Mocked<Octokit>;
    
    (Octokit as jest.Mock).mockImplementation(() => mockOctokit);
    
    mockConfig = {
      repository: {
        owner: 'test-owner',
        name: 'test-repo',
      },
      packages: [{ name: 'core', path: 'packages/core', team: 'core-team' }],
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
      roles: {
        pm: { enabled: true, claudeFile: 'PM.CLAUDE.md' },
        qa: { enabled: true, claudeFile: 'QA.CLAUDE.md' },
        feature: { enabled: true, claudeFile: 'FEATURE.CLAUDE.md' },
        auditor: { enabled: true, claudeFile: 'AUDITOR.CLAUDE.md' },
        actions: { enabled: true, claudeFile: 'ACTIONS.CLAUDE.md' },
      },
    };
    
    client = new GitHubClient('test-token', mockConfig);
  });
  
  describe('constructor', () => {
    test('initializes with token and config', () => {
      expect(client).toBeDefined();
      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(client.getToken()).toBe('test-token');
    });
  });
  
  describe('getCurrentUser', () => {
    test('calls Octokit getAuthenticated', async () => {
      const result = await client.getCurrentUser();
      
      expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalled();
      expect(result.data.login).toBe('test-user');
    });
    
    test('handles errors', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValueOnce(new Error('API error'));
      
      await expect(client.getCurrentUser()).rejects.toThrow('API error');
    });
  });
  
  describe('getRepository', () => {
    test('calls Octokit repos.get with owner and repo name', async () => {
      const result = await client.getRepository('test-owner', 'test-repo');
      
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
      });
      expect(result.data.name).toBe('test-repo');
    });
  });
  
  describe('listIssues', () => {
    test('calls Octokit issues.listForRepo with default parameters', async () => {
      await client.listIssues();
      
      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        labels: undefined,
      });
    });
    
    test('calls Octokit issues.listForRepo with custom parameters', async () => {
      await client.listIssues('closed', 'bug');
      
      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'closed',
        labels: 'bug',
      });
    });
  });
  
  describe('getIssue', () => {
    test('calls Octokit issues.get with issue number', async () => {
      await client.getIssue(123);
      
      expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
      });
    });
  });
  
  describe('createIssueComment', () => {
    test('calls Octokit issues.createComment with issue number and body', async () => {
      await client.createIssueComment(123, 'Test comment');
      
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: 'Test comment',
      });
    });
  });
  
  describe('addLabelsToIssue', () => {
    test('calls Octokit issues.addLabels with issue number and labels', async () => {
      await client.addLabelsToIssue(123, ['bug', 'enhancement']);
      
      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['bug', 'enhancement'],
      });
    });
  });
  
  describe('createPullRequest', () => {
    test('calls Octokit pulls.create with title, body, head, and base', async () => {
      await client.createPullRequest('Test PR', 'PR description', 'feature-branch', 'main');
      
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test PR',
        body: 'PR description',
        head: 'feature-branch',
        base: 'main',
      });
    });
  });
  
  describe('mergePullRequest', () => {
    test('calls Octokit pulls.merge with pull number and merge method', async () => {
      await client.mergePullRequest(789);
      
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 789,
        commit_title: undefined,
        commit_message: undefined,
        merge_method: 'merge',
      });
    });
    
    test('calls Octokit pulls.merge with custom parameters', async () => {
      await client.mergePullRequest(789, 'Merge title', 'Merge message', 'squash');
      
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 789,
        commit_title: 'Merge title',
        commit_message: 'Merge message',
        merge_method: 'squash',
      });
    });
  });
  
  describe('getFileContent', () => {
    test('calls Octokit repos.getContent with path', async () => {
      await client.getFileContent('src/index.ts');
      
      expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src/index.ts',
        ref: undefined,
      });
    });
    
    test('calls Octokit repos.getContent with path and ref', async () => {
      await client.getFileContent('src/index.ts', 'feature-branch');
      
      expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src/index.ts',
        ref: 'feature-branch',
      });
    });
  });
  
  describe('createOrUpdateFile', () => {
    test('calls Octokit repos.createOrUpdateFileContents for new file', async () => {
      await client.createOrUpdateFile('src/index.ts', 'Add index file', 'console.log("Hello");', 'main');
      
      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src/index.ts',
        message: 'Add index file',
        content: expect.any(String), // Base64 encoded content
        branch: 'main',
        sha: undefined,
      });
    });
    
    test('calls Octokit repos.createOrUpdateFileContents for existing file', async () => {
      await client.createOrUpdateFile('src/index.ts', 'Update index file', 'console.log("Updated");', 'main', 'abc123');
      
      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src/index.ts',
        message: 'Update index file',
        content: expect.any(String), // Base64 encoded content
        branch: 'main',
        sha: 'abc123',
      });
    });
  });
  
  describe('createBranch', () => {
    test('calls Octokit git.createRef with branch name and sha', async () => {
      await client.createBranch('feature-branch', 'abc123');
      
      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'refs/heads/feature-branch',
        sha: 'abc123',
      });
    });
  });
  
  describe('createRelease', () => {
    test('calls Octokit repos.createRelease with release details', async () => {
      await client.createRelease('v1.0.0', 'Release 1.0.0', 'Release notes', 'main', false, false);
      
      expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        tag_name: 'v1.0.0',
        name: 'Release 1.0.0',
        body: 'Release notes',
        target_commitish: 'main',
        draft: false,
        prerelease: false,
      });
    });
  });
  
  describe('createWebhook', () => {
    test('calls Octokit repos.createWebhook with webhook details', async () => {
      await client.createWebhook('https://example.com/webhook');
      
      expect(mockOctokit.rest.repos.createWebhook).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        config: {
          url: 'https://example.com/webhook',
          content_type: 'json',
          insecure_ssl: '0',
        },
        events: ['push', 'pull_request'],
        active: true,
      });
    });
    
    test('calls Octokit repos.createWebhook with custom events', async () => {
      await client.createWebhook('https://example.com/webhook', ['issues', 'issue_comment'], false);
      
      expect(mockOctokit.rest.repos.createWebhook).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        config: {
          url: 'https://example.com/webhook',
          content_type: 'json',
          insecure_ssl: '0',
        },
        events: ['issues', 'issue_comment'],
        active: false,
      });
    });
  });
});
