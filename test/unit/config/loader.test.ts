import { ConfigLoader } from '../../../src/config/loader';
import { StoneConfig } from '../../../src/config/schema';
import fs from 'fs';
import path from 'path';

jest.mock('fs');

describe('ConfigLoader', () => {
  const mockConfig: StoneConfig = {
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
      qualityChecks: ['lint', 'types', 'tests']
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

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('load throws error when config file does not exist', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.existsSync.mockReturnValue(false);

    const loader = new ConfigLoader('path/to/config.json');
    await expect(loader.load()).rejects.toThrow('Configuration file not found');
  });

  test('load reads and validates the configuration file', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

    const loader = new ConfigLoader('path/to/config.json');
    const config = await loader.load();
    
    expect(config).toEqual(mockConfig);
    expect(mockFs.readFileSync).toHaveBeenCalledWith('path/to/config.json', 'utf8');
  });

  test('save writes the configuration to file', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    const loader = new ConfigLoader('path/to/config.json');
    await loader.save(mockConfig);
    
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      'path/to/config.json',
      JSON.stringify(mockConfig, null, 2),
      'utf8'
    );
  });

  test('getConfig loads config if not already loaded', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

    const loader = new ConfigLoader('path/to/config.json');
    const config = await loader.getConfig();
    
    expect(config).toEqual(mockConfig);
    expect(mockFs.readFileSync).toHaveBeenCalledWith('path/to/config.json', 'utf8');
  });

  test('getConfig returns cached config if already loaded', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

    const loader = new ConfigLoader('path/to/config.json');
    await loader.load(); // Load first time
    
    mockFs.readFileSync.mockClear(); // Reset mock
    
    const config = await loader.getConfig(); // Should use cached version
    
    expect(config).toEqual(mockConfig);
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
  });
});