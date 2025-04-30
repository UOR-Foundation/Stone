import { Logger } from '../../utils/logger';

/**
 * Code block interface for parsed responses
 */
export interface CodeBlock {
  language: string;
  code: string;
}

/**
 * Parses responses from Claude
 */
export class ResponseParser {
  private logger: Logger;

  /**
   * Create a new response parser
   */
  constructor() {
    this.logger = new Logger();
  }

  /**
   * Parse Gherkin specification from Claude response
   * @param response Response from Claude
   * @returns Gherkin specification
   */
  public parseGherkinSpecification(response: string): string {
    try {
      this.logger.info('Parsing Gherkin specification from Claude response');
      const gherkinCodeBlocks = this.parseCodeBlocks(response)
        .filter(block => block.language.toLowerCase() === 'gherkin');
      
      if (gherkinCodeBlocks.length === 0) {
        this.logger.warn('No Gherkin specification found in Claude response');
        return '';
      }
      
      return gherkinCodeBlocks[0].code;
    } catch (error) {
      this.logger.error(`Error parsing Gherkin specification: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }
  
  /**
   * Parse all code blocks from Claude response
   * @param response Response from Claude
   * @returns Array of code blocks
   */
  public parseCodeBlocks(response: string): CodeBlock[] {
    try {
      this.logger.info('Parsing code blocks from Claude response');
      const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
      const codeBlocks: CodeBlock[] = [];
      
      let match;
      while ((match = codeBlockRegex.exec(response)) !== null) {
        codeBlocks.push({
          language: match[1],
          code: match[2].trim(),
        });
      }
      
      this.logger.info(`Found ${codeBlocks.length} code blocks in Claude response`);
      return codeBlocks;
    } catch (error) {
      this.logger.error(`Error parsing code blocks: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Extract code blocks from Claude response
   * @param response Response from Claude
   * @param language Language of code block to extract (optional)
   * @returns Array of code blocks
   */
  public extractCodeBlocks(response: string, language?: string): string[] {
    try {
      this.logger.info(`Extracting code blocks${language ? ` with language ${language}` : ''} from Claude response`);
      
      const codeBlocks = this.parseCodeBlocks(response);
      
      if (language) {
        return codeBlocks
          .filter(block => block.language.toLowerCase() === language.toLowerCase())
          .map(block => block.code);
      }
      
      return codeBlocks.map(block => block.code);
    } catch (error) {
      this.logger.error(`Error extracting code blocks: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Parse action items from Claude response
   * @param response Response from Claude
   * @returns Array of action items
   */
  public parseActionItems(response: string): string[] {
    try {
      this.logger.info('Parsing action items from Claude response');
      // Find action items section
      const actionSectionRegex = /Actions?:[\s\S]*?((?:(?:[-•*]\s*|\d+\.\s*)[^\n]+\n?)+)/i;
      const actionSectionMatch = response.match(actionSectionRegex);
      
      if (!actionSectionMatch) {
        this.logger.warn('No action items section found in Claude response');
        return [];
      }
      
      // Extract individual action items
      const actionItemsText = actionSectionMatch[1];
      const actionItemRegex = /(?:[-•*]|\d+\.)\s*([^\n]+)/g;
      
      const actionItems: string[] = [];
      let match;
      
      while ((match = actionItemRegex.exec(actionItemsText)) !== null) {
        actionItems.push(match[1].trim());
      }
      
      this.logger.info(`Found ${actionItems.length} action items in Claude response`);
      return actionItems;
    } catch (error) {
      this.logger.error(`Error parsing action items: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Extract action items from Claude response
   * @param response Response from Claude
   * @returns Array of action items
   */
  public extractActionItems(response: string): string[] {
    return this.parseActionItems(response);
  }
  
  /**
   * Parse file paths from Claude response
   * @param response Response from Claude
   * @returns Array of file paths
   */
  public parseFilePaths(response: string): string[] {
    try {
      this.logger.info('Parsing file paths from Claude response');
      const filePathRegex = /\b(?:\/[\w.-]+)+\b/g;
      const matches = response.match(filePathRegex) || [];
      
      const uniquePaths = [...new Set(matches)]; // Remove duplicates
      this.logger.info(`Found ${uniquePaths.length} unique file paths in Claude response`);
      return uniquePaths;
    } catch (error) {
      this.logger.error(`Error parsing file paths: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Extract file paths from Claude response
   * @param response Response from Claude
   * @returns Map of file paths to content
   */
  public extractFilePaths(response: string): Map<string, string> {
    try {
      this.logger.info('Extracting file paths and content from Claude response');
      const fileMap = new Map<string, string>();
      
      const fileMatches = response.matchAll(/File: ([^\n]+)[\s\n]+```(?:[\w]*)([\s\S]*?)```/g);
      
      for (const match of Array.from(fileMatches)) {
        const filePath = match[1].trim();
        const content = match[2].trim();
        fileMap.set(filePath, content);
      }
      
      if (fileMap.size === 0) {
        const paths = this.parseFilePaths(response);
        const codeBlocks = this.parseCodeBlocks(response);
        
        if (paths.length === codeBlocks.length) {
          for (let i = 0; i < paths.length; i++) {
            fileMap.set(paths[i], codeBlocks[i].code);
          }
        }
      }
      
      this.logger.info(`Extracted ${fileMap.size} file paths with content from Claude response`);
      return fileMap;
    } catch (error) {
      this.logger.error(`Error extracting file paths: ${error instanceof Error ? error.message : String(error)}`);
      return new Map();
    }
  }
  
  /**
   * Parse JSON from Claude response
   * @param response Response from Claude
   * @returns Parsed JSON object or null
   */
  public parseJson<T>(response: string): T | null {
    try {
      this.logger.info('Parsing JSON from Claude response');
      const jsonRegex = /```(?:json)?\n([\s\S]*?)```/;
      const match = response.match(jsonRegex);
      
      if (!match) {
        this.logger.warn('No JSON found in Claude response');
        return null;
      }
      
      const jsonString = match[1].trim();
      return JSON.parse(jsonString) as T;
    } catch (error) {
      this.logger.error(`Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
