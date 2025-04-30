import { LoggerService } from '../services/logger-service';

/**
 * Redacts secrets from text
 */
export class SecretRedaction {
  private logger: LoggerService;
  private patterns: RegExp[];

  constructor(logger: LoggerService) {
    this.logger = logger;
    
    this.patterns = [
      /(?:api[_-]?key|token|secret|password)[:=]\s*["']?([a-zA-Z0-9_\-]{20,})["']?/gi,
      
      /gh[ps]_[a-zA-Z0-9_]{36,}/g,
      
      /AKIA[0-9A-Z]{16}/g,
      
      /-----BEGIN (?:RSA|OPENSSH|DSA|EC) PRIVATE KEY-----[\s\S]*?-----END (?:RSA|OPENSSH|DSA|EC) PRIVATE KEY-----/g,
    ];
  }

  /**
   * Redact secrets from text
   * @param text Text to redact
   * @returns Redacted text
   */
  public redact(text: string): string {
    try {
      let redactedText = text;
      
      for (const pattern of this.patterns) {
        redactedText = redactedText.replace(pattern, (match, group) => {
          if (group) {
            return match.replace(group, '***REDACTED***');
          }
          
          return '***REDACTED***';
        });
      }
      
      this.logger.debug('Redacted potential secrets from text');
      return redactedText;
    } catch (error) {
      this.logger.error(`Error redacting secrets: ${error instanceof Error ? error.message : String(error)}`);
      return '***ERROR REDACTING CONTENT***';
    }
  }

  /**
   * Add a custom pattern for redaction
   * @param pattern Regular expression pattern
   */
  public addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
    this.logger.debug(`Added custom redaction pattern: ${pattern.toString()}`);
  }

  /**
   * Remove a pattern from redaction
   * @param patternIndex Index of the pattern to remove
   * @returns True if pattern was removed, false otherwise
   */
  public removePattern(patternIndex: number): boolean {
    if (patternIndex >= 0 && patternIndex < this.patterns.length) {
      const pattern = this.patterns[patternIndex];
      this.patterns.splice(patternIndex, 1);
      this.logger.debug(`Removed redaction pattern: ${pattern.toString()}`);
      return true;
    }
    
    this.logger.warn(`Invalid pattern index: ${patternIndex}`);
    return false;
  }

  /**
   * Get all current redaction patterns
   * @returns Array of redaction patterns
   */
  public getPatterns(): RegExp[] {
    return [...this.patterns];
  }

  /**
   * Check if text contains secrets without redacting them
   * @param text Text to check
   * @returns True if text contains potential secrets, false otherwise
   */
  public containsSecrets(text: string): boolean {
    try {
      for (const pattern of this.patterns) {
        if (pattern.test(text)) {
          pattern.lastIndex = 0;
          return true;
        }
        pattern.lastIndex = 0;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Error checking for secrets: ${error instanceof Error ? error.message : String(error)}`);
      return true; // Assume there might be secrets on error
    }
  }
}
