import fs from 'fs';
import path from 'path';
import { StoneConfig, configSchema } from './schema';
import { ConfigLoader } from './loader';
import { RepositoryAnalyzer } from './analyzer';
import { Logger } from '../utils/logger';

/**
 * Generates Stone configuration based on repository analysis
 */
export class ConfigGenerator {
  private repositoryPath: string;
  private configLoader: ConfigLoader;
  private analyzer: RepositoryAnalyzer;
  private logger: Logger;

  /**
   * Create a new config generator
   * @param repositoryPath Path to the repository (defaults to current directory)
   */
  constructor(repositoryPath?: string) {
    this.repositoryPath = repositoryPath || process.cwd();
    this.configLoader = new ConfigLoader(path.join(this.repositoryPath, 'stone.config.json'));
    this.analyzer = new RepositoryAnalyzer(this.repositoryPath);
    this.logger = new Logger();
  }

  /**
   * Generate a default configuration based on repository analysis
   * @param owner Repository owner (GitHub username or organization)
   * @param name Repository name
   * @returns Generated Stone configuration
   */
  public async generate(owner: string, name: string): Promise<StoneConfig> {
    try {
      this.logger.info(`Generating Stone configuration for ${owner}/${name}`);
      
      // Analyze repository structure
      this.logger.info('Analyzing repository structure');
      const packages = await this.analyzer.analyzePackages();
      const testFramework = await this.analyzer.detectTestFramework();
      
      let defaultBranch = 'main';
      try {
        const headPath = path.join(this.repositoryPath, '.git', 'HEAD');
        if (fs.existsSync(headPath)) {
          const headContent = fs.readFileSync(headPath, 'utf8');
          const match = headContent.match(/ref: refs\/heads\/(.+)/);
          if (match && match[1]) {
            defaultBranch = match[1];
          }
        }
      } catch (error) {
        this.logger.warning(`Could not determine default branch: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Create default configuration
      const config: StoneConfig = {
        repository: {
          owner,
          name,
          path: this.repositoryPath,
          defaultBranch,
        },
        packages,
        workflow: {
          issueTemplate: 'stone-feature.md',
          stoneLabel: 'stone-process',
          useWebhooks: true,
          testCommand: testFramework === 'jest' ? 'jest' : 'npm test',
          timeoutMinutes: 30,
          issuePrefix: 'stone-',
          branchPrefix: 'stone/',
          useLabels: true,
          stages: [
            'process',
            'qa',
            'feature-implement',
            'audit',
            'actions',
            'complete'
          ],
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
          qualityChecks: ['lint', 'types', 'tests'],
        },
        branches: {
          main: defaultBranch,
          prefix: 'stone/',
        },
        documentation: {
          directory: 'docs',
          apiDocsDirectory: 'docs/api',
          readmeFile: 'README.md',
        },
        errorRecovery: {
          includeStackTrace: false,
          retryAttempts: 3,
          notifyOnError: true,
          errorTypes: {
            'API_ERROR': 'GitHub API error',
            'VALIDATION_ERROR': 'Configuration validation error',
            'PROCESS_ERROR': 'Process execution error',
          },
        },
        feedback: {
          priorityLabels: {
            high: 'priority-high',
            medium: 'priority-medium',
            low: 'priority-low',
          },
          categories: ['bug', 'feature', 'enhancement', 'documentation'],
        },
        teams: [
          {
            name: 'core',
            areas: ['src', 'docs'],
          },
        ],
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

      // Validate configuration
      this.logger.info('Validating generated configuration');
      const validation = this.configLoader.validateConfig(config);
      
      if (!validation.isValid) {
        this.logger.error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Save the configuration
      this.logger.info('Saving configuration to stone.config.json');
      await this.configLoader.save(config);
      
      this.logger.success('Stone configuration generated successfully');
      return config;
    } catch (error) {
      this.logger.error(`Failed to generate configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to generate configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create the directory structure for Stone
   * @param config Stone configuration
   */
  public async createDirectories(config: StoneConfig): Promise<void> {
    try {
      this.logger.info('Creating Stone directory structure');
      
      const directories = [
        path.join(this.repositoryPath, config.github.stoneDirectory),
        path.join(this.repositoryPath, config.github.actionsDirectory),
        path.join(this.repositoryPath, config.github.issueTemplateDirectory),
      ];
      
      if (config.documentation) {
        directories.push(
          path.join(this.repositoryPath, config.documentation.directory),
          path.join(this.repositoryPath, config.documentation.apiDocsDirectory)
        );
      }

      for (const dir of directories) {
        if (!fs.existsSync(dir)) {
          this.logger.info(`Creating directory: ${dir}`);
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      
      this.logger.success('Stone directory structure created successfully');
    } catch (error) {
      this.logger.error(`Failed to create directories: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to create directories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Write configuration to file
   * @param config Stone configuration
   */
  public async writeConfig(config: StoneConfig): Promise<void> {
    try {
      this.logger.info('Validating configuration before saving');
      
      // Validate configuration
      const validation = this.configLoader.validateConfig(config);
      
      if (!validation.isValid) {
        this.logger.error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }
      
      this.logger.info('Saving configuration to stone.config.json');
      await this.configLoader.save(config);
      this.logger.success('Configuration saved successfully');
    } catch (error) {
      this.logger.error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create a minimal configuration for testing
   * @param owner Repository owner
   * @param name Repository name
   * @returns Minimal Stone configuration
   */
  public createMinimalConfig(owner: string, name: string): StoneConfig {
    try {
      this.logger.info(`Creating minimal configuration for ${owner}/${name}`);
      
      const config: StoneConfig = {
        repository: {
          owner,
          name,
        },
        packages: [{
          name: 'default',
          path: '.',
          team: 'core',
        }],
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
      
      return config;
    } catch (error) {
      this.logger.error(`Failed to create minimal configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to create minimal configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
