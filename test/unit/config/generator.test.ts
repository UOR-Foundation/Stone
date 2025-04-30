import fs from 'fs';
import path from 'path';
import { ConfigGenerator } from '../../../src/config/generator';
import { ConfigLoader } from '../../../src/config/loader';
import { RepositoryAnalyzer } from '../../../src/config/analyzer';
import { StoneConfig } from '../../../src/config/schema';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/config/loader');
jest.mock('../../../src/config/analyzer');
jest.mock('../../../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('ConfigGenerator', () => {
  let generator: ConfigGenerator;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;
  let mockAnalyzer: jest.Mocked<RepositoryAnalyzer>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('ref: refs/heads/main');
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    
    mockConfigLoader = {
      load: jest.fn().mockResolvedValue({}),
      save: jest.fn().mockResolvedValue(undefined),
      validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    } as unknown as jest.Mocked<ConfigLoader>;
    (ConfigLoader as jest.Mock).mockImplementation(() => mockConfigLoader);
    
    mockAnalyzer = {
      analyzePackages: jest.fn().mockResolvedValue([
        { name: 'core', path: 'packages/core', team: 'core-team' }
      ]),
      detectTestFramework: jest.fn().mockResolvedValue('jest'),
    } as unknown as jest.Mocked<RepositoryAnalyzer>;
    (RepositoryAnalyzer as jest.Mock).mockImplementation(() => mockAnalyzer);
    
    generator = new ConfigGenerator('/test/repo');
  });
  
  describe('generate', () => {
    test('generates a valid configuration', async () => {
      const result = await generator.generate('test-owner', 'test-repo');
      
      expect(mockAnalyzer.analyzePackages).toHaveBeenCalled();
      expect(mockAnalyzer.detectTestFramework).toHaveBeenCalled();
      
      expect(mockConfigLoader.validateConfig).toHaveBeenCalled();
      
      expect(mockConfigLoader.save).toHaveBeenCalled();
      
      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('packages');
      expect(result).toHaveProperty('workflow');
      expect(result).toHaveProperty('github');
      expect(result).toHaveProperty('roles');
      
      expect(result.repository.owner).toBe('test-owner');
      expect(result.repository.name).toBe('test-repo');
    });
    
    test('throws error when validation fails', async () => {
      mockConfigLoader.validateConfig.mockReturnValue({ 
        isValid: false, 
        errors: ['Invalid config'] 
      });
      
      await expect(generator.generate('test-owner', 'test-repo'))
        .rejects.toThrow('Configuration validation failed');
    });
    
    test('detects default branch from git HEAD', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('ref: refs/heads/develop');
      
      const result = await generator.generate('test-owner', 'test-repo');
      
      expect(result.repository.defaultBranch).toBe('develop');
    });
    
    test('uses main as default branch when git HEAD not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await generator.generate('test-owner', 'test-repo');
      
      expect(result.repository.defaultBranch).toBe('main');
    });
  });
  
  describe('createDirectories', () => {
    test('creates all required directories', async () => {
      const config: StoneConfig = {
        repository: { owner: 'test-owner', name: 'test-repo' },
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
        documentation: {
          directory: 'docs',
          apiDocsDirectory: 'docs/api',
          readmeFile: 'README.md',
        },
        roles: {
          pm: { enabled: true, claudeFile: 'PM.CLAUDE.md' },
          qa: { enabled: true, claudeFile: 'QA.CLAUDE.md' },
          feature: { enabled: true, claudeFile: 'FEATURE.CLAUDE.md' },
          auditor: { enabled: true, claudeFile: 'AUDITOR.CLAUDE.md' },
          actions: { enabled: true, claudeFile: 'ACTIONS.CLAUDE.md' },
        },
      };
      
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.github/stone') || 
            path.includes('.github/workflows') || 
            path.includes('.github/ISSUE_TEMPLATE') || 
            path.includes('docs') || 
            path.includes('docs/api')) {
          return false;
        }
        return true;
      });
      
      await generator.createDirectories(config);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/test/repo/.github/stone',
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/test/repo/.github/workflows',
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/test/repo/.github/ISSUE_TEMPLATE',
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/test/repo/docs',
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/test/repo/docs/api',
        { recursive: true }
      );
    });
    
    test('skips creating directories that already exist', async () => {
      const config: StoneConfig = {
        repository: { owner: 'test-owner', name: 'test-repo' },
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
      
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      await generator.createDirectories(config);
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
  
  describe('writeConfig', () => {
    test('validates and saves configuration', async () => {
      const config: StoneConfig = {
        repository: { owner: 'test-owner', name: 'test-repo' },
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
      
      await generator.writeConfig(config);
      
      expect(mockConfigLoader.validateConfig).toHaveBeenCalledWith(config);
      
      expect(mockConfigLoader.save).toHaveBeenCalledWith(config);
    });
    
    test('throws error when validation fails', async () => {
      const config: StoneConfig = {
        repository: { owner: 'test-owner', name: 'test-repo' },
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
      
      mockConfigLoader.validateConfig.mockReturnValue({ 
        isValid: false, 
        errors: ['Invalid config'] 
      });
      
      await expect(generator.writeConfig(config))
        .rejects.toThrow('Configuration validation failed');
      
      expect(mockConfigLoader.save).not.toHaveBeenCalled();
    });
  });
  
  describe('createMinimalConfig', () => {
    test('creates a minimal valid configuration', () => {
      const result = generator.createMinimalConfig('test-owner', 'test-repo');
      
      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('packages');
      expect(result).toHaveProperty('workflow');
      expect(result).toHaveProperty('github');
      expect(result).toHaveProperty('roles');
      
      expect(result.repository.owner).toBe('test-owner');
      expect(result.repository.name).toBe('test-repo');
      
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].name).toBe('default');
      expect(result.packages[0].path).toBe('.');
    });
  });
});
