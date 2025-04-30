import { configSchema, validateConfigNoDefaults } from '../../../src/config/schema';

describe('Configuration Schema', () => {
  test('validates a complete configuration object', () => {
    const config = {
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

    const { error, value } = validateConfigNoDefaults(config);
    expect(error).toBeUndefined();
    expect(value).toEqual(config);
  });

  test('validates a minimal configuration object with defaults', () => {
    const minimalConfig = {
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
    };

    const { error, value } = configSchema.validate(minimalConfig);
    expect(error).toBeUndefined();
    expect(value.repository.owner).toEqual(minimalConfig.repository.owner);
    expect(value.repository.name).toEqual(minimalConfig.repository.name);
    expect(value.repository.defaultBranch).toBe('main');
    expect(value.packages).toEqual(minimalConfig.packages);
    
    // Check that defaults were applied
    expect(value.workflow).toBeDefined();
    expect(value.github).toBeDefined();
    expect(value.audit).toBeDefined();
    expect(value.roles).toBeDefined();
  });

  test('rejects configuration without required fields', () => {
    const invalidConfig = {
      repository: {
        owner: 'test-owner',
        // Missing name field
      },
      packages: [
        {
          name: 'core',
          path: 'packages/core',
          // Missing team field
        },
      ],
    };

    const { error } = configSchema.validate(invalidConfig);
    expect(error).toBeDefined();
  });
});
