import { TroubleshootingTools, DiagnosticResult, EnvironmentInfo } from '../../../src/usability/troubleshooting-tools';
import { ConfigLoader } from '../../../src/config/loader';
import { GitHubClient } from '../../../src/github/client';

jest.mock('../../../src/config/loader');
jest.mock('../../../src/github/client');
jest.mock('child_process');

import { exec } from 'child_process';

describe('Troubleshooting Tools', () => {
  let troubleshootingTools: TroubleshootingTools;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;

  beforeEach(() => {
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>;
    mockGitHubClient = new GitHubClient('token', {} as any) as jest.Mocked<GitHubClient>;
    
    // Mock the config loader
    mockConfigLoader.getConfig = jest.fn().mockResolvedValue({
      repository: {
        owner: 'test-owner',
        name: 'test-repo'
      },
      github: {
        token: 'test-token'
      }
    });
    
    // Mock exec function
    (exec as jest.Mock).mockImplementation((cmd, callback) => {
      if (cmd.includes('node --version')) {
        callback(null, { stdout: 'v16.14.0', stderr: '' });
      } else if (cmd.includes('npm --version')) {
        callback(null, { stdout: '8.5.0', stderr: '' });
      } else if (cmd.includes('git --version')) {
        callback(null, { stdout: 'git version 2.35.1', stderr: '' });
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });
    
    troubleshootingTools = new TroubleshootingTools(mockConfigLoader, mockGitHubClient);
  });

  describe('checkEnvironment', () => {
    it('should check the environment for required dependencies', async () => {
      const environment = await troubleshootingTools.checkEnvironment();
      
      expect(environment).toBeDefined();
      expect(environment.node).toBeDefined();
      expect(environment.npm).toBeDefined();
      expect(environment.git).toBeDefined();
      expect(environment.node.version).toBe('v16.14.0');
      expect(environment.node.isCompatible).toBe(true);
    });
  });

  describe('checkGitHubAccess', () => {
    it('should check GitHub API access', async () => {
      // Mock GitHub API responses
      mockGitHubClient.getCurrentUser = jest.fn().mockResolvedValue({
        login: 'test-user',
        id: 12345
      });
      
      mockGitHubClient.getRepository = jest.fn().mockResolvedValue({
        name: 'test-repo',
        owner: { login: 'test-owner' },
        permissions: { push: true }
      });
      
      const githubAccess = await troubleshootingTools.checkGitHubAccess();
      
      expect(githubAccess).toBeDefined();
      expect(githubAccess.isAuthenticated).toBe(true);
      expect(githubAccess.hasRepoAccess).toBe(true);
      expect(githubAccess.hasPushAccess).toBe(true);
    });
    
    it('should handle GitHub API errors', async () => {
      // Mock GitHub API errors
      mockGitHubClient.getCurrentUser = jest.fn().mockRejectedValue(
        new Error('Bad credentials')
      );
      
      const githubAccess = await troubleshootingTools.checkGitHubAccess();
      
      expect(githubAccess).toBeDefined();
      expect(githubAccess.isAuthenticated).toBe(false);
      expect(githubAccess.error).toBeDefined();
    });
  });

  describe('checkConfiguration', () => {
    it('should validate the configuration file', async () => {
      // Mock config validation
      mockConfigLoader.validateConfig = jest.fn().mockReturnValue({
        isValid: true,
        errors: []
      });
      
      const configCheck = await troubleshootingTools.checkConfiguration();
      
      expect(configCheck).toBeDefined();
      expect(configCheck.isValid).toBe(true);
      expect(configCheck.errors).toHaveLength(0);
    });
    
    it('should report configuration errors', async () => {
      // Mock config validation with errors
      mockConfigLoader.validateConfig = jest.fn().mockReturnValue({
        isValid: false,
        errors: ['Missing repository.owner']
      });
      
      const configCheck = await troubleshootingTools.checkConfiguration();
      
      expect(configCheck).toBeDefined();
      expect(configCheck.isValid).toBe(false);
      expect(configCheck.errors).toHaveLength(1);
      expect(configCheck.errors[0]).toBe('Missing repository.owner');
    });
  });

  describe('runDiagnostics', () => {
    it('should run all diagnostics and return a comprehensive result', async () => {
      // Mock individual checks
      troubleshootingTools.checkEnvironment = jest.fn().mockResolvedValue({
        node: { version: 'v16.14.0', isCompatible: true },
        npm: { version: '8.5.0', isCompatible: true },
        git: { version: '2.35.1', isCompatible: true }
      });
      
      troubleshootingTools.checkGitHubAccess = jest.fn().mockResolvedValue({
        isAuthenticated: true,
        hasRepoAccess: true,
        hasPushAccess: true
      });
      
      troubleshootingTools.checkConfiguration = jest.fn().mockResolvedValue({
        isValid: true,
        errors: []
      });
      
      const diagnostics = await troubleshootingTools.runDiagnostics();
      
      expect(diagnostics).toBeDefined();
      expect(diagnostics.environment).toBeDefined();
      expect(diagnostics.githubAccess).toBeDefined();
      expect(diagnostics.configuration).toBeDefined();
      expect(diagnostics.overallStatus).toBe('healthy');
    });
    
    it('should report issues when diagnostics fail', async () => {
      // Mock individual checks with issues
      troubleshootingTools.checkEnvironment = jest.fn().mockResolvedValue({
        node: { version: 'v12.0.0', isCompatible: false },
        npm: { version: '8.5.0', isCompatible: true },
        git: { version: '2.35.1', isCompatible: true }
      });
      
      troubleshootingTools.checkGitHubAccess = jest.fn().mockResolvedValue({
        isAuthenticated: false,
        error: 'Bad credentials'
      });
      
      troubleshootingTools.checkConfiguration = jest.fn().mockResolvedValue({
        isValid: true,
        errors: []
      });
      
      const diagnostics = await troubleshootingTools.runDiagnostics();
      
      expect(diagnostics).toBeDefined();
      expect(diagnostics.overallStatus).toBe('issues');
      expect(diagnostics.issues).toBeDefined();
      expect(diagnostics.issues.length).toBeGreaterThan(0);
    });
  });

  describe('formatDiagnosticReport', () => {
    it('should format the diagnostic result in a readable way', async () => {
      const diagnosticResult: DiagnosticResult = {
        environment: {
          node: { version: 'v16.14.0', isCompatible: true },
          npm: { version: '8.5.0', isCompatible: true },
          git: { version: '2.35.1', isCompatible: true }
        },
        githubAccess: {
          isAuthenticated: true,
          hasRepoAccess: true,
          hasPushAccess: true
        },
        configuration: {
          isValid: true,
          errors: []
        },
        overallStatus: 'healthy',
        issues: []
      };
      
      const report = troubleshootingTools.formatDiagnosticReport(diagnosticResult);
      
      expect(report).toBeDefined();
      expect(report).toContain('Diagnostic Report');
      expect(report).toContain('Environment');
      expect(report).toContain('GitHub Access');
      expect(report).toContain('Configuration');
      expect(report).toContain('Overall Status: healthy');
    });
    
    it('should include issues in the report when present', async () => {
      const diagnosticResult: DiagnosticResult = {
        environment: {
          node: { version: 'v12.0.0', isCompatible: false },
          npm: { version: '8.5.0', isCompatible: true },
          git: { version: '2.35.1', isCompatible: true }
        },
        githubAccess: {
          isAuthenticated: false,
          error: 'Bad credentials'
        },
        configuration: {
          isValid: true,
          errors: []
        },
        overallStatus: 'issues',
        issues: [
          'Node.js version v12.0.0 is not compatible. Please upgrade to v14.0.0 or higher.',
          'GitHub authentication failed: Bad credentials'
        ]
      };
      
      const report = troubleshootingTools.formatDiagnosticReport(diagnosticResult);
      
      expect(report).toBeDefined();
      expect(report).toContain('Issues Found:');
      expect(report).toContain('Node.js version');
      expect(report).toContain('GitHub authentication failed');
    });
  });

  describe('verifyNetworkConnectivity', () => {
    it('should check network connectivity to GitHub', async () => {
      // Mock successful ping
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        if (cmd.includes('ping')) {
          callback(null, { stdout: 'Reply from github.com', stderr: '' });
        }
      });
      
      const connectivity = await troubleshootingTools.verifyNetworkConnectivity();
      
      expect(connectivity).toBeDefined();
      expect(connectivity.canReachGitHub).toBe(true);
    });
    
    it('should handle network connectivity issues', async () => {
      // Mock failed ping
      (exec as jest.Mock).mockImplementation((cmd, callback) => {
        if (cmd.includes('ping')) {
          callback({ code: 1 }, { stdout: '', stderr: 'Request timed out' });
        }
      });
      
      const connectivity = await troubleshootingTools.verifyNetworkConnectivity();
      
      expect(connectivity).toBeDefined();
      expect(connectivity.canReachGitHub).toBe(false);
    });
  });

  describe('fixCommonIssues', () => {
    it('should attempt to fix common issues', async () => {
      const issues = [
        'Node.js version v12.0.0 is not compatible. Please upgrade to v14.0.0 or higher.',
        'GitHub authentication failed: Bad credentials'
      ];
      
      const fixResults = await troubleshootingTools.fixCommonIssues(issues);
      
      expect(fixResults).toBeDefined();
      expect(fixResults.length).toBe(issues.length);
      expect(fixResults[0]).toHaveProperty('issue');
      expect(fixResults[0]).toHaveProperty('canAutoFix');
      expect(fixResults[0]).toHaveProperty('fixSteps');
    });
    
    it('should identify which issues can be auto-fixed', async () => {
      const issues = [
        'GitHub authentication failed: Bad credentials'
      ];
      
      const fixResults = await troubleshootingTools.fixCommonIssues(issues);
      
      expect(fixResults[0].canAutoFix).toBe(false); // Can't auto-fix auth issues
      expect(fixResults[0].fixSteps.length).toBeGreaterThan(0);
    });
  });
});