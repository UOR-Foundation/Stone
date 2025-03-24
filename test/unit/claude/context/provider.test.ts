import { ContextProvider } from '../../../../src/claude/context/provider';
import { ConfigLoader } from '../../../../src/config';
import { GitHubClient } from '../../../../src/github';

jest.mock('../../../../src/config');
jest.mock('../../../../src/github');

describe('ContextProvider', () => {
  const MockConfigLoader = ConfigLoader as jest.MockedClass<typeof ConfigLoader>;
  const MockGitHubClient = GitHubClient as jest.MockedClass<typeof GitHubClient>;
  
  let contextProvider: ContextProvider;
  let mockConfig: any;
  let mockGitHubClient: any;
  
  beforeEach(() => {
    mockConfig = {
      repository: {
        owner: 'test-owner',
        name: 'test-repo',
      },
      github: {
        stoneDirectory: '.github/stone',
      },
      roles: {
        pm: {
          enabled: true,
          claudeFile: 'PM.CLAUDE.md'
        },
        qa: {
          enabled: true,
          claudeFile: 'QA.CLAUDE.md'
        },
        feature: {
          enabled: true,
          claudeFile: 'FEATURE.CLAUDE.md'
        },
        auditor: {
          enabled: true,
          claudeFile: 'AUDITOR.CLAUDE.md'
        },
        actions: {
          enabled: true,
          claudeFile: 'ACTIONS.CLAUDE.md'
        }
      }
    };
    
    MockConfigLoader.prototype.getConfig = jest.fn().mockResolvedValue(mockConfig);
    
    mockGitHubClient = {
      getIssue: jest.fn().mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          body: 'Test issue description',
          labels: [{ name: 'test-label' }],
        },
      }),
      getFileContent: jest.fn().mockResolvedValue({
        data: {
          content: Buffer.from('Test file content').toString('base64'),
          encoding: 'base64',
        },
      }),
    };
    
    MockGitHubClient.mockImplementation(() => mockGitHubClient);
    
    contextProvider = new ContextProvider('token');
  });
  
  describe('getIssueContext', () => {
    test('retrieves context from an issue', async () => {
      const issueContext = await contextProvider.getIssueContext(123);
      
      expect(mockGitHubClient.getIssue).toHaveBeenCalledWith(123);
      expect(issueContext).toEqual({
        issue: {
          number: 123,
          title: 'Test Issue',
          body: 'Test issue description',
          labels: ['test-label'],
        },
      });
    });
    
    test('handles error when retrieving issue context', async () => {
      mockGitHubClient.getIssue.mockRejectedValue(new Error('GitHub error'));
      
      await expect(contextProvider.getIssueContext(123)).rejects.toThrow('Failed to get issue context: GitHub error');
    });
  });
  
  describe('getRepositoryContext', () => {
    test('retrieves repository structure context', async () => {
      const repoContext = await contextProvider.getRepositoryContext();
      
      expect(repoContext).toEqual({
        repository: {
          owner: 'test-owner',
          name: 'test-repo',
        },
      });
    });
  });
  
  describe('getRoleFileContent', () => {
    test('retrieves Claude file content for a role', async () => {
      const roleContent = await contextProvider.getRoleFileContent('pm');
      
      expect(mockGitHubClient.getFileContent).toHaveBeenCalledWith('.github/stone/PM.CLAUDE.md');
      expect(roleContent).toBe('Test file content');
    });
    
    test('handles error when retrieving role file content', async () => {
      mockGitHubClient.getFileContent.mockRejectedValue(new Error('GitHub error'));
      
      await expect(contextProvider.getRoleFileContent('pm')).rejects.toThrow('Failed to get role file content for pm: GitHub error');
    });
  });
  
  describe('buildContext', () => {
    test('builds complete context for a role and issue', async () => {
      mockGitHubClient.getFileContent.mockResolvedValue({
        data: {
          content: Buffer.from('# Role instructions').toString('base64'),
          encoding: 'base64',
        },
      });
      
      const context = await contextProvider.buildContext('pm', 123);
      
      expect(context).toEqual({
        issue: {
          number: 123,
          title: 'Test Issue',
          body: 'Test issue description',
          labels: ['test-label'],
        },
        repository: {
          owner: 'test-owner',
          name: 'test-repo',
        },
        role: {
          name: 'pm',
          instructions: '# Role instructions',
        },
      });
    });
  });
});