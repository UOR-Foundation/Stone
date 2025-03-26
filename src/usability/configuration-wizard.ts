import { ConfigLoader } from '../config/loader';
import { ConfigGenerator } from '../config/generator';
import { Logger } from '../utils/logger';
import inquirer from 'inquirer';

/**
 * Interface for a configuration template
 */
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  config: any;
}

/**
 * Interface for a wizard step
 */
export interface WizardStep {
  title: string;
  questions: any[];
  process?: (answers: any) => any;
}

/**
 * Class for the configuration wizard
 */
export class ConfigurationWizard {
  private configLoader: ConfigLoader;
  private configGenerator: ConfigGenerator;
  private logger: Logger;
  private templates: ConfigTemplate[] = [
    {
      id: 'basic',
      name: 'Basic Configuration',
      description: 'Standard configuration with essential settings',
      config: {
        repository: {},
        github: {
          createLabels: true
        },
        workflow: {
          stoneLabel: 'stone',
          enablePM: true,
          enableQA: true,
          enableFeature: true,
          enableAudit: true
        }
      }
    },
    {
      id: 'minimal',
      name: 'Minimal Configuration',
      description: 'Minimal configuration with only essential settings',
      config: {
        repository: {},
        github: {
          createLabels: false
        },
        workflow: {
          stoneLabel: 'stone',
          enablePM: true,
          enableQA: false,
          enableFeature: true,
          enableAudit: false
        }
      }
    },
    {
      id: 'advanced',
      name: 'Advanced Configuration',
      description: 'Full configuration with all settings',
      config: {
        repository: {},
        github: {
          createLabels: true,
          autoCreatePRs: true
        },
        workflow: {
          stoneLabel: 'stone',
          enablePM: true,
          enableQA: true,
          enableFeature: true,
          enableAudit: true
        },
        advanced: {
          enableCustomRoles: true,
          enablePlugins: true,
          debugMode: false
        }
      }
    }
  ];

  constructor(configLoader: ConfigLoader, configGenerator: ConfigGenerator) {
    this.configLoader = configLoader;
    this.configGenerator = configGenerator;
    this.logger = new Logger();
  }

  /**
   * Start the configuration wizard
   */
  public async startWizard(): Promise<any> {
    this.logger.info('Starting configuration wizard...');
    
    // Prompt user for template or custom configuration
    const useTemplate = await this.promptForTemplate();
    
    let config: any;
    
    if (useTemplate) {
      // Use template
      const templates = this.getAvailableTemplates();
      const templateId = await this.promptForTemplateChoice(templates);
      const template = this.loadConfigTemplate(templateId);
      
      // Get basic info for template
      const basicInfo = await this.promptForBasicInfo();
      
      // Generate config from template
      config = JSON.parse(JSON.stringify(template.config)); // Deep clone
      config.repository = basicInfo;
      config.github.token = await this.promptForGitHubToken();
    } else {
      // Custom configuration through steps
      const wizardAnswers = {
        basicInfo: await this.promptForBasicInfo(),
        githubOptions: await this.promptForGitHubOptions(),
        workflowOptions: await this.promptForWorkflowOptions(),
        advancedOptions: await this.promptForAdvancedOptions()
      };
      
      config = this.generateConfig(wizardAnswers);
    }
    
    // Show summary and confirm
    await this.showConfigSummary(config);
    const confirmed = await this.confirmConfig();
    
    if (!confirmed) {
      this.logger.info('Configuration wizard cancelled');
      return null;
    }
    
    // Save configuration
    await this.saveConfig(config);
    
    this.logger.success('Configuration created successfully!');
    return config;
  }

