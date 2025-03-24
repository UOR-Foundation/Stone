import Joi from 'joi';

export const configSchema = Joi.object({
  repository: Joi.object({
    owner: Joi.string().required(),
    name: Joi.string().required(),
  }).required(),
  
  packages: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      path: Joi.string().required(),
      team: Joi.string().required(),
    })
  ).required(),
  
  workflow: Joi.object({
    issueTemplate: Joi.string().default('stone-feature.md'),
    stoneLabel: Joi.string().default('stone-process'),
    useWebhooks: Joi.boolean().default(true),
    testCommand: Joi.string().default('npm test'),
    timeoutMinutes: Joi.number().default(30),
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
    qualityChecks: Joi.array().items(Joi.string()).default(['lint', 'types', 'tests'])
  }).default(),
  
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

export interface StoneConfig {
  repository: {
    owner: string;
    name: string;
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