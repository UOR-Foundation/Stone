import { ConfigLoader } from '../config/loader';
import { ConfigGenerator } from '../config/generator';
import { Logger } from '../utils/logger';
import inquirer from 'inquirer';

/**
 * Interface for a prompt question
 */
export interface PromptQuestion {
  type: string;
  name: string;
  message: string;
  choices?: any[];
  default?: any;
  validate?: (input: any) => boolean | string | Promise<boolean | string>;
}

/**
 * Interface for a command option
 */
export interface CommandOption {
  name: string;
  description: string;
  value?: string;
}

/**
 * Class for interactive CLI functionality
 */
export class InteractiveCLI {
  private configLoader: ConfigLoader;
  private configGenerator: ConfigGenerator;
  private logger: Logger;

  constructor(configLoader: ConfigLoader, configGenerator: ConfigGenerator) {
    this.configLoader = configLoader;
    this.configGenerator = configGenerator;
    this.logger = new Logger();
  }

  /**
   * Prompt for a command selection
   */
  public async promptForCommand(options: CommandOption[]): Promise<string> {
    const choices = options.map(option => ({
      name: `${option.name} - ${option.description}`,
      value: option.value || option.name
    }));
    
    const questions: PromptQuestion[] = [
      {
        type: 'list',
        name: 'command',
        message: 'Select a command:',
        choices
      }
    ];
    
    const answers = await inquirer.prompt<{command: string}>(questions as any);
    return answers.command;
  }

  /**
   * Prompt for configuration options
   */
  public async promptForConfig(): Promise<any> {
    const questions: PromptQuestion[] = [
      {
        type: 'input',
        name: 'owner',
        message: 'GitHub repository owner (username or organization):',
        validate: (input) => !!input || 'Repository owner is required'
      },
      {
        type: 'input',
        name: 'name',
        message: 'GitHub repository name:',
        validate: (input) => !!input || 'Repository name is required'
      },
      {
        type: 'password',
        name: 'token',
        message: 'GitHub token:',
        validate: (input) => !!input || 'GitHub token is required'
      },
      {
        type: 'confirm',
        name: 'createLabels',
        message: 'Create Stone labels in GitHub?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableWorkflow',
        message: 'Enable the Stone workflow?',
        default: true
      }
    ];
    
    const answers = await inquirer.prompt<{[key: string]: any}>(questions as any);
    
    // Build config object
    return {
      repository: {
        owner: answers.owner,
        name: answers.name
      },
      github: {
        token: answers.token,
        createLabels: answers.createLabels
      },
      workflow: {
        enabled: answers.enableWorkflow,
        stoneLabel: 'stone'
      }
    };
  }

  /**
   * Prompt for confirmation
   */
  public async promptForConfirmation(
    message: string,
    details?: string
  ): Promise<boolean> {
    if (details) {
      this.logger.info(details);
    }
    
    const questions: PromptQuestion[] = [
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: false
      }
    ];
    
