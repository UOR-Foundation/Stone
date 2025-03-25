import path from 'path';
import { GitService } from '../services/git-service';
import { FileSystemService } from '../services/filesystem-service';
import { LoggerService } from '../services/logger-service';

/**
 * Result of a repository optimization
 */
export interface OptimizationResult {
  success: boolean;
  operations: string[];
  errors: string[];
}

/**
 * Configuration for Git LFS
 */
export interface LFSConfig {
  enabled: boolean;
  patterns: string[];
}

/**
 * Provides utilities for optimizing Git repositories
 */
export class RepositoryOptimizer {
  constructor(
    private gitService: GitService,
    private fsService: FileSystemService,
    private logger: LoggerService
  ) {}

  /**
   * Run git garbage collection and other optimizations
   * @param repoPath Path to the Git repository
   * @returns Result of the optimization
   */
  public async optimizeRepository(repoPath: string): Promise<OptimizationResult> {
    const result: OptimizationResult = {
      success: true,
      operations: [],
      errors: []
    };
    
    try {
      // Check if it's a valid repository
      const isRepo = await this.gitService.isGitRepository(repoPath);
      if (!isRepo) {
        throw new Error(`Not a valid Git repository: ${repoPath}`);
      }
      
      // Check for uncommitted changes
      const hasChanges = await this.gitService.hasUncommittedChanges(repoPath);
      if (hasChanges) {
        this.logger.warn(`Repository has uncommitted changes: ${repoPath}`);
      }
      
      // Run Git garbage collection
      try {
        await this.gitService.execGitCommand(repoPath, ['gc', '--aggressive']);
        result.operations.push('Garbage collection');
        this.logger.info(`Garbage collection completed: ${repoPath}`);
      } catch (error: unknown) {
        result.success = false;
        result.errors.push(`Garbage collection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Remove large files from history (if not part of LFS yet)
      try {
        // Identify large files (> 10MB)
        const largeFilesResult = await this.gitService.execGitCommand(repoPath, [
          'rev-list', '--objects', '--all', 
          '|', 'git', 'cat-file', '--batch-check=\'%(objectname) %(objecttype) %(objectsize) %(rest)\'', 
          '|', 'awk', '\'$3 >= 10485760\'', 
          '|', 'sort', '-r', '-n', '-k', '3'
        ]);
        
        if (largeFilesResult.output.trim()) {
          this.logger.warn(`Large files found in repository: ${repoPath}`);
          result.operations.push('Large files identified');
        }
      } catch (error: unknown) {
        result.errors.push(`Large file analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Clean up unnecessary files
      try {
        await this.gitService.execGitCommand(repoPath, ['clean', '-xdf', '--dry-run']);
        result.operations.push('Unnecessary files listed (dry run)');
      } catch (error: unknown) {
        result.errors.push(`Clean dry run failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Prune old objects
      try {
        await this.gitService.execGitCommand(repoPath, ['prune', '--expire=now']);
        result.operations.push('Pruned unreachable objects');
        this.logger.info(`Pruned unreachable objects: ${repoPath}`);
      } catch (error: unknown) {
        result.success = false;
        result.errors.push(`Prune failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Repack repository
      try {
        await this.gitService.execGitCommand(repoPath, ['repack', '-a', '-d', '-f', '--depth=250', '--window=250']);
        result.operations.push('Repacked repository');
        this.logger.info(`Repacked repository: ${repoPath}`);
      } catch (error: unknown) {
        result.success = false;
        result.errors.push(`Repack failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Expire reflog entries
      try {
        await this.gitService.execGitCommand(repoPath, ['reflog', 'expire', '--expire=now', '--all']);
        result.operations.push('Expired reflog entries');
        this.logger.info(`Expired reflog entries: ${repoPath}`);
      } catch (error: unknown) {
        result.success = false;
        result.errors.push(`Reflog expire failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      this.logger.info(`Repository optimization complete: ${repoPath}`, {
        operations: result.operations,
        errors: result.errors
      });
      
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Repository optimization failed: ${repoPath}`, { error: errorMessage });
      return {
        success: false,
        operations: result.operations,
        errors: [...result.errors, errorMessage]
      };
    }
  }

  /**
   * Set up sparse checkout for a repository
   * @param repoPath Path to the Git repository
   * @param patterns Array of file patterns to include in sparse checkout
   * @returns Whether the setup was successful
   */
  public async setupSparseCheckout(repoPath: string, patterns: string[]): Promise<{ success: boolean }> {
    try {
      // Validate patterns
      if (!patterns || patterns.length === 0) {
        throw new Error('No patterns provided for sparse checkout');
      }
      
      // Enable sparse checkout
      await this.gitService.execGitCommand(repoPath, ['config', 'core.sparseCheckout', 'true']);
      
      // Write patterns to sparse checkout file
      const sparseCheckoutPath = path.join(repoPath, '.git', 'info', 'sparse-checkout');
      const content = patterns.join('\n');
      
      await this.fsService.writeFile(sparseCheckoutPath, content);
      
      // Read the existing branch
      const branchResult = await this.gitService.execGitCommand(repoPath, ['branch', '--show-current']);
      const currentBranch = branchResult.output.trim();
      
      // Update working tree
      await this.gitService.execGitCommand(repoPath, ['checkout', currentBranch]);
      
      this.logger.info(`Sparse checkout configured: ${repoPath}`, { patterns });
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to set up sparse checkout: ${repoPath}`, { error: errorMessage });
      return { success: false };
    }
  }

  /**
   * Configure Git LFS for a repository
   * @param repoPath Path to the Git repository
   * @param config LFS configuration
   * @returns Whether the setup was successful
   */
  public async configureLFS(repoPath: string, config: LFSConfig): Promise<{ success: boolean }> {
    try {
      if (!config.enabled) {
        // Disable LFS if it was previously enabled
        await this.gitService.execGitCommand(repoPath, ['lfs', 'uninstall']);
        this.logger.info(`Git LFS disabled: ${repoPath}`);
        return { success: true };
      }
      
      // Check if LFS is installed
      try {
        await this.gitService.execGitCommand(repoPath, ['lfs', 'version']);
      } catch (error: unknown) {
        throw new Error('Git LFS is not installed. Please install it to use LFS features.');
      }
      
      // Install LFS for the repository
      await this.gitService.execGitCommand(repoPath, ['lfs', 'install']);
      
      // Configure file patterns
      if (config.patterns && config.patterns.length > 0) {
        for (const pattern of config.patterns) {
          await this.gitService.execGitCommand(repoPath, ['lfs', 'track', pattern]);
          this.logger.debug(`Configured LFS tracking for pattern: ${pattern}`);
        }
      }
      
      // Ensure .gitattributes is committed
      const gitattributesPath = path.join(repoPath, '.gitattributes');
      if (await this.fsService.fileExists(gitattributesPath)) {
        try {
          await this.gitService.execGitCommand(repoPath, ['add', '.gitattributes']);
          this.logger.debug('Added .gitattributes to staging');
        } catch (error: unknown) {
          this.logger.warn('Failed to add .gitattributes to staging', { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
      
      this.logger.info(`Git LFS configured: ${repoPath}`);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to configure Git LFS: ${repoPath}`, { error: errorMessage });
      return { success: false };
    }
  }
}