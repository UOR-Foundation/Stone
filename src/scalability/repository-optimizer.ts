import path from 'path';
import { GitService, GitCommandResult } from '../services/git-service';
import { FileSystemService } from '../services/filesystem-service';
import { LoggerService } from '../services/logger-service';

/**
 * Repository statistics from analysis
 */
export interface RepositoryStats {
  objectCount: number;
  sizeInKb: number;
  commitCount: number;
  fileCount: number;
  packRatio: number;
}

/**
 * Result of a repository optimization operation
 */
export interface OptimizationResult {
  success: boolean;
  operations: string[];
  errors: string[];
}

/**
 * Options for repository optimization
 */
export interface OptimizationOptions {
  performGc?: boolean;
  gcAggressive?: boolean;
  prune?: boolean;
  repack?: boolean;
  removeOldLogs?: boolean;
}

/**
 * Options for determining shallow clone recommendation
 */
export interface ShallowCloneOptions {
  sizeThresholdKb?: number;
  commitThreshold?: number;
  objectCountThreshold?: number;
}

/**
 * Status of Git LFS in a repository
 */
export interface GitLFSStatus {
  enabled: boolean;
  objectsToUpload: number;
  objectsToDownload: number;
  totalSizeMB: number;
}

/**
 * Result of Git LFS setup
 */
export interface GitLFSSetupResult {
  success: boolean;
  patterns: string[];
  errors: string[];
}

/**
 * Shallow clone recommendation
 */
export interface ShallowCloneRecommendation {
  recommended: boolean;
  recommendedDepth?: number;
  reason: string;
}

/**
 * Optimizes large repository operations for better scalability
 */
export class RepositoryOptimizer {
  constructor(
    private gitService: GitService,
    private fsService: FileSystemService,
    private logger: LoggerService
  ) {}

  /**
   * Analyze a repository to get its statistics
   * @param repoPath Path to the Git repository
   * @returns Repository statistics
   */
  public async analyzeRepository(repoPath: string): Promise<RepositoryStats> {
    try {
      // Execute git count-objects -v to get object statistics
      const objectsResult = await this.gitService.execGitCommand(repoPath, ['count-objects', '-v']);
      
      // Extract object counts and sizes
      const objectStats = this.parseObjectStats(objectsResult.output);
      
      // Get commit count
      const commitResult = await this.gitService.execGitCommand(repoPath, ['rev-list', '--count', '--all']);
      const commitCount = parseInt(commitResult.output.trim(), 10);
      
      // Get file count
      const fileResult = await this.gitService.execGitCommand(repoPath, ['ls-files', '|', 'wc', '-l']);
      const fileCount = parseInt(fileResult.output.trim(), 10);
      
      // Calculate pack ratio (percentage of objects in pack files)
      const totalObjects = objectStats.count + objectStats.inPack;
      const packRatio = totalObjects > 0 ? objectStats.inPack / totalObjects : 0;
      
      return {
        objectCount: totalObjects,
        sizeInKb: objectStats.size + objectStats.sizePack,
        commitCount,
        fileCount,
        packRatio
      };
    } catch (error) {
      this.logger.error(`Failed to analyze repository: ${repoPath}`, { error: error.message });
      throw new Error(`Failed to analyze repository: ${error.message}`);
    }
  }

