import { FileSystemService } from '../services/filesystem-service';
import { GithubService } from '../services/github-service';
import { LoggerService } from '../services/logger-service';
import * as path from 'path';

/**
 * Result of documentation generation
 */
export interface DocumentationGenerationResult {
  /**
   * Whether the generation was successful
   */
  success: boolean;
  
  /**
   * List of generated documentation files
   */
  generatedFiles: string[];
  
  /**
   * Warnings encountered during generation
   */
  warnings: string[];
}

/**
 * Result of documentation verification
 */
export interface DocumentationVerificationResult {
  /**
   * Whether the documentation is complete
   */
  isComplete: boolean;
  
  /**
   * List of missing documentation elements
   */
  missingElements: string[];
  
  /**
   * Summary of verification
   */
  summary: string;
}

/**
 * Result of documentation PR creation
 */
export interface DocumentationPRResult {
  /**
   * Whether the PR creation was successful
   */
  success: boolean;
  
  /**
   * PR number if successful
   */
  prNumber?: number;
  
  /**
   * Error message if unsuccessful
   */
  error?: string;
}

/**
 * Manages documentation generation, verification, and publishing
 */
export class DocumentationManager {
  /**
   * Creates an instance of DocumentationManager
   * @param fsService Service for file system operations
   * @param githubService Service for GitHub API operations
   * @param logger Service for logging
   */
  constructor(
    private fsService: FileSystemService,
    private githubService: GithubService,
    private logger: LoggerService
  ) {}

  /**
   * Generates documentation from source code
   * @param packagePath Path to the package root
   * @returns Documentation generation result
   */
  async generateDocumentation(packagePath: string): Promise<DocumentationGenerationResult> {
    try {
      this.logger.info(`Generating documentation for package at ${packagePath}`);

      const srcPath = path.join(packagePath, 'src');
      const outputPath = path.join(packagePath, 'docs');
      
      // Ensure output directory exists
      await this.fsService.ensureDirectoryExists(outputPath);
      
      // Find all source files
      const sourceFiles = await this.fsService.findFiles(`${srcPath}/**/*.ts`);
      
      if (!sourceFiles || sourceFiles.length === 0) {
        this.logger.warn(`No source files found in ${srcPath}`);
        return {
          success: true,
          generatedFiles: [],
          warnings: [`No source files found in ${srcPath}`]
        };
      }
      
      this.logger.info(`Found ${sourceFiles.length} source files to process`);
      
      // Extract documentation from source files
      const docs: Record<string, any> = {};
      const warnings: string[] = [];
      
      for (const file of sourceFiles) {
        const content = await this.fsService.readFile(file);
        const relativePath = path.relative(srcPath, file);
        const docContent = this.extractDocumentation(content, relativePath);
        
        if (docContent) {
          docs[relativePath] = docContent;
        } else {
          warnings.push(`No documentation found in ${relativePath}`);
        }
      }
      
      if (Object.keys(docs).length === 0) {
        this.logger.warn(`No documentation found in any source files`);
        return {
          success: true,
          generatedFiles: [],
          warnings: ['No documentation found in any source files']
        };
      }
      
      // Generate documentation files
      const generatedFiles: string[] = [];
      
      // Generate index file
      const indexFile = path.join(outputPath, 'index.md');
      await this.fsService.writeFile(indexFile, this.generateIndexDocumentation(docs, packagePath));
      generatedFiles.push(indexFile);
      
      // Generate module documentation
      const moduleMap: Record<string, any[]> = {};
      
      for (const [filePath, docContent] of Object.entries(docs)) {
        const moduleName = this.getModuleNameFromPath(filePath);
        if (!moduleMap[moduleName]) {
          moduleMap[moduleName] = [];
        }
        moduleMap[moduleName].push(docContent);
      }
      
      for (const [moduleName, contents] of Object.entries(moduleMap)) {
        const moduleFile = path.join(outputPath, `${moduleName}.md`);
        await this.fsService.writeFile(moduleFile, this.generateModuleDocumentation(moduleName, contents));
        generatedFiles.push(moduleFile);
      }
      
      this.logger.info(`Generated ${generatedFiles.length} documentation files`);
      
      return {
        success: true,
        generatedFiles,
        warnings
      };
    } catch (error: any) {
      this.logger.error(`Error generating documentation for ${packagePath}`, error);
      throw new Error(`Failed to generate documentation: ${error.message}`);
    }
  }

