/**
 * Service for logging
 */
export interface LoggerService {
  /**
   * Logs a debug message
   * @param message The message to log
   * @param context Optional context data
   */
  debug(message: string, context?: any): void;

  /**
   * Logs an info message
   * @param message The message to log
   * @param context Optional context data
   */
  info(message: string, context?: any): void;

  /**
   * Logs a warning message
   * @param message The message to log
   * @param context Optional context data
   */
  warn(message: string, context?: any): void;

  /**
   * Logs an error message
   * @param message The message to log
   * @param error Optional error object
   * @param context Optional context data
   */
  error(message: string, error?: Error, context?: any): void;
}
