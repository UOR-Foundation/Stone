import fs from 'fs';
import path from 'path';
import { StoneConfig } from './schema';
import { ConfigLoader } from './loader';
import { RepositoryAnalyzer } from './analyzer';

export class ConfigGenerator {
  private repositoryPath: string;
  private configLoader: ConfigLoader;
  private analyzer: RepositoryAnalyzer;

  constructor(repositoryPath?: string) {
    this.repositoryPath = repositoryPath || process.cwd();
    this.configLoader = new ConfigLoader(path.join(this.repositoryPath, 'stone.config.json'));
    this.analyzer = new RepositoryAnalyzer(this.repositoryPath);
  }

  /**
   * Generate a default configuration based on repository analysis
   */
  public async generate(owner: string, name: string): Promise<StoneConfig> {
    // Analyze repository structure
    const packages = await this.analyzer.analyzePackages();

    // Create default configuration
    const config: StoneConfig = {
      repository: {
        owner,
        name,
      },
      packages,
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

    // Save the configuration
    await this.configLoader.save(config);
    return config;
  }

  /**
   * Create the directory structure for Stone
   */
  public async createDirectories(config: StoneConfig): Promise<void> {
    const directories = [
      path.join(this.repositoryPath, config.github.stoneDirectory),
      path.join(this.repositoryPath, config.github.actionsDirectory),
      path.join(this.repositoryPath, config.github.issueTemplateDirectory),
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Write configuration to file
   */
  public async writeConfig(config: any): Promise<void> {
    await this.configLoader.save(config);
  }
}