  /**
   * Verifies that documentation meets requirements
   * @param packagePath Path to the package root
   * @param requiredSections List of required documentation sections
   * @returns Documentation verification result
   */
  async verifyDocumentation(
    packagePath: string,
    requiredSections: string[]
  ): Promise<DocumentationVerificationResult> {
    try {
      this.logger.info(`Verifying documentation for package at ${packagePath}`);

      const docsPath = path.join(packagePath, 'docs');
      
      // Find all documentation files
      const docFiles = await this.fsService.findFiles(`${docsPath}/**/*.md`);
      
      if (!docFiles || docFiles.length === 0) {
        this.logger.warn(`No documentation files found in ${docsPath}`);
        return {
          isComplete: false,
          missingElements: ['All documentation files'],
          summary: `No documentation files found in ${docsPath}`
        };
      }
      
      this.logger.info(`Found ${docFiles.length} documentation files to verify`);
      
      // Check for required sections
      const missingElements: string[] = [];
      let foundSections: string[] = [];
      
      for (const file of docFiles) {
        const content = await this.fsService.readFile(file);
        const sectionsInFile = this.findSectionsInMarkdown(content);
        foundSections = [...foundSections, ...sectionsInFile];
      }
      
      // Check for missing required sections
      for (const section of requiredSections) {
        if (!foundSections.includes(section)) {
          missingElements.push(section);
        }
      }
      
      const isComplete = missingElements.length === 0;
      let summary = '';
      
      if (isComplete) {
        summary = `Documentation is complete with all required sections: ${requiredSections.join(', ')}`;
        this.logger.info(summary);
      } else {
        summary = `Documentation is missing required sections: ${missingElements.join(', ')}`;
        this.logger.warn(summary);
      }
      
      return {
        isComplete,
        missingElements,
        summary
      };
    } catch (error: any) {
      this.logger.error(`Error verifying documentation for ${packagePath}`, error);
      throw new Error(`Failed to verify documentation: ${error.message}`);
    }
  }

  /**
   * Creates a PR with documentation changes
   * @param packageName Name of the package
   * @param docFiles List of documentation files
   * @param issueNumber Related issue number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @returns Documentation PR result
   */
  async createDocumentationPR(
    packageName: string,
    docFiles: string[],
    issueNumber: number,
    repoOwner: string,
    repoName: string
  ): Promise<DocumentationPRResult> {
    try {
      this.logger.info(`Creating documentation PR for package ${packageName}`);

      if (!docFiles || docFiles.length === 0) {
        const errorMessage = `No documentation files to include in PR for ${packageName}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Create a new branch for the documentation
      const branchName = `docs/${packageName}-update`;
      await this.githubService.createBranch(
        repoOwner,
        repoName,
        'main',
        branchName
      );
      
      this.logger.info(`Created branch ${branchName} for documentation update`);
      
      // Commit documentation files
      const commitMessage = `Update documentation for ${packageName}`;
      await this.githubService.commitFiles(
        repoOwner,
        repoName,
        branchName,
        docFiles,
        commitMessage
      );
      
      this.logger.info(`Committed ${docFiles.length} documentation files to branch ${branchName}`);
      
      // Create pull request
      const prTitle = `Update documentation for ${packageName}`;
      const prBody = `This PR updates the documentation for the ${packageName} package.

## Changes
- Updated API documentation to reflect latest implementation
- Generated based on JSDoc comments in source code
- Ensures all required documentation sections are present

Closes #${issueNumber}`;

      const pr = await this.githubService.createPullRequest(
        repoOwner,
        repoName,
        prTitle,
        prBody,
        branchName,
        'main'
      );
      
      this.logger.info(`Created documentation PR #${pr.number} for ${packageName}`);
      
      return {
        success: true,
        prNumber: pr.number
      };
    } catch (error: any) {
      this.logger.error(`Error creating documentation PR for ${packageName}`, error);
      return {
        success: false,
        error: `Failed to create documentation PR: ${error.message}`
      };
    }
  }

  /**
   * Extracts documentation from source code
   * @param sourceCode The source code content
   * @param filePath The file path for context
   * @returns Extracted documentation
   */
  private extractDocumentation(sourceCode: string, filePath: string): any {
    // Look for JSDoc comments
    const jsdocPattern = /\/\*\*\s*([\s\S]*?)\s*\*\//g;
    const matches = Array.from(sourceCode.matchAll(jsdocPattern));
    
    if (!matches || matches.length === 0) {
      return null;
    }
    
    const documentation: any = {
      filePath,
      modules: [],
      interfaces: [],
      classes: [],
      functions: []
    };
    
    for (const match of matches) {
      const comment = match[1].replace(/\s*\*\s*/g, ' ').trim();
      
      // Parse JSDoc tags
      const tags: Record<string, string> = {};
      const tagPattern = /@(\w+)\s+([^@]+)/g;
      const tagMatches = Array.from(comment.matchAll(tagPattern));
      
      for (const tagMatch of tagMatches) {
        tags[tagMatch[1]] = tagMatch[2].trim();
      }
      
      // Determine type based on tags
      if (tags.module) {
        documentation.modules.push({
          name: tags.module,
          description: tags.description || ''
        });
      } else if (tags.interface) {
        documentation.interfaces.push({
          name: tags.interface,
          description: tags.description || ''
        });
      } else if (tags.class) {
        documentation.classes.push({
          name: tags.class,
          description: tags.description || ''
        });
      } else if (tags.function || tags.method) {
        documentation.functions.push({
          name: tags.function || tags.method,
          description: tags.description || '',
          params: this.extractParams(comment),
          returns: tags.returns || ''
        });
      }
    }
    
    return documentation;
  }

  /**
   * Extracts parameter information from JSDoc comment
   * @param comment The JSDoc comment
   * @returns Array of parameter information
   */
  private extractParams(comment: string): Array<{ name: string; type: string; description: string }> {
    const paramPattern = /@param\s+{([^}]+)}\s+(\w+)\s*-?\s*([^@]*)/g;
    const matches = Array.from(comment.matchAll(paramPattern));
    
    if (!matches || matches.length === 0) {
      return [];
    }
    
    return matches.map(match => ({
      type: match[1].trim(),
      name: match[2].trim(),
      description: match[3].trim()
    }));
  }