  /**
   * Prompt for using a template
   */
  private async promptForTemplate(): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'useTemplate',
        message: 'How would you like to create your configuration?',
        choices: [
          { name: 'Use a template (recommended)', value: true },
          { name: 'Custom configuration (advanced)', value: false }
        ]
      }
    ]);
    
    return answer.useTemplate;
  }

  /**
   * Prompt for template choice
   */
  private async promptForTemplateChoice(templates: ConfigTemplate[]): Promise<string> {
    const choices = templates.map(template => ({
      name: `${template.name} - ${template.description}`,
      value: template.id
    }));
    
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'templateId',
        message: 'Select a configuration template:',
        choices
      }
    ]);
    
    return answer.templateId;
  }

  /**
   * Prompt for basic information
   */
  public async promptForBasicInfo(): Promise<any> {
    const questions = [
      {
        type: 'input',
        name: 'owner',
        message: 'GitHub repository owner (username or organization):',
        validate: (input: string) => !!input || 'Repository owner is required'
      },
      {
        type: 'input',
        name: 'name',
        message: 'GitHub repository name:',
        validate: (input: string) => !!input || 'Repository name is required'
      }
    ];
    
    return inquirer.prompt(questions);
  }

  /**
   * Prompt for GitHub token
   */
  private async promptForGitHubToken(): Promise<string> {
    const answer = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'GitHub token:',
        validate: (input: string) => !!input || 'GitHub token is required'
      }
    ]);
    
    return answer.token;
  }

  /**
   * Prompt for GitHub options
   */
  public async promptForGitHubOptions(): Promise<any> {
    const questions = [
      {
        type: 'password',
        name: 'token',
        message: 'GitHub token:',
        validate: (input: string) => !!input || 'GitHub token is required'
      },
      {
        type: 'confirm',
        name: 'createLabels',
        message: 'Create Stone labels in GitHub?',
        default: true
      },
      {
        type: 'confirm',
        name: 'autoCreatePRs',
        message: 'Automatically create PRs for issues?',
        default: false
      }
    ];
    
    return inquirer.prompt(questions);
  }

  /**
   * Prompt for workflow options
   */
  public async promptForWorkflowOptions(): Promise<any> {
    const questions = [
      {
        type: 'confirm',
        name: 'enablePM',
        message: 'Enable Product Manager (PM) role?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableQA',
        message: 'Enable QA role?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableAudit',
        message: 'Enable Auditor role?',
        default: true
      }
    ];
    
    return inquirer.prompt(questions);
  }

  /**
   * Prompt for advanced options
   */
  public async promptForAdvancedOptions(): Promise<any> {
    const questions = [
      {
        type: 'confirm',
        name: 'enableCustomRoles',
        message: 'Enable custom roles?',
        default: false
      },
      {
        type: 'confirm',
        name: 'enablePlugins',
        message: 'Enable plugins?',
        default: false
      },
      {
        type: 'confirm',
        name: 'debugMode',
        message: 'Enable debug mode?',
        default: false
      }
    ];
    
    return inquirer.prompt(questions);
  }

  /**
   * Show configuration summary
   */
  private async showConfigSummary(config: any): Promise<void> {
    this.logger.info('Configuration Summary:');
    this.logger.info(`Repository: ${config.repository.owner}/${config.repository.name}`);
    this.logger.info('GitHub Settings:');
    for (const [key, value] of Object.entries(config.github || {})) {
      if (key !== 'token') { // Don't show the token
        this.logger.info(`  ${key}: ${value}`);
      }
    }
    this.logger.info('Workflow Settings:');
    for (const [key, value] of Object.entries(config.workflow || {})) {
      this.logger.info(`  ${key}: ${value}`);
    }
    if (config.advanced) {
      this.logger.info('Advanced Settings:');
      for (const [key, value] of Object.entries(config.advanced)) {
        this.logger.info(`  ${key}: ${value}`);
      }
    }
  }

  /**
   * Confirm configuration
   */
  private async confirmConfig(): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Save this configuration?',
        default: true
      }
    ]);
    
    return answer.confirmed;
  }

  /**
   * Generate configuration from wizard answers
   */
  public generateConfig(wizardAnswers: any): any {
    const { basicInfo, githubOptions, workflowOptions, advancedOptions } = wizardAnswers;
    
    const config: any = {
      repository: {
        owner: basicInfo.owner,
        name: basicInfo.name
      },
      github: {
        token: githubOptions.token,
        createLabels: githubOptions.createLabels,
        autoCreatePRs: githubOptions.autoCreatePRs
      },
      workflow: {
        stoneLabel: 'stone',
        enablePM: workflowOptions.enablePM,
        enableQA: workflowOptions.enableQA,
        enableFeature: true, // Always enabled
        enableAudit: workflowOptions.enableAudit
      }
    };
    
    if (advancedOptions.enableCustomRoles || advancedOptions.enablePlugins || advancedOptions.debugMode) {
      config.advanced = {
        enableCustomRoles: advancedOptions.enableCustomRoles,
        enablePlugins: advancedOptions.enablePlugins,
        debugMode: advancedOptions.debugMode
      };
    }
    
    return config;
  }

  /**
   * Save configuration
   */
  public async saveConfig(config: any): Promise<void> {
    await this.configGenerator.writeConfig(config);
  }

  /**
   * Load a configuration template
   */
  public loadConfigTemplate(id: string): ConfigTemplate {
    const template = this.templates.find(t => t.id === id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }
    return template;
  }

  /**
   * Get available templates
   */
  public getAvailableTemplates(): ConfigTemplate[] {
    return this.templates;
  }
}