  /**
   * Optimize a repository for better performance
   * @param repoPath Path to the Git repository
   * @param options Optimization options
   * @returns Result of the optimization
   */
  public async optimizeRepository(
    repoPath: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    // Default options
    const opts = {
      performGc: true,
      gcAggressive: true,
      prune: true,
      repack: true,
      removeOldLogs: false,
      ...options
    };
    
    const result: OptimizationResult = {
      success: true,
      operations: [],
      errors: []
    };
    
    try {
      // Garbage collection
      if (opts.performGc) {
        try {
          const gcArgs = opts.gcAggressive ? ['gc', '--aggressive'] : ['gc'];
          await this.gitService.execGitCommand(repoPath, gcArgs);
          result.operations.push('git-gc' + (opts.gcAggressive ? '-aggressive' : ''));
        } catch (error) {
          result.success = false;
          result.errors.push(`GC failed: ${error.message}`);
        }
      }
      
      // Prune
      if (opts.prune) {
        try {
          await this.gitService.execGitCommand(repoPath, ['prune']);
          result.operations.push('prune');
        } catch (error) {
          result.success = false;
          result.errors.push(`Prune failed: ${error.message}`);
        }
      }
      
      // Repack
      if (opts.repack) {
        try {
          await this.gitService.execGitCommand(repoPath, ['repack', '-a', '-d']);
          result.operations.push('repack');
        } catch (error) {
          result.success = false;
          result.errors.push(`Repack failed: ${error.message}`);
        }
      }
      
      // Remove old logs
      if (opts.removeOldLogs) {
        try {
          await this.gitService.execGitCommand(repoPath, ['reflog', 'expire', '--expire=30.days', '--all']);
          result.operations.push('reflog-expire');
        } catch (error) {
          result.success = false;
          result.errors.push(`Reflog expire failed: ${error.message}`);
        }
      }
      
      this.logger.info(`Repository optimization complete: ${repoPath}`, {
        operations: result.operations,
        errors: result.errors
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Repository optimization failed: ${repoPath}`, { error: error.message });
      return {
        success: false,
        operations: result.operations,
        errors: [...result.errors, error.message]
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
      
      this.logger.info(`Sparse checkout configured for ${repoPath}`, { patterns });
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to set up sparse checkout: ${repoPath}`, { error: error.message });
      throw new Error(`Failed to set up sparse checkout: ${error.message}`);
    }
  }

  /**
   * Get the status of Git LFS in a repository
   * @param repoPath Path to the Git repository
   * @returns Git LFS status
   */
  public async getGitLFSStatus(repoPath: string): Promise<GitLFSStatus> {
    try {
      // Check if LFS is enabled by running 'git lfs status'
      const lfsResult = await this.gitService.execGitCommand(repoPath, ['lfs', 'status']);
      
      // Parse the output to get LFS status
      const status = this.parseLFSStatus(lfsResult.output);
      
      return {
        enabled: true,
        ...status
      };
    } catch (error) {
      // If the command fails, LFS is likely not enabled
      this.logger.debug(`Git LFS not enabled for ${repoPath}`);
      
      return {
        enabled: false,
        objectsToUpload: 0,
        objectsToDownload: 0,
        totalSizeMB: 0
      };
    }
  }

  /**
   * Set up Git LFS for a repository
   * @param repoPath Path to the Git repository
   * @param patterns File patterns to track with LFS
   * @returns Result of the setup
   */
  public async setupGitLFS(repoPath: string, patterns: string[]): Promise<GitLFSSetupResult> {
    try {
      // Install Git LFS
      await this.gitService.execGitCommand(repoPath, ['lfs', 'install']);
      
      const result: GitLFSSetupResult = {
        success: true,
        patterns: [],
        errors: []
      };
      
      // Track each pattern
      for (const pattern of patterns) {
        try {
          await this.gitService.execGitCommand(repoPath, ['lfs', 'track', pattern]);
          result.patterns.push(pattern);
        } catch (error) {
          result.errors.push(`Failed to track pattern ${pattern}: ${error.message}`);
        }
      }
      
      // Add .gitattributes to git
      try {
        await this.gitService.execGitCommand(repoPath, ['add', '.gitattributes']);
      } catch (error) {
        result.errors.push(`Failed to add .gitattributes: ${error.message}`);
      }
      
      this.logger.info(`Git LFS setup complete for ${repoPath}`, {
        patterns: result.patterns,
        errors: result.errors
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to set up Git LFS: ${repoPath}`, { error: error.message });
      throw new Error(`Failed to set up Git LFS: ${error.message}`);
    }
  }

  /**
   * Determine if a repository should use shallow clone
   * @param repoPath Path to the Git repository
   * @param options Options for the recommendation
   * @returns Recommendation for shallow clone
   */
  public async shouldUseShallowClone(
    repoPath: string,
    options?: ShallowCloneOptions
  ): Promise<ShallowCloneRecommendation> {
    // Default thresholds
    const thresholds = {
      sizeThresholdKb: 100000, // 100MB
      commitThreshold: 1000,
      objectCountThreshold: 10000,
      ...options
    };
    
    // Analyze repository
    const stats = await this.analyzeRepository(repoPath);
    
    // Check thresholds
    const exceedsSize = stats.sizeInKb > thresholds.sizeThresholdKb;
    const exceedsCommits = stats.commitCount > thresholds.commitThreshold;
    const exceedsObjects = stats.objectCount > thresholds.objectCountThreshold;
    
    // Make recommendation
    if (exceedsSize || exceedsCommits || exceedsObjects) {
      // Recommend shallow clone
      let reason = '';
      if (exceedsSize) {
        reason += `large repository size (${Math.round(stats.sizeInKb / 1024)} MB), `;
      }
      if (exceedsCommits) {
        reason += `high commit count (${stats.commitCount}), `;
      }
      if (exceedsObjects) {
        reason += `high object count (${stats.objectCount}), `;
      }
      reason = reason.slice(0, -2); // Remove trailing comma and space
      
      // Calculate recommended depth
      // For larger repos, use a smaller depth
      const recommendedDepth = Math.min(
        100, // Maximum depth
        Math.max(
          10, // Minimum depth
          Math.round(thresholds.commitThreshold / (stats.commitCount / 100))
        )
      );
      
      return {
        recommended: true,
        recommendedDepth,
        reason: `Shallow clone recommended due to ${reason}`
      };
    }
    
    // Don't recommend shallow clone for small repos
    return {
      recommended: false,
      reason: 'Repository is small enough for full clone'
    };
  }

  /**
   * Parse the output of git count-objects -v
   * @param output Command output
   * @returns Parsed statistics
   */
  private parseObjectStats(output: string): {
    count: number;
    size: number;
    inPack: number;
    sizePack: number;
  } {
    const stats = {
      count: 0,
      size: 0,
      inPack: 0,
      sizePack: 0
    };
    
    // Parse each line
    const lines = output.split('\n');
    for (const line of lines) {
      const [key, valueStr] = line.split(':', 2).map(s => s.trim());
      const value = parseInt(valueStr, 10);
      
      if (key === 'count') stats.count = value;
      if (key === 'size') stats.size = value;
      if (key === 'in-pack') stats.inPack = value;
      if (key === 'size-pack') stats.sizePack = value;
    }
    
    return stats;
  }

  /**
   * Parse the output of git lfs status
   * @param output Command output
   * @returns Parsed LFS status
   */
  private parseLFSStatus(output: string): {
    objectsToUpload: number;
    objectsToDownload: number;
    totalSizeMB: number;
  } {
    const status = {
      objectsToUpload: 0,
      objectsToDownload: 0,
      totalSizeMB: 0
    };
    
    // Count objects to upload
    const uploadMatch = output.match(/Objects to be pushed to [^:]+:\s*(\d+)/i);
    if (uploadMatch) {
      status.objectsToUpload = parseInt(uploadMatch[1], 10);
    }
    
    // Count objects to download
    const downloadMatch = output.match(/Objects to be downloaded:\s*(\d+)/i);
    if (downloadMatch) {
      status.objectsToDownload = parseInt(downloadMatch[1], 10);
    }
    
    // Sum up sizes
    const sizeRegex = /(\d+(\.\d+)?)\s*MB/gi;
    let match;
    while ((match = sizeRegex.exec(output)) !== null) {
      status.totalSizeMB += parseFloat(match[1]);
    }
    
    return status;
  }
}
