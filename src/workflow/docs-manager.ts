import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { LoggerService } from '../services/logger-service';
import { FileSystemService } from '../services/filesystem-service';
import * as path from 'path';

/**
 * Interface for documentation verification result
 */
export interface DocumentationVerificationResult {
  verified: boolean;
  coverage: number;
  missingDocumentation: string[];
  suggestions: string[];
}

/**
 * Interface for implementation details
 */
export interface ImplementationDetails {
  files: string[];
  features: string[];
}

/**
 * Manages documentation updates in the repository
 */
export class DocsManager {
  constructor(
    private client: GitHubClient,
    private config: StoneConfig,
    private logger: LoggerService,
    private fileSystem: FileSystemService
  ) {}

  /**
   * Update documentation based on issue information
   * @param issueNumber The issue number to process
   */
  public async updateDocumentation(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Updating documentation for issue #${issueNumber}`);
      
      // Get issue details
      const issueData = await this.client.getIssue(issueNumber);
      const { title, body } = issueData.data;
      
      // Get related PR for the issue to extract code changes
      const searchResult = await this.client.octokit.rest.search.issuesAndPullRequests({
        q: `repo:${this.config.repository.owner}/${this.config.repository.name} is:pr issue:${issueNumber}`,
      });
      
      if (searchResult.data.items.length === 0) {
        await this.client.createIssueComment(
          issueNumber,
          `## Documentation Update\n\nNo pull requests found for issue #${issueNumber}. Documentation update skipped.`
        );
        return;
      }
      
      // Get the first PR that refers to this issue
      const pr = searchResult.data.items[0];
      const prNumber = pr.number;
      
      // Get PR details
      const prDetails = await this.client.octokit.rest.pulls.get({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: prNumber,
      });
      
      // Only update docs if PR is merged or closed
      if (!prDetails.data.merged && prDetails.data.state !== 'closed') {
        await this.client.createIssueComment(
          issueNumber,
          `## Documentation Update\n\nPull request #${prNumber} is not yet merged. Documentation will be updated once the PR is merged.`
        );
        return;
      }
      
      // Get the files changed in the PR
      const prFiles = await this.client.octokit.rest.pulls.listFiles({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: prNumber,
      });
      
      const changedFiles = prFiles.data.map(file => file.filename);
      
      // Generate documentation from code
      const generatedDocs = await this.generateFromCode(changedFiles);
      
      // Determine documentation files to update
      const docsToUpdate = await this.determineDocsToUpdate(changedFiles);
      
      // For each doc file, update it with new content
      for (const docFile of docsToUpdate) {
        await this.updateDocFile(docFile, generatedDocs, title, body, prDetails.data.head.ref);
      }
      
      // Add comment to issue
      await this.client.createIssueComment(
        issueNumber,
        `## Documentation Update\n\nDocumentation has been updated for issue #${issueNumber}.\n\nUpdated files:\n${docsToUpdate.map(file => `- ${file}`).join('\n')}`
      );
      
      // Add label to indicate documentation was updated
      await this.client.addLabelsToIssue(issueNumber, ['stone-docs-updated']);
      
      this.logger.info(`Documentation updated for issue #${issueNumber}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update documentation for issue #${issueNumber}`, { error: errorMessage });
      throw new Error(`Documentation update failed: ${errorMessage}`);
    }
  }

  /**
   * Generate documentation from code files
   * @param files Array of file paths
   * @returns Generated documentation
   */
  public async generateFromCode(files: string[]): Promise<string> {
    try {
      this.logger.info(`Generating documentation from ${files.length} files`);
      
      let documentation = '';
      
      // Filter to only include source code files
      const sourceFiles = files.filter(file => {
        const ext = path.extname(file);
        return ['.ts', '.js', '.tsx', '.jsx', '.md'].includes(ext);
      });
      
      // Generate documentation from each file
      for (const file of sourceFiles) {
        try {
          // Get file content
          let fileContent: string;
          
          try {
            // Try to get content from GitHub API first
            const contentResponse = await this.client.getFileContent(file);
            const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');
            fileContent = content;
          } catch (apiError) {
            // Fallback to local filesystem
            fileContent = await this.fileSystem.readFile(path.join(this.config.repository.path || '', file));
          }
          
          // Extract documentation from file
          const fileDoc = this.extractDocumentation(file, fileContent);
          if (fileDoc) {
            documentation += `## ${this.getFileTitle(file)}\n\n${fileDoc}\n\n`;
          }
        } catch (fileError) {
          this.logger.debug(`Error processing file ${file}`, { error: fileError });
        }
      }
      
      return documentation;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to generate documentation from code', { error: errorMessage });
      throw new Error(`Documentation generation failed: ${errorMessage}`);
    }
  }

  /**
   * Extract documentation from file content
   * @param filePath File path
   * @param content File content
   * @returns Extracted documentation
   */
  private extractDocumentation(filePath: string, content: string): string {
    // Extract JSDoc/TSDoc comments
    const docCommentRegex = /\/\*\*\s*([\s\S]*?)\s*\*\//g;
    const singleLineCommentRegex = /\/\/\/\s*(.*)$/gm;
    
    let documentation = '';
    let match;
    
    // Extract multi-line doc comments
    while ((match = docCommentRegex.exec(content)) !== null) {
      const comment = match[1]
        .replace(/\n\s*\*/g, '\n') // Remove * at the beginning of lines
        .trim();
      
      // Skip empty comments
      if (comment) {
        documentation += `${comment}\n\n`;
      }
    }
    
    // Extract single-line doc comments
    while ((match = singleLineCommentRegex.exec(content)) !== null) {
      documentation += `${match[1].trim()}\n`;
    }
    
    // For markdown files, use the content directly
    if (filePath.endsWith('.md')) {
      documentation = content;
    }
    
    return documentation;
  }

  /**
   * Get a human-readable title from a file path
   * @param filePath File path
   * @returns Human-readable title
   */
  private getFileTitle(filePath: string): string {
    const baseName = path.basename(filePath, path.extname(filePath));
    // Convert kebab-case or snake_case to Title Case
    return baseName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Determine which documentation files should be updated
   * @param changedFiles Array of changed file paths
   * @returns Array of documentation files to update
   */
  private async determineDocsToUpdate(changedFiles: string[]): Promise<string[]> {
    // Get docs directory from config
    const docsDir = this.config.documentation?.directory || 'docs';
    const apiDocsDir = this.config.documentation?.apiDocsDirectory || path.join(docsDir, 'api');
    const readmeFile = this.config.documentation?.readmeFile || 'README.md';
    
    const docsToUpdate = new Set<string>();
    
    // Map changed source files to corresponding doc files
    for (const file of changedFiles) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        // For source files, update the corresponding API docs
        const relativePath = file.replace(/^src\//, '');
        const docPath = path.join(apiDocsDir, relativePath.replace(/\.[^.]+$/, '.md'));
        docsToUpdate.add(docPath);
      } else if (file.startsWith(docsDir)) {
        // For existing doc files, update them directly
        docsToUpdate.add(file);
      }
    }
    
    // Always update README if significant changes were made
    if (changedFiles.length > 5) {
      docsToUpdate.add(readmeFile);
    }
    
    return Array.from(docsToUpdate);
  }

  /**
   * Update a documentation file
   * @param docFile Documentation file path
   * @param generatedDocs Generated documentation
   * @param title Issue title
   * @param body Issue body
   * @param branchName Branch name
   */
  private async updateDocFile(
    docFile: string,
    generatedDocs: string,
    title: string,
    body: string,
    branchName: string
  ): Promise<void> {
    try {
      let existingContent = '';
      let fileSha: string | undefined;
      
      // Try to get existing file content
      try {
        const contentResponse = await this.client.getFileContent(docFile);
        existingContent = Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');
        fileSha = contentResponse.data.sha;
      } catch (error) {
        // File doesn't exist yet, will create new
        this.logger.debug(`Documentation file ${docFile} doesn't exist yet, will create new`);
      }
      
      // Generate updated content
      let updatedContent = existingContent;
      
      if (docFile.endsWith('README.md')) {
        // For README, append the changes to the end
        updatedContent = this.updateReadme(existingContent, title, body);
      } else {
        // For other doc files, merge the generated content
        updatedContent = this.mergeDocContent(existingContent, generatedDocs, title);
      }
      
      // Publish the updated documentation
      await this.publishDocumentation(docFile, updatedContent, branchName, fileSha);
      
      this.logger.info(`Updated documentation file: ${docFile}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update documentation file ${docFile}`, { error: errorMessage });
    }
  }

  /**
   * Update README content
   * @param existingContent Existing README content
   * @param title Issue title
   * @param body Issue body
   * @returns Updated README content
   */
  private updateReadme(existingContent: string, title: string, body: string): string {
    // If README is empty, create a basic one
    if (!existingContent) {
      return `# ${this.config.repository.name}\n\n## Features\n\n- ${title}\n`;
    }
    
    // Look for Features or Changes section
    const featuresRegex = /## Features|## Changes/i;
    
    if (featuresRegex.test(existingContent)) {
      // Add the new feature to the existing section
      return existingContent.replace(
        featuresRegex,
        (match) => `${match}\n\n- ${title}`
      );
    } else {
      // Add a new Features section
      return `${existingContent}\n\n## Features\n\n- ${title}\n`;
    }
  }

  /**
   * Merge documentation content
   * @param existingContent Existing documentation content
   * @param generatedDocs Generated documentation
   * @param title Issue title
   * @returns Merged documentation content
   */
  private mergeDocContent(existingContent: string, generatedDocs: string, title: string): string {
    // If no existing content, use generated content
    if (!existingContent) {
      return `# ${title}\n\n${generatedDocs}`;
    }
    
    // If existing content has a title, use it, otherwise add title
    if (!existingContent.startsWith('# ')) {
      existingContent = `# ${title}\n\n${existingContent}`;
    }
    
    // Append generated docs, avoiding duplication
    const sections = generatedDocs.split(/(?=## )/g);
    
    for (const section of sections) {
      if (section.trim() && !existingContent.includes(section.trim())) {
        existingContent += `\n\n${section}`;
      }
    }
    
    return existingContent;
  }

  /**
   * Verify documentation against implementation
   * @param documentation Documentation content
   * @param implDetails Implementation details
   * @returns Documentation verification result
   */
  public async verifyDocumentation(
    documentation: string,
    implDetails: ImplementationDetails
  ): Promise<DocumentationVerificationResult> {
    try {
      this.logger.info('Verifying documentation against implementation');
      
      const missingDocumentation: string[] = [];
      const suggestions: string[] = [];
      
      // Check if each feature is documented
      for (const feature of implDetails.features) {
        if (!documentation.toLowerCase().includes(feature.toLowerCase())) {
          missingDocumentation.push(feature);
          suggestions.push(`Add documentation for ${feature}`);
        }
      }
      
      // Calculate coverage percentage
      const totalFeatures = implDetails.features.length;
      const documentedFeatures = totalFeatures - missingDocumentation.length;
      const coverage = totalFeatures > 0 ? (documentedFeatures / totalFeatures) * 100 : 100;
      
      return {
        verified: missingDocumentation.length === 0,
        coverage,
        missingDocumentation,
        suggestions
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to verify documentation', { error: errorMessage });
      throw new Error(`Documentation verification failed: ${errorMessage}`);
    }
  }

  /**
   * Publish documentation to repository
   * @param docPath Documentation file path
   * @param content File content
   * @param branchName Branch name
   * @param sha File SHA (if updating existing file)
   */
  public async publishDocumentation(
    docPath: string,
    content: string,
    branchName: string,
    sha?: string
  ): Promise<void> {
    try {
      this.logger.info(`Publishing documentation to ${docPath}`);
      
      // Create or update the file in the repository
      await this.client.createOrUpdateFile(
        docPath,
        `Update documentation for ${path.basename(docPath)}`,
        content,
        branchName,
        sha
      );
      
      this.logger.info(`Documentation published to ${docPath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to publish documentation to ${docPath}`, { error: errorMessage });
      throw new Error(`Documentation publishing failed: ${errorMessage}`);
    }
  }
}