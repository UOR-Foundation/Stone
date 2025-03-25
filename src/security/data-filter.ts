import { LoggerService } from '../services/logger-service';

/**
 * A map of pattern names to RegExp patterns
 */
export interface PatternMap {
  [name: string]: RegExp;
}

/**
 * Utility for detecting and redacting sensitive data
 */
export class SensitiveDataFilter {
  private patterns: PatternMap = {};

  constructor(private logger: LoggerService) {
    // Initialize with some default patterns
    this.addPatterns({
      // GitHub token pattern
      'github-token': /github_pat_[A-Za-z0-9_]{36}/g,
      
      // Generic API token patterns
      'api-key': /api[_\-]?key[=: ]['"]?([A-Za-z0-9+/=]{8,})['"]/gi,
      
      // Password patterns
      'password': /password[=: ]['"]?([^'"\s]{3,})/gi,
      
      // JWT pattern
      'jwt': /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
      
      // Private key patterns
      'private-key': /-----BEGIN [^\s]+ PRIVATE KEY-----[\s\S]*?-----END [^\s]+ PRIVATE KEY-----/g
    });
  }

  /**
   * Add a pattern to the filter
   * @param name Name of the pattern
   * @param pattern Regular expression or string pattern
   */
  public addPattern(name: string, pattern: RegExp | string): void {
    if (typeof pattern === 'string') {
      // Convert string pattern to RegExp
      this.patterns[name] = new RegExp(pattern, 'g');
    } else {
      this.patterns[name] = pattern;
    }
    
    this.logger.debug(`Added pattern: ${name}`);
  }

  /**
   * Add multiple patterns at once
   * @param patterns Map of pattern names to patterns
   */
  public addPatterns(patterns: Record<string, RegExp | string>): void {
    for (const [name, pattern] of Object.entries(patterns)) {
      this.addPattern(name, pattern);
    }
  }

  /**
   * Remove a pattern from the filter
   * @param name Name of the pattern to remove
   * @returns True if the pattern was removed, false if it didn't exist
   */
  public removePattern(name: string): boolean {
    if (this.patterns[name]) {
      delete this.patterns[name];
      this.logger.debug(`Removed pattern: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get all registered patterns
   * @returns Map of pattern names to RegExp patterns
   */
  public getPatterns(): PatternMap {
    return { ...this.patterns };
  }

  /**
   * Filter sensitive data from text content
   * @param content The content to filter
   * @param replacement The replacement string, defaults to [FILTERED:type]
   * @returns Filtered content with sensitive data replaced
   */
  public filterContent(content: string, replacement?: string): string {
    let filteredContent = content;
    
    // Apply each pattern
    for (const [name, pattern] of Object.entries(this.patterns)) {
      // Create a copy of the RegExp to reset lastIndex
      const regExp = new RegExp(pattern);
      
      // Use pattern-specific replacement if no custom replacement provided
      const actualReplacement = replacement || `[FILTERED:${name}]`;
      
      // Replace all occurrences
      filteredContent = filteredContent.replace(regExp, actualReplacement);
    }
    
    return filteredContent;
  }

  /**
   * Filter sensitive data from an object
   * @param obj The object to filter
   * @param replacement The replacement string, defaults to [FILTERED]
   * @returns A new object with sensitive data replaced
   */
  public filterObject(obj: any, replacement: string = '[FILTERED]'): any {
    // Handle simple types
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // Handle strings
    if (typeof obj === 'string') {
      return this.filterContent(obj, replacement);
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.filterObject(item, replacement));
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      // Keep track of visited objects to prevent circular reference issues
      const seen = new WeakSet();
      const filterRecursive = (o: any): any => {
        if (o === null || typeof o !== 'object') {
          return o;
        }
        
        // Handle circular references
        if (seen.has(o)) {
          return '[Circular]';
        }
        seen.add(o);
        
        const result: any = Array.isArray(o) ? [] : {};
        
        // Process each property/element
        for (const key of Object.keys(o)) {
          // Check if the key itself is sensitive
          const isKeySensitive = Object.keys(this.patterns).some(pattern => {
            const regex = new RegExp(this.patterns[pattern].source, 'i');
            return regex.test(key);
          });
          
          if (isKeySensitive) {
            // Sensitive key - replace the value
            result[key] = replacement;
          } else if (typeof o[key] === 'string') {
            // String value - filter the content
            result[key] = this.filterContent(o[key], replacement);
          } else if (typeof o[key] === 'object' && o[key] !== null) {
            // Object value - recursive filter
            result[key] = filterRecursive(o[key]);
          } else {
            // Other types - keep as is
            result[key] = o[key];
          }
        }
        
        return result;
      };
      
      return filterRecursive(obj);
    }
    
    // Other types (number, boolean, etc.) - return as is
    return obj;
  }

  /**
   * Sanitize data for logging
   * @param data The data to sanitize
   * @returns Sanitized data safe for logging
   */
  public sanitizeForLog(data: any): any {
    return this.filterObject(data);
  }
}
