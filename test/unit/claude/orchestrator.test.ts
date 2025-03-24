import { RoleOrchestrator } from '../../../src/claude/orchestrator';
import { RoleManager } from '../../../src/claude/roles/role-manager';
import { ConfigLoader } from '../../../src/config';
import { GitHubClient } from '../../../src/github/client';

jest.mock('../../../src/claude/roles/role-manager');
jest.mock('../../../src/config');
jest.mock('../../../src/github/client');

describe('RoleOrchestrator', () => {
  const MockRoleManager = RoleManager as jest.MockedClass<typeof RoleManager>;
  const MockConfigLoader = ConfigLoader as jest.MockedClass<typeof ConfigLoader>;
  const MockGitHubClient = GitHubClient as jest.MockedClass<typeof GitHubClient>;
  
  let orchestrator: RoleOrchestrator;
  let mockRoleManager: jest.Mocked<RoleManager>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  let mockConfig: any;
  
  beforeEach(() => {
    mockConfig = {
      workflow: {
        stoneLabel: 'stone-process',
      },
    };
    
    mockRoleManager = {
      getRoleByLabel: jest.fn().mockResolvedValue({
        name: 'test-role',
        processIssue: jest.fn().mockResolvedValue(undefined),
      }),
      processIssue: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RoleManager>;
    
    mockGitHubClient = {
      getIssue: jest.fn().mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          labels: [{ name: 'stone-process' }],
        },
      }),
    } as unknown as jest.Mocked<GitHubClient>;
    
    MockRoleManager.mockImplementation(() => mockRoleManager);
    MockConfigLoader.prototype.getConfig = jest.fn().mockResolvedValue(mockConfig);
    MockGitHubClient.mockImplementation(() => mockGitHubClient);
    
    orchestrator = new RoleOrchestrator('mock-token');
  });
  
  describe('processIssue', () => {
    test('processes issue with appropriate role based on label', async () => {
      await orchestrator.processIssue(123);
      
      expect(mockGitHubClient.getIssue).toHaveBeenCalledWith(123);
      expect(mockRoleManager.processIssue).toHaveBeenCalledWith(123, 'stone-process');
    });
    
    test('throws error when issue has no Stone labels', async () => {
      mockGitHubClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          labels: [{ name: 'other-label' }],
        },
      });
      
      await expect(orchestrator.processIssue(123)).rejects.toThrow('No Stone label found on issue #123');
    });
    
    test('prioritizes Stone labels in the correct order', async () => {
      mockGitHubClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          labels: [
            { name: 'stone-audit' },
            { name: 'stone-qa' },
            { name: 'stone-process' }
          ],
        },
      });
      
      await orchestrator.processIssue(123);
      
      expect(mockRoleManager.processIssue).toHaveBeenCalledWith(123, 'stone-audit');
    });
  });
  
  describe('processIssueWithLabel', () => {
    test('processes issue with specified label', async () => {
      await orchestrator.processIssueWithLabel(123, 'stone-qa');
      
      expect(mockRoleManager.processIssue).toHaveBeenCalledWith(123, 'stone-qa');
    });
    
    test('throws error when label is not a Stone label', async () => {
      await expect(orchestrator.processIssueWithLabel(123, 'other-label')).rejects.toThrow('Not a valid Stone label: other-label');
    });
  });
  
  describe('isStoneLabel', () => {
    test('identifies Stone labels correctly', async () => {
      expect(await orchestrator.isStoneLabel('stone-process')).toBe(true);
      expect(await orchestrator.isStoneLabel('stone-qa')).toBe(true);
      expect(await orchestrator.isStoneLabel('stone-feature-implement')).toBe(true);
      expect(await orchestrator.isStoneLabel('stone-audit')).toBe(true);
      expect(await orchestrator.isStoneLabel('stone-actions')).toBe(true);
      expect(await orchestrator.isStoneLabel('other-label')).toBe(false);
    });
  });
  
  describe('getStoneLabels', () => {
    test('extracts Stone labels from issue', async () => {
      mockGitHubClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          labels: [
            { name: 'stone-qa' },
            { name: 'other-label' },
            { name: 'stone-process' }
          ],
        },
      });
      
      const labels = await orchestrator.getStoneLabels(123);
      
      expect(labels).toEqual(['stone-qa', 'stone-process']);
    });
    
    test('returns empty array when issue has no Stone labels', async () => {
      mockGitHubClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          labels: [{ name: 'other-label' }],
        },
      });
      
      const labels = await orchestrator.getStoneLabels(123);
      
      expect(labels).toEqual([]);
    });
  });
  
  describe('prioritizeLabels', () => {
    test('prioritizes labels according to workflow', () => {
      const labels = [
        'stone-process',
        'stone-qa',
        'stone-feature-implement',
        'stone-audit',
        'stone-actions',
      ];
      
      const prioritized = orchestrator.prioritizeLabels(labels);
      
      expect(prioritized[0]).toBe('stone-audit');
    });
  });
});