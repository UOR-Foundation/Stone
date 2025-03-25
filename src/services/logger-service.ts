/**
 * Logger service for Stone
 * Provides structured logging capability with different log levels
 */
export class LoggerService {
  /**
   * Log informational messages
   * @param message The message to log
   * @param context Optional context information
   */
  public info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log warning messages
   * @param message The message to log
   * @param context Optional context information
   */
  public warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Log error messages
   * @param message The message to log
   * @param context Optional context information
   */
  public error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  /**
   * Log debug messages
   * @param message The message to log
   * @param context Optional context information
   */
  public debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Internal logging method
   * @param level Log level
   * @param message Message to log
   * @param context Optional context information
   */
  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      level,
      message,
      ...context
    };

    // For now, simple console output; could be enhanced to use winston or other loggers
    console[level](JSON.stringify(logObject));
  }
}
