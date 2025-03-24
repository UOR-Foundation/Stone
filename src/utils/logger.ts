const chalk = require('chalk');

export class Logger {
  /**
   * Log an informational message
   */
  public info(message: string): void {
    console.log(chalk.blue(`[INFO] ${message}`));
  }

  /**
   * Log a success message
   */
  public success(message: string): void {
    console.log(chalk.green(`[SUCCESS] ${message}`));
  }

  /**
   * Log a warning message
   */
  public warning(message: string): void {
    console.log(chalk.yellow(`[WARNING] ${message}`));
  }

  /**
   * Log an error message
   */
  public error(message: string): void {
    console.error(chalk.red(`[ERROR] ${message}`));
  }

  /**
   * Log a debug message (only in debug mode)
   */
  public debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }
}