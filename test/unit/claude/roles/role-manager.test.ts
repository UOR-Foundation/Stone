import { RoleManager } from '../../../../src/claude/roles/role-manager';
import { Role } from '../../../../src/claude/roles/role';
import { PMRole } from '../../../../src/claude/roles/pm-role';
import { QARole } from '../../../../src/claude/roles/qa-role';
import { FeatureRole } from '../../../../src/claude/roles/feature-role';
import { AuditorRole } from '../../../../src/claude/roles/auditor-role';
import { ActionsRole } from '../../../../src/claude/roles/actions-role';
import { ConfigLoader } from '../../../../src/config';
import { GitHubAuth } from '../../../../src/github';

jest.mock('../../../../src/claude/roles/pm-role');
jest.mock('../../../../src/claude/roles/qa-role');
jest.mock('../../../../src/claude/roles/feature-role');
jest.mock('../../../../src/claude/roles/auditor-role');
jest.mock('../../../../src/claude/roles/actions-role');
jest.mock('../../../../src/config');
jest.mock('../../../../src/github');

describe('RoleManager', () => {
  const MockConfigLoader = ConfigLoader as jest.MockedClass<typeof ConfigLoader>;
  const MockGitHubAuth = GitHubAuth as jest.MockedClass<typeof GitHubAuth>;
  
  let roleManager: RoleManager;
  let mockConfig: any;
  
  beforeEach(() => {
    mockConfig = {
      roles: {
        pm: { enabled: true },
        qa: { enabled: true },
        feature: { enabled: true },
        auditor: { enabled: true },
        actions: { enabled: true },
        unknown: { enabled: false }
      },
      workflow: {
        stoneLabel: 'stone-process'
      }
    };
    
    MockConfigLoader.prototype.getConfig = jest.fn().mockResolvedValue(mockConfig);
    MockGitHubAuth.prototype.getToken = jest.fn().mockResolvedValue('mock-token');
    
    roleManager = new RoleManager();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getRoleByName', () => {
    test('returns PM role instance', async () => {
      const role = await roleManager.getRoleByName('pm');
      
      expect(role).toBeInstanceOf(PMRole);
      expect(PMRole).toHaveBeenCalledWith('mock-token');
    });
    
    test('returns QA role instance', async () => {
      const role = await roleManager.getRoleByName('qa');
      
      expect(role).toBeInstanceOf(QARole);
      expect(QARole).toHaveBeenCalledWith('mock-token');
    });
    
    test('returns Feature role instance', async () => {
      const role = await roleManager.getRoleByName('feature');
      
      expect(role).toBeInstanceOf(FeatureRole);
      expect(FeatureRole).toHaveBeenCalledWith('mock-token');
    });
    
    test('returns Auditor role instance', async () => {
      const role = await roleManager.getRoleByName('auditor');
      
      expect(role).toBeInstanceOf(AuditorRole);
      expect(AuditorRole).toHaveBeenCalledWith('mock-token');
    });
    
    test('returns Actions role instance', async () => {
      const role = await roleManager.getRoleByName('actions');
      
      expect(role).toBeInstanceOf(ActionsRole);
      expect(ActionsRole).toHaveBeenCalledWith('mock-token');
    });
    
    test('throws error for non-existent role', async () => {
      // Use a role name that doesn't exist
      await expect(roleManager.getRoleByName('nonexistent')).rejects.toThrow('Unknown role: nonexistent');
    });
    
    test('throws error for disabled role', async () => {
      mockConfig.roles.qa.enabled = false;
      
      await expect(roleManager.getRoleByName('qa')).rejects.toThrow('Role qa is disabled in configuration');
    });
  });
  
  describe('getRoleByLabel', () => {
    test('returns PM role for stone-process label', async () => {
      mockConfig.workflow = { stoneLabel: 'stone-process' };
      
      const role = await roleManager.getRoleByLabel('stone-process');
      
      expect(role).toBeInstanceOf(PMRole);
    });
    
    test('returns QA role for stone-qa label', async () => {
      const role = await roleManager.getRoleByLabel('stone-qa');
      
      expect(role).toBeInstanceOf(QARole);
    });
    
    test('returns Feature role for stone-feature-implement label', async () => {
      const role = await roleManager.getRoleByLabel('stone-feature-implement');
      
      expect(role).toBeInstanceOf(FeatureRole);
    });
    
    test('returns Auditor role for stone-audit label', async () => {
      const role = await roleManager.getRoleByLabel('stone-audit');
      
      expect(role).toBeInstanceOf(AuditorRole);
    });
    
    test('returns Actions role for stone-actions label', async () => {
      const role = await roleManager.getRoleByLabel('stone-actions');
      
      expect(role).toBeInstanceOf(ActionsRole);
    });
    
    test('throws error for unknown label', async () => {
      await expect(roleManager.getRoleByLabel('unknown-label')).rejects.toThrow('No role found for label: unknown-label');
    });
  });
  
  describe('processIssue', () => {
    let mockPMRole: any;
    
    beforeEach(() => {
      // Set up a specific mock for PMRole
      mockPMRole = {
        name: 'pm',
        processIssue: jest.fn().mockResolvedValue(undefined),
      };
      
      // Mock the constructors to return properly mocked instances
      (PMRole as jest.Mock).mockImplementation(() => mockPMRole);
      
      // Mock other roles similarly to avoid type errors
      (QARole as jest.Mock).mockImplementation(() => ({
        name: 'qa',
        processIssue: jest.fn().mockResolvedValue(undefined),
      }));
      
      (FeatureRole as jest.Mock).mockImplementation(() => ({
        name: 'feature',
        processIssue: jest.fn().mockResolvedValue(undefined),
      }));
      
      (AuditorRole as jest.Mock).mockImplementation(() => ({
        name: 'auditor',
        processIssue: jest.fn().mockResolvedValue(undefined),
      }));
      
      (ActionsRole as jest.Mock).mockImplementation(() => ({
        name: 'actions',
        processIssue: jest.fn().mockResolvedValue(undefined),
      }));
    });
    
    test('processes issue with correct role based on label', async () => {
      await roleManager.processIssue(123, 'stone-process');
      
      expect(mockPMRole.processIssue).toHaveBeenCalledWith(123);
    });
    
    test('handles error during issue processing', async () => {
      mockPMRole.processIssue.mockRejectedValue(new Error('Processing error'));
      
      await expect(roleManager.processIssue(123, 'stone-process')).rejects.toThrow('Error processing issue #123 with PM role: Processing error');
    });
  });
});