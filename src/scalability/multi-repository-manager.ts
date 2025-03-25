import path from 'path';
import { GitService } from '../services/git-service';
import { FileSystemService } from '../services/filesystem-service';
import { LoggerService } from '../services/logger-service';
import { RepositoryOptimizer } from './repository-optimizer';

/**
 * Information about a repository
 */
export interface RepositoryInfo {
  name: string;
  path: string;
  url?: string;
  branch?: string;
  isCloned: boolean;
}

/**
 * Configuration for cloning a repository
 */
export interface CloneOptions {
  branch?: string;
  depth?: number;
  useShallowClone?: boolean;
  sparseCheckout?: string[];
  useLFS?: boolean;
}

/**
 * Result of a multi-repository operation
 */
export interface MultiRepoOperationResult {
  success: boolean;
  results: Record<string, {
    success: boolean;
    error?: string;
  }>;
}

/**
 * Manages operations across multiple repositories
 */
export class MultiRepositoryManager {
  private repositories: Map<string, RepositoryInfo> = new Map();
  private optimizer: RepositoryOptimizer;

  constructor(
    private baseDir: string,
    private gitService: GitService,
    private fsService: FileSystemService,
    private logger: LoggerService
  ) {
    this.optimizer = new RepositoryOptimizer(gitService, fsService, logger);
  }

  /**
   * Register a repository with the manager
   * @param name Unique name for the repository
   * @param repoUrl Git URL for the repository
   * @param branch Default branch to use
   * @returns Information about the repository
   */
  public async registerRepository(
    name: string,
    repoUrl?: string,
    branch: string = 'main'
  ): Promise<RepositoryInfo> {
    // Generate path for the repository
    const repoPath = path.join(this.baseDir, name);
    
    // Check if repository is already cloned
    const isCloned = await this.gitService.isGitRepository(repoPath);
    
    const repoInfo: RepositoryInfo = {
      name,
      path: repoPath,
      url: repoUrl,
      branch,
      isCloned
    };
    
    this.repositories.set(name, repoInfo);
    this.logger.info(`Registered repository: ${name}`, { path: repoPath, isCloned });
    
    return repoInfo;
  }

  /**
   * Get information about a registered repository
   * @param name Name of the repository
   * @returns Repository information or null if not found
   */
  public getRepository(name: string): RepositoryInfo | null {
    return this.repositories.get(name) || null;
  }

