const chalk = require('chalk');

export class Logger {
  /**
   * Log an informational message
   */
  public info(message: string, context?: Record<string, any>): void {
    if (context) {
      console.log(chalk.blue(`[INFO] ${message}`), context);
    } else {
      console.log(chalk.blue(`[INFO] ${message}`));
    }
  }

  /**
   * Log a success message
   */
  public success(message: string, context?: Record<string, any>): void {
    if (context) {
      console.log(chalk.green(`[SUCCESS] ${message}`), context);
    } else {
      console.log(chalk.green(`[SUCCESS] ${message}`));
    }
  }

  /**
   * Log a warning message
   */
  public warn(message: string, context?: Record<string, any>): void {
    if (context) {
      console.log(chalk.yellow(`[WARNING] ${message}`), context);
    } else {
      console.log(chalk.yellow(`[WARNING] ${message}`));
    }
  }

  /**
   * Alias for warn for backward compatibility
   */
  public warning(message: string, context?: Record<string, any>): void {
    this.warn(message, context);
  }

  /**
   * Log an error message
   */
  public error(message: string, context?: Record<string, any>): void {
    if (context) {
      console.error(chalk.red(`[ERROR] ${message}`), context);
    } else {
      console.error(chalk.red(`[ERROR] ${message}`));
    }
  }

  /**
   * Log a debug message (only in debug mode)
   */
  public debug(message: string, context?: Record<string, any>): void {
    if (process.env.DEBUG) {
      if (context) {
        console.log(chalk.gray(`[DEBUG] ${message}`), context);
      } else {
        console.log(chalk.gray(`[DEBUG] ${message}`));
      }
    }
  }
}