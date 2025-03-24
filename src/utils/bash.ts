import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Interface for the results of bash command execution
 */
export interface BashCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Utility class for executing bash commands
 */
export class Bash {
  private execPromise = promisify(exec);

  /**
   * Execute a bash command and return the result
   * @param command The command to execute
   * @param cwd Optional working directory for the command
   * @param timeout Optional timeout in milliseconds
   */
  public async execute(
    command: string,
    cwd?: string,
    timeout?: number
  ): Promise<BashCommandResult> {
    try {
      const options: any = {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      };

      if (cwd) {
        options.cwd = cwd;
      }

      if (timeout) {
        options.timeout = timeout;
      }

      const { stdout, stderr } = await this.execPromise(command, options);

      return {
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (error: any) {
      if (error.code !== undefined && error.stderr !== undefined && error.stdout !== undefined) {
        return {
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code,
        };
      }

      throw error;
    }
  }
}