  /**
   * Get all registered repositories
   * @returns Array of repository information
   */
  public getAllRepositories(): RepositoryInfo[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Clone a repository
   * @param name Name of the repository to clone
   * @param options Cloning options
   * @returns Whether the clone was successful
   */
  public async cloneRepository(
    name: string,
    options: CloneOptions = {}
  ): Promise<boolean> {
    const repo = this.repositories.get(name);
    if (!repo) {
      throw new Error(`Repository not registered: ${name}`);
    }
    
    if (!repo.url) {
      throw new Error(`No URL provided for repository: ${name}`);
    }
    
    if (repo.isCloned) {
      this.logger.info(`Repository already cloned: ${name}`);
      return true;
    }
    
    try {
      // Ensure the parent directory exists
      await this.fsService.ensureDirectoryExists(this.baseDir);
      
      // Build clone command
      const cloneArgs = ['clone'];
      
      // Add shallow clone if needed
      if (options.useShallowClone || options.depth) {
        cloneArgs.push('--depth', `${options.depth || 1}`);
      }
      
      // Add branch if specified
      if (options.branch || repo.branch) {
        cloneArgs.push('--branch', options.branch || repo.branch!);
      }
      
      // Add sparse-checkout if needed
      if (options.sparseCheckout && options.sparseCheckout.length > 0) {
        cloneArgs.push('--sparse');
      }
      
      // Add LFS if needed
      if (options.useLFS) {
        await this.checkLfsInstalled();
      }
      
      // Add URL and destination
      cloneArgs.push(repo.url, repo.path);
      
      // Execute clone command
      await this.gitService.execGitCommand(this.baseDir, cloneArgs);
      
      // Set up sparse checkout if needed
      if (options.sparseCheckout && options.sparseCheckout.length > 0) {
        await this.optimizer.setupSparseCheckout(repo.path, options.sparseCheckout);
      }
      
      // Update repository status
      repo.isCloned = true;
      this.repositories.set(name, repo);
      
      this.logger.info(`Successfully cloned repository: ${name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to clone repository: ${name}`, { error: error.message });
      return false;
    }
  }

  /**
   * Update a repository (fetch and pull)
   * @param name Name of the repository to update
   * @param branch Branch to update (defaults to the repository's default branch)
   * @returns Whether the update was successful
   */
  public async updateRepository(name: string, branch?: string): Promise<boolean> {
    const repo = this.repositories.get(name);
    if (!repo) {
      throw new Error(`Repository not registered: ${name}`);
    }
    
    if (!repo.isCloned) {
      throw new Error(`Repository not cloned: ${name}`);
    }
    
    try {
      // Fetch updates
      await this.gitService.execGitCommand(repo.path, ['fetch', '--prune']);
      
      // Check for local changes
      const hasChanges = await this.gitService.hasUncommittedChanges(repo.path);
      if (hasChanges) {
        throw new Error(`Repository has uncommitted changes: ${name}`);
      }
      
      // Determine branch to update
      const targetBranch = branch || repo.branch || 'main';
      
      // Switch to branch
      await this.gitService.execGitCommand(repo.path, ['checkout', targetBranch]);
      
      // Pull updates
      await this.gitService.execGitCommand(repo.path, ['pull']);
      
      this.logger.info(`Successfully updated repository: ${name} (branch: ${targetBranch})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update repository: ${name}`, { error: error.message });
      return false;
    }
  }

  /**
   * Create a feature branch across multiple repositories
   * @param repos Names of repositories to create branches in
   * @param branchName Name of the branch to create
   * @param baseBranch Base branch to create from (defaults to each repository's default branch)
   * @returns Result of the operation
   */
  public async createFeatureBranch(
    repos: string[],
    branchName: string,
    baseBranch?: string
  ): Promise<MultiRepoOperationResult> {
    const result: MultiRepoOperationResult = {
      success: true,
      results: {}
    };
    
    for (const repoName of repos) {
      const repo = this.repositories.get(repoName);
      if (!repo || !repo.isCloned) {
        result.results[repoName] = {
          success: false,
          error: !repo ? 'Repository not registered' : 'Repository not cloned'
        };
        result.success = false;
        continue;
      }
      
      try {
        // Update the repository first
        await this.updateRepository(repoName, baseBranch || repo.branch);
        
        // Create the branch
        await this.gitService.execGitCommand(repo.path, ['checkout', '-b', branchName]);
        
        result.results[repoName] = { success: true };
      } catch (error) {
        result.results[repoName] = {
          success: false,
          error: error.message
        };
        result.success = false;
      }
    }
    
    return result;
  }

  /**
   * Run a Git command across multiple repositories
   * @param repos Names of repositories to run the command in
   * @param command Git command to run (without 'git' prefix)
   * @returns Result of the operation
   */
  public async executeGitCommand(
    repos: string[],
    command: string[]
  ): Promise<MultiRepoOperationResult> {
    const result: MultiRepoOperationResult = {
      success: true,
      results: {}
    };
    
    for (const repoName of repos) {
      const repo = this.repositories.get(repoName);
      if (!repo || !repo.isCloned) {
        result.results[repoName] = {
          success: false,
          error: !repo ? 'Repository not registered' : 'Repository not cloned'
        };
        result.success = false;
        continue;
      }
      
      try {
        // Execute the command
        await this.gitService.execGitCommand(repo.path, command);
        
        result.results[repoName] = { success: true };
      } catch (error) {
        result.results[repoName] = {
          success: false,
          error: error.message
        };
        result.success = false;
      }
    }
    
    return result;
  }

  /**
   * Optimize multiple repositories
   * @param repos Names of repositories to optimize
   * @returns Result of the operation
   */
  public async optimizeRepositories(repos: string[]): Promise<MultiRepoOperationResult> {
    const result: MultiRepoOperationResult = {
      success: true,
      results: {}
    };
    
    for (const repoName of repos) {
      const repo = this.repositories.get(repoName);
      if (!repo || !repo.isCloned) {
        result.results[repoName] = {
          success: false,
          error: !repo ? 'Repository not registered' : 'Repository not cloned'
        };
        result.success = false;
        continue;
      }
      
      try {
        // Optimize the repository
        const optimizeResult = await this.optimizer.optimizeRepository(repo.path);
        
        result.results[repoName] = {
          success: optimizeResult.success,
          error: optimizeResult.errors.join(', ')
        };
        
        if (!optimizeResult.success) {
          result.success = false;
        }
      } catch (error) {
        result.results[repoName] = {
          success: false,
          error: error.message
        };
        result.success = false;
      }
    }
    
    return result;
  }

  /**
   * Check if Git LFS is installed
   * @throws Error if Git LFS is not installed
   */
  private async checkLfsInstalled(): Promise<void> {
    try {
      await this.gitService.execGitCommand('.', ['lfs', 'version']);
    } catch (error) {
      throw new Error('Git LFS is not installed. Please install it to use LFS features.');
    }
  }
}
