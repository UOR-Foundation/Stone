import Joi from 'joi';

/**
 * Joi schema for Stone configuration validation
 */
export const configSchema = Joi.object({
  repository: Joi.object({
    owner: Joi.string().required(),
    name: Joi.string().required(),
    path: Joi.string().optional(),
    defaultBranch: Joi.string().optional().default('main'),
  }).required(),
  
  packages: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      path: Joi.string().required(),
      team: Joi.string().required(),
      dependencies: Joi.array().items(Joi.string()).optional(),
    })
  ).required(),
  
  workflow: Joi.object({
    issueTemplate: Joi.string().default('stone-feature.md'),
    stoneLabel: Joi.string().default('stone-process'),
    useWebhooks: Joi.boolean().default(true),
    testCommand: Joi.string().default('npm test'),
    timeoutMinutes: Joi.number().default(30),
    issuePrefix: Joi.string().optional().default('stone-'),
    branchPrefix: Joi.string().optional().default('stone/'),
    useLabels: Joi.boolean().optional().default(true),
    stages: Joi.array().items(Joi.string()).optional().default([
      'process',
      'qa',
      'feature-implement',
      'audit',
      'actions',
      'complete'
    ]),
  }).default(),
  
  github: Joi.object({
    actionsDirectory: Joi.string().default('.github/workflows'),
    issueTemplateDirectory: Joi.string().default('.github/ISSUE_TEMPLATE'),
    stoneDirectory: Joi.string().default('.github/stone'),
  }).default(),
  
  audit: Joi.object({
    minCodeCoverage: Joi.number().default(80),
    requiredReviewers: Joi.number().default(1),
    maxComplexity: Joi.number().default(20),
    qualityChecks: Joi.array().items(Joi.string()).default(['lint', 'types', 'tests']),
  }).default(),
  
  branches: Joi.object({
    main: Joi.string().default('main'),
    prefix: Joi.string().default('stone/'),
  }).optional(),
  
  documentation: Joi.object({
    directory: Joi.string().default('docs'),
    apiDocsDirectory: Joi.string().default('docs/api'),
    readmeFile: Joi.string().default('README.md'),
    outputDir: Joi.string().optional(),
    examplesDir: Joi.string().optional(),
  }).optional(),
  
  claude: Joi.object({
    apiKey: Joi.string().optional(),
    endpoint: Joi.string().optional().default('https://api.anthropic.com/v1/messages'),
    model: Joi.string().optional().default('claude-3-sonnet-20240229'),
  }).optional(),
  
  errorRecovery: Joi.object({
    includeStackTrace: Joi.boolean().default(false),
    retryAttempts: Joi.number().default(3),
    notifyOnError: Joi.boolean().default(true),
    errorTypes: Joi.object().pattern(
      Joi.string(),
      Joi.string()
    ).default({
      'API_ERROR': 'GitHub API error',
      'VALIDATION_ERROR': 'Configuration validation error',
      'PROCESS_ERROR': 'Process execution error',
    }),
  }).optional(),
  
  feedback: Joi.object({
    priorityLabels: Joi.object({
      high: Joi.string().default('priority-high'),
      medium: Joi.string().default('priority-medium'),
      low: Joi.string().default('priority-low'),
    }).default(),
    categories: Joi.array().items(Joi.string()).default(['bug', 'feature', 'enhancement', 'documentation']),
  }).optional(),
  
  teams: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      areas: Joi.array().items(Joi.string()).optional(),
    })
  ).optional(),
  
  roles: Joi.object({
    pm: Joi.object({
      enabled: Joi.boolean().default(true),
      claudeFile: Joi.string().default('PM.CLAUDE.md'),
    }).default(),
    
    qa: Joi.object({
      enabled: Joi.boolean().default(true),
      claudeFile: Joi.string().default('QA.CLAUDE.md'),
    }).default(),
    
    feature: Joi.object({
      enabled: Joi.boolean().default(true),
      claudeFile: Joi.string().default('FEATURE.CLAUDE.md'),
    }).default(),
    
    auditor: Joi.object({
      enabled: Joi.boolean().default(true),
      claudeFile: Joi.string().default('AUDITOR.CLAUDE.md'),
    }).default(),
    
    actions: Joi.object({
      enabled: Joi.boolean().default(true),
      claudeFile: Joi.string().default('ACTIONS.CLAUDE.md'),
    }).default(),
  }).default(),
}).required();

/**
 * Stone configuration interface
 */
export interface StoneConfig {
  repository: {
    owner: string;
    name: string;
    path?: string;
    defaultBranch?: string;
  };
  packages: Array<{
    name: string;
    path: string;
    team: string;
    dependencies?: string[];
  }>;
  workflow: {
    issueTemplate: string;
    stoneLabel: string;
    useWebhooks: boolean;
    testCommand: string;
    timeoutMinutes: number;
    issuePrefix?: string;
    branchPrefix?: string;
    useLabels?: boolean;
    stages?: string[];
  };
  github: {
    actionsDirectory: string;
    issueTemplateDirectory: string;
    stoneDirectory: string;
  };
  audit?: {
    minCodeCoverage: number;
    requiredReviewers: number;
    maxComplexity: number;
    qualityChecks: string[];
  };
  branches?: {
    main: string;
    prefix: string;
  };
  documentation?: {
    directory: string;
    apiDocsDirectory: string;
    readmeFile: string;
    outputDir?: string;
    examplesDir?: string;
  };
  claude?: {
    apiKey: string;
    endpoint: string;
    model: string;
  };
  errorRecovery?: {
    includeStackTrace: boolean;
    retryAttempts: number;
    notifyOnError: boolean;
    errorTypes: Record<string, string>;
  };
  feedback?: {
    priorityLabels: {
      high: string;
      medium: string;
      low: string;
    };
    categories: string[];
  };
  rbac?: {
    roles: Record<string, {
      files: {
        read: string[];
        write: string[];
      };
      github: {
        issues: string[];
        pullRequests: string[];
        branches: string[];
        [key: string]: string[];
      };
      workflow: {
        execute: string[];
      };
    }>;
  };
  teams?: Array<{
    name: string;
    areas?: string[];
  }>;
  roles: {
    pm: {
      enabled: boolean;
      claudeFile: string;
    };
    qa: {
      enabled: boolean;
      claudeFile: string;
    };
    feature: {
      enabled: boolean;
      claudeFile: string;
    };
    auditor: {
      enabled: boolean;
      claudeFile: string;
    };
    actions: {
      enabled: boolean;
      claudeFile: string;
    };
  };
}

/**
 * Validate a configuration object against the schema
 * @param config Configuration object to validate
 * @returns Validation result with errors if any
 */
export function validateConfig(config: any): { isValid: boolean; errors: string[] } {
  const { error } = configSchema.validate(config, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validate a configuration object against the schema without applying defaults
 * @param config Configuration object to validate
 * @returns Validation result with value and error if any
 */
export function validateConfigNoDefaults(config: any): { value: any; error: any } {
  return configSchema.validate(config, {
    abortEarly: false,
    allowUnknown: false,
    noDefaults: true
  });
}