    const answers = await inquirer.prompt<{confirmed: boolean}>(questions as any);
    return answers.confirmed;
  }

  /**
   * Run the interactive initialization process
   */
  public async interactiveInit(): Promise<void> {
    this.logger.info('Starting interactive initialization...');
    
    // Prompt for configuration
    const config = await this.promptForConfig();
    
    // Show summary and confirm
    this.logger.info('Configuration Summary:');
    this.logger.info(`Repository: ${config.repository.owner}/${config.repository.name}`);
    this.logger.info(`Create Labels: ${config.github.createLabels ? 'Yes' : 'No'}`);
    this.logger.info(`Enable Workflow: ${config.workflow.enabled ? 'Yes' : 'No'}`);
    
    const confirmed = await this.promptForConfirmation(
      'Proceed with initialization?',
      'This will create the Stone configuration file and directory structure.'
    );
    
    if (!confirmed) {
      this.logger.info('Initialization cancelled');
      return;
    }
    
    // Generate configuration
    await this.configGenerator.generate(config.repository.owner, config.repository.name);
    
    // Create directories
    await this.configGenerator.createDirectories(config);
    
    // Write configuration
    await this.configGenerator.writeConfig(config);
    
    this.logger.success('Stone initialized successfully!');
  }

  /**
   * Run a workflow interactively
   */
  public async interactiveRunWorkflow(
    runWorkflow: (type: string, issueNumber: string, options?: any) => Promise<void>
  ): Promise<void> {
    this.logger.info('Starting interactive workflow...');
    
    // Get workflow options
    const options = this.getWorkflowOptions();
    
    // Prompt for workflow type
    const workflowType = await this.promptForCommand(options);
    
    // Prompt for issue number if needed
    let issueNumber: string | undefined;
    
    if (workflowType === 'issue' || workflowType === 'pr') {
      const questions: PromptQuestion[] = [
        {
          type: 'input',
          name: 'issueNumber',
          message: `Enter ${workflowType === 'issue' ? 'issue' : 'pull request'} number:`,
          validate: (input) => /^\d+$/.test(input) || 'Please enter a valid number'
        }
      ];
      
      const answers = await inquirer.prompt<{issueNumber: string}>(questions as any);
      issueNumber = answers.issueNumber;
    }
    
    // Confirm
    const confirmed = await this.promptForConfirmation(
      `Run ${workflowType} workflow${issueNumber ? ` for #${issueNumber}` : ''}?`,
      'This will execute the workflow with the specified options.'
    );
    
    if (!confirmed) {
      this.logger.info('Workflow execution cancelled');
      return;
    }
    
    // Run workflow
    if (issueNumber) {
      await runWorkflow(workflowType, issueNumber);
    } else {
      await runWorkflow(workflowType, '0');
    }
    
    this.logger.success('Workflow executed successfully!');
  }

  /**
   * Get available command options
   */
  public getCommandOptions(): CommandOption[] {
    return [
      { name: 'init', description: 'Initialize Stone in a repository' },
      { name: 'status', description: 'Check the status of Stone' },
      { name: 'run', description: 'Run a workflow' },
      { name: 'dashboard', description: 'Show the status dashboard' },
      { name: 'help', description: 'Show help information' }
    ];
  }

  /**
   * Get available workflow options
   */
  public getWorkflowOptions(): CommandOption[] {
    return [
      { name: 'issue', description: 'Process an issue' },
      { name: 'pr', description: 'Process a pull request' },
      { name: 'status', description: 'Check workflow status' },
      { name: 'dashboard', description: 'Show workflow dashboard' }
    ];
  }

  /**
   * Display status interactively
   */
  public async interactiveStatus(
    getStatus: () => Promise<any>
  ): Promise<void> {
    this.logger.info('Fetching status information...');
    
    // Get status
    const status = await getStatus();
    
    // Display basic status
    this.logger.info(`Repository: ${status.repository}`);
    this.logger.info(`Branch: ${status.branch}`);
    this.logger.info(`Stone Version: ${status.stoneVersion}`);
    this.logger.info(`Open Issues: ${status.issues.open}/${status.issues.total}`);
    this.logger.info(`Open PRs: ${status.pullRequests.open}/${status.pullRequests.total}`);
    
    // Prompt for more details
    const options: CommandOption[] = [
      { name: 'detailed', description: 'Show detailed status' },
      { name: 'dashboard', description: 'Show status dashboard' },
      { name: 'back', description: 'Go back' }
    ];
    
    const choice = await this.promptForCommand(options);
    
    if (choice === 'detailed') {
      // Display detailed status
      Object.entries(status || {}).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          this.logger.info(`${key}:`);
          Object.entries(value as Record<string, any>).forEach(([subKey, subValue]) => {
            this.logger.info(`  ${subKey}: ${subValue}`);
          });
        } else {
          this.logger.info(`${key}: ${value}`);
        }
      });
    } else if (choice === 'dashboard') {
      // This would show the dashboard, but for now we'll just note it
      this.logger.info('Dashboard would be shown here');
    }
  }

  /**
   * Interactive help command
   */
  public async interactiveHelp(): Promise<void> {
    const options: CommandOption[] = [
      { name: 'commands', description: 'List available commands' },
      { name: 'workflow', description: 'Explain the workflow' },
      { name: 'configuration', description: 'Explain configuration options' },
      { name: 'troubleshooting', description: 'Show troubleshooting tips' }
    ];
    
    const choice = await this.promptForCommand(options);
    
    if (choice === 'commands') {
      this.logger.info('Available Commands:');
      
      const commands = this.getCommandOptions();
      commands.forEach(cmd => {
        this.logger.info(`  stone ${cmd.name} - ${cmd.description}`);
      });
    } else if (choice === 'workflow') {
      this.logger.info('Stone Workflow:');
      this.logger.info('1. Create an issue with a "stone" label');
      this.logger.info('2. Stone will process the issue through various stages:');
      this.logger.info('   - Planning (PM role)');
      this.logger.info('   - QA specification (QA role)');
      this.logger.info('   - Implementation (Feature role)');
      this.logger.info('   - Audit (Auditor role)');
      this.logger.info('3. Each role adds specific information to the issue');
      this.logger.info('4. The workflow completes when the issue is closed');
    } else if (choice === 'configuration') {
      this.logger.info('Configuration Options:');
      this.logger.info('The stone.config.json file contains these main sections:');
      this.logger.info('- repository: Defines the GitHub repository');
      this.logger.info('- github: GitHub-specific settings');
      this.logger.info('- workflow: Workflow configuration');
      this.logger.info('- roles: Role-specific settings');
      this.logger.info('- advanced: Advanced customization options');
    } else if (choice === 'troubleshooting') {
      this.logger.info('Troubleshooting Tips:');
      this.logger.info('1. Verify your GitHub token has sufficient permissions');
      this.logger.info('2. Check for configuration errors with "stone validate-config"');
      this.logger.info('3. Run diagnostics with "stone diagnostic"');
      this.logger.info('4. Check logs with "stone logs"');
      this.logger.info('5. For more help, visit the documentation');
    }
  }
}