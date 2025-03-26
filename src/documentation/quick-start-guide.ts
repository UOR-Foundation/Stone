import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for a guide section
 */
export interface GuideSection {
  title: string;
  content: string;
  code?: string;
}

/**
 * Class for generating quick start guides
 */
export class QuickStartGuideGenerator {
  private configLoader: ConfigLoader;
  private logger: Logger;

  constructor(configLoader: ConfigLoader) {
    this.configLoader = configLoader;
    this.logger = new Logger();
  }

  /**
   * Generate a quick start guide with the given sections
   */
  public generateGuide(sections: GuideSection[]): string {
    this.logger.info('Generating quick start guide...');
    
    const lines = [
      '# Quick Start Guide',
      '',
      'This guide will help you get started with Stone quickly.',
      ''
    ];
    
    // Add each section
    for (const section of sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');
      
      if (section.code) {
        lines.push('```');
        lines.push(section.code);
        lines.push('```');
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Save the guide to a file
   */
  public async saveGuide(guide: string, filename: string): Promise<void> {
    const config = await this.configLoader.getConfig();
    const outputDir = config.documentation?.outputDir || './docs';
    
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, guide, 'utf8');
    
    this.logger.info(`Saved quick start guide to ${filePath}`);
  }

  /**
   * Generate a complete quick start guide
   */
  public async generateCompleteGuide(): Promise<string> {
    const sections = [
      this.generateInstallationSection(),
      this.generateConfigurationSection(),
      this.generateUsageSection(),
      this.generateWorkflowSection(),
      this.generateTroubleshootingSection()
    ];
    
    const guide = this.generateGuide(sections);
    await this.saveGuide(guide, 'quick-start.md');
    
    return guide;
  }

  /**
   * Generate the installation section
   */
  public generateInstallationSection(): GuideSection {
    return {
      title: 'Installation',
      content: 'Install Stone globally using npm:',
      code: 'npm install @uor-foundation/stone -g'
    };
  }

  /**
   * Generate the configuration section
   */
  public generateConfigurationSection(): GuideSection {
    return {
      title: 'Configuration',
      content: 'Create a `stone.config.json` file in your project root:',
      code: `{
  "repository": {
    "owner": "your-username",
    "name": "your-repository"
  },
  "github": {
    "token": "your-github-token"
  }
}`
    };
  }

  /**
   * Generate the usage section
   */
  public generateUsageSection(): GuideSection {
    return {
      title: 'Usage',
      content: 'Initialize Stone in your repository:',
      code: 'stone init'
    };
  }

  /**
   * Generate the workflow section
   */
  public generateWorkflowSection(): GuideSection {
    return {
      title: 'Workflow',
      content: 'Process issues with Stone:',
      code: `# Process an issue
stone run issue 123

# Check status
stone status

# View dashboard
stone dashboard`
    };
  }

  /**
   * Generate the troubleshooting section
   */
  public generateTroubleshootingSection(): GuideSection {
    return {
      title: 'Troubleshooting',
      content: `If you encounter any issues, try the following:

- Run diagnostics: \`stone diagnostic\`
- Check logs: \`stone logs\`
- Verify GitHub token: \`stone verify-token\`

For more detailed help, see the [full documentation](./docs/index.md).`
    };
  }
}