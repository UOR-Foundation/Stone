import { exec } from 'child_process';
import { promisify } from 'util';
import { LoggerService } from './logger-service';

const execAsync = promisify(exec);

/**
 * Result of a Git command execution
 */
export interface GitCommandResult {
  output: string;
  exitCode: number;
}

/**
 * Service for handling Git operations
 */
export class GitService {
  constructor(private logger: LoggerService) {}

  /**
   * Execute a Git command
   * @param repoPath Path to the Git repository
   * @param args Command arguments to pass to Git
   * @returns The result of the command execution
   */
  public async execGitCommand(repoPath: string, args: string[]): Promise<GitCommandResult> {
    const command = `git -C "${repoPath}" ${args.join(' ')}`;
    
    try {
      this.logger.debug(`Executing git command: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      // In Git, some operations write to stderr even on success
      const output = stdout || stderr;
      
      return {
        output: output.trim(),
        exitCode: 0
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Git command failed: ${command}`, { error: errorMessage });
      
      if (error instanceof Error && 'stderr' in error) {
        const stderr = (error as any).stderr;
        this.logger.debug(`Git stderr: ${stderr}`);
      }
      
      throw new Error(`Git command failed: ${errorMessage}`);
    }
  }

  /**
   * Check if a path is a Git repository
   * @param repoPath Path to check
   * @returns True if the path is a Git repository, false otherwise
   */
  public async isGitRepository(repoPath: string): Promise<boolean> {
    try {
      await this.execGitCommand(repoPath, ['rev-parse', '--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch name
   * @param repoPath Path to the Git repository
   * @returns The current branch name
   */
  public async getCurrentBranch(repoPath: string): Promise<string> {
    const result = await this.execGitCommand(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    return result.output;
  }

  /**
   * Check if the repository has uncommitted changes
   * @param repoPath Path to the Git repository
   * @returns True if there are uncommitted changes, false otherwise
   */
  public async hasUncommittedChanges(repoPath: string): Promise<boolean> {
    const result = await this.execGitCommand(repoPath, ['status', '--porcelain']);
    return result.output.length > 0;
  }
}