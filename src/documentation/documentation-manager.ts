import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import * as marked from 'marked';

/**
 * Interface for a documentation section
 */
export interface DocSection {
  title: string;
  content: string;
  filename: string;
}

/**
 * Class for managing documentation generation
 */
export class DocumentationManager {
  private configLoader: ConfigLoader;
  private logger: Logger;
  private templates: Record<string, string> = {
    quickStart: `# Quick Start Guide

## Installation
{{installation}}

## Configuration
{{configuration}}

## Usage
{{usage}}
`,
    apiReference: `# API Reference

{{classes}}
`
  };

  constructor(configLoader: ConfigLoader) {
    this.configLoader = configLoader;
    this.logger = new Logger();
  }

  /**
   * Generate documentation based on templates
   */
  public async generateDocumentation(sections: DocSection[]): Promise<void> {
    this.logger.info('Generating documentation...');
    
    const config = await this.configLoader.getConfig();
    const outputDir = config.documentation?.outputDir || './docs';
    
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate table of contents
    const toc = this.generateTableOfContents(sections);
    
    // Write each section to a file
    for (const section of sections) {
      const filePath = path.join(outputDir, section.filename);
      fs.writeFileSync(filePath, section.content, 'utf8');
      this.logger.info(`Generated documentation: ${filePath}`);
    }
    
    // Write table of contents to index.md
    const indexPath = path.join(outputDir, 'index.md');
    fs.writeFileSync(indexPath, toc, 'utf8');
    this.logger.info(`Generated documentation index: ${indexPath}`);
  }

  /**
   * Generate a quick start guide
   */
  public async generateQuickStartGuide(): Promise<string> {
    this.logger.info('Generating quick start guide...');
    
    // Get the quick start template
    const template = this.getTemplate('quickStart');
    
    // Replace template variables
    const installation = `
To install Stone, use npm:

\`\`\`
npm install @uor-foundation/stone -g
\`\`\`
`;

    const configuration = `
Create a \`stone.config.json\` file in your project root:

\`\`\`json
{
  "repository": {
    "owner": "your-username",
    "name": "your-repository"
  },
  "github": {
    "token": "your-github-token"
  }
}
\`\`\`
`;

    const usage = `
Initialize Stone in your repository:

\`\`\`
stone init
\`\`\`

Process an issue:

\`\`\`
stone run issue <issue-number>
\`\`\`
`;

    return template
      .replace('{{installation}}', installation)
      .replace('{{configuration}}', configuration)
      .replace('{{usage}}', usage);
  }

  /**
   * Generate API reference documentation
   */
  public async generateAPIReference(sourceDirs: string[]): Promise<DocSection[]> {
    this.logger.info('Generating API reference...');
    
    const sections: DocSection[] = [];
    
    // Process each source directory
    for (const dir of sourceDirs) {
      if (!fs.existsSync(dir)) {
        this.logger.warn(`Source directory not found: ${dir}`);
        continue;
      }
      
      // Get the directory name for the section title
      const dirName = path.basename(dir);
      const classes: string[] = [];
      
      // Process each file in the directory
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith('.ts')) continue;
        
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract class documentation
        const classDoc = this.extractClassDocumentation(content);
        if (classDoc) {
          classes.push(classDoc);
        }
      }
      
      // Create a section for this directory
      if (classes.length > 0) {
        sections.push({
          title: `${dirName} API`,
          content: `# ${dirName} API\n\n${classes.join('\n\n')}`,
          filename: `api-${dirName ? dirName.toLowerCase() : 'unknown'}.md`
        });
      }
    }
    
    return sections;
  }

  /**
   * Generate an example project
   */
  public async generateExampleProject(
    name: string,
    files: { path: string; content: string }[]
  ): Promise<void> {
    this.logger.info(`Generating example project: ${name}...`);
    
    const config = await this.configLoader.getConfig();
    const baseDir = config.documentation?.examplesDir || './examples';
    
    // Create each file
    for (const file of files) {
      const filePath = path.join(baseDir, file.path);
      const dirPath = path.dirname(filePath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(filePath, file.content, 'utf8');
      this.logger.info(`Generated example file: ${filePath}`);
    }
  }

  /**
   * Render documentation as HTML
   */
  public renderDocumentation(markdown: string): string {
    return marked.parse(markdown) as string;
  }

  /**
   * Generate a table of contents
   */
  public generateTableOfContents(sections: DocSection[]): string {
    const tocLines = [
      '# Stone Documentation',
      '',
      '## Table of Contents',
      ''
    ];
    
    for (const section of sections) {
      tocLines.push(`- [${section.title}](${section.filename})`);
    }
    
    return tocLines.join('\n');
  }

  /**
   * Get a template by name
   */
  public getTemplate(name: string): string {
    return this.templates[name] || '';
  }

  /**
   * Extract class documentation from TypeScript code
   */
  private extractClassDocumentation(content: string): string | null {
    const classRegex = /\/\*\*\s*\n([\s\S]*?)\s*\*\/\s*\nexport\s+class\s+(\w+)/g;
    const methodRegex = /\/\*\*\s*\n([\s\S]*?)\s*\*\/\s*\n\s*public\s+(\w+)/g;
    
    let classMatch;
    let result = '';
    
    while ((classMatch = classRegex.exec(content)) !== null) {
      const classComment = classMatch[1]
        .replace(/\s*\*\s*/g, ' ')
        .trim();
      const className = classMatch[2];
      
      result += `## ${className}\n\n${classComment}\n\n### Methods\n\n`;
      
      // Find all methods for this class
      const classContent = content.substring(classMatch.index);
      let methodMatch;
      while ((methodMatch = methodRegex.exec(classContent)) !== null) {
        const methodComment = methodMatch[1]
          .replace(/\s*\*\s*/g, ' ')
          .trim();
        const methodName = methodMatch[2];
        
        result += `#### ${methodName}\n\n${methodComment}\n\n`;
      }
    }
    
    return result || null;
  }
}