  /**
   * Generates index documentation file
   * @param docs Extracted documentation
   * @param packagePath Path to the package
   * @returns Generated markdown content
   */
  private generateIndexDocumentation(docs: Record<string, any>, packagePath: string): string {
    const packageName = path.basename(packagePath);
    
    let content = `# ${packageName} Documentation\n\n`;
    content += `This documentation is automatically generated from JSDoc comments in the source code.\n\n`;
    
    // Modules section
    content += `## Modules\n\n`;
    
    const modules = new Set<string>();
    for (const doc of Object.values(docs)) {
      for (const module of doc.modules) {
        modules.add(module.name);
      }
    }
    
    if (modules.size > 0) {
      Array.from(modules).forEach(moduleName => {
        content += `- [${moduleName}](./${this.getModuleNameFromModule(moduleName)}.md)\n`;
      });
    } else {
      content += `No modules found.\n`;
    }
    
    // Installation section
    content += `\n## Installation\n\n`;
    content += `\`\`\`bash\nnpm install @example/${packageName}\n\`\`\`\n\n`;
    
    // Usage section
    content += `## Usage\n\n`;
    content += `\`\`\`typescript\nimport { ... } from '@example/${packageName}';\n\`\`\`\n\n`;
    
    return content;
  }

  /**
   * Generates module documentation file
   * @param moduleName Name of the module
   * @param contents Documentation contents
   * @returns Generated markdown content
   */
  private generateModuleDocumentation(moduleName: string, contents: any[]): string {
    let content = `# ${moduleName} Module\n\n`;
    
    // Module description
    for (const doc of contents) {
      for (const module of doc.modules) {
        if (module.name === moduleName) {
          content += `${module.description}\n\n`;
          break;
        }
      }
    }
    
    // Interfaces section
    content += `## Interfaces\n\n`;
    
    const interfaces: any[] = [];
    for (const doc of contents) {
      for (const iface of doc.interfaces) {
        interfaces.push(iface);
      }
    }
    
    if (interfaces.length > 0) {
      for (const iface of interfaces) {
        content += `### ${iface.name}\n\n`;
        content += `${iface.description}\n\n`;
      }
    } else {
      content += `No interfaces found.\n\n`;
    }
    
    // Classes section
    content += `## Classes\n\n`;
    
    const classes: any[] = [];
    for (const doc of contents) {
      for (const cls of doc.classes) {
        classes.push(cls);
      }
    }
    
    if (classes.length > 0) {
      for (const cls of classes) {
        content += `### ${cls.name}\n\n`;
        content += `${cls.description}\n\n`;
      }
    } else {
      content += `No classes found.\n\n`;
    }
    
    // Functions section
    content += `## Functions\n\n`;
    
    const functions: any[] = [];
    for (const doc of contents) {
      for (const func of doc.functions) {
        functions.push(func);
      }
    }
    
    if (functions.length > 0) {
      for (const func of functions) {
        content += `### ${func.name}\n\n`;
        content += `${func.description}\n\n`;
        
        if (func.params && func.params.length > 0) {
          content += `**Parameters:**\n\n`;
          for (const param of func.params) {
            content += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
          }
          content += `\n`;
        }
        
        if (func.returns) {
          content += `**Returns:** ${func.returns}\n\n`;
        }
      }
    } else {
      content += `No functions found.\n\n`;
    }
    
    return content;
  }

  /**
   * Finds sections in markdown content
   * @param content Markdown content
   * @returns Array of section names
   */
  private findSectionsInMarkdown(content: string): string[] {
    const sectionPattern = /##\s+([^\n]+)/g;
    const matches = Array.from(content.matchAll(sectionPattern));
    
    if (!matches || matches.length === 0) {
      return [];
    }
    
    return matches.map(match => match[1].trim());
  }

  /**
   * Gets the module name from a file path
   * @param filePath The file path
   * @returns Module name
   */
  private getModuleNameFromPath(filePath: string): string {
    const dir = path.dirname(filePath);
    return dir === '.' ? 'core' : dir.split('/')[0];
  }

  /**
   * Gets a file-friendly module name from a module name
   * @param moduleName The module name
   * @returns File-friendly module name
   */
  private getModuleNameFromModule(moduleName: string): string {
    return moduleName.toLowerCase().replace(/\s+/g, '-');
  }
}