import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { LoggerService } from '../services/logger-service';
import { GitService } from '../services/git-service';
import { FileSystemService } from '../services/filesystem-service';
import { MultiRepositoryManager } from './multi-repository-manager';
import { ResourceController } from './resource-controller';
import { WorkflowDistributor } from './workflow-distributor';
import { RepositoryOptimizer } from './repository-optimizer';

/**
 * Parent configuration for multi-repository management
 */
export interface ParentConfig {
  repositories: {
    path: string;
    name: string;
    owner: string;
    enabled: boolean;
    priority?: number;
  }[];
  concurrency: number;
  pollingInterval: number;
  logLevel: string;
}

/**
 * Controller for managing multiple Stone repositories
 */
export class Controller {
  private logger: LoggerService;
  private gitService: GitService;
  private fsService: FileSystemService;
  private config: ParentConfig | null = null;
  private repositoryManager: MultiRepositoryManager | null = null;
  private resourceController: ResourceController | null = null;
  private workflowDistributor: WorkflowDistributor | null = null;
  private repositoryOptimizer: RepositoryOptimizer | null = null;
  private childProcesses: Map<string, any> = new Map();
  private isRunning: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  
  /**
   * Create a new Controller instance
   * @param configPath Path to the parent configuration file
   */
  constructor(private configPath: string) {
    this.logger = new LoggerService();
    this.gitService = new GitService(this.logger);
    this.fsService = new FileSystemService(this.logger);
  }
  
  /**
   * Load the parent configuration
   * @returns The loaded configuration
   */
  private async loadConfig(): Promise<ParentConfig> {
    try {
      if (!existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }
      
      const configContent = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configContent) as ParentConfig;
      
      if (!config.repositories || !Array.isArray(config.repositories)) {
        throw new Error('Invalid configuration: repositories must be an array');
      }
      
      if (!config.concurrency || typeof config.concurrency !== 'number') {
        config.concurrency = 2; // Default concurrency
      }
      
      if (!config.pollingInterval || typeof config.pollingInterval !== 'number') {
        config.pollingInterval = 60000; // Default polling interval (1 minute)
      }
      
      if (!config.logLevel) {
        config.logLevel = 'info'; // Default log level
      }
      
      return config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load configuration: ${errorMessage}`);
    }
  }
  
  /**
   * Initialize the controller components
   */
  private async initialize(): Promise<void> {
    try {
      this.config = await this.loadConfig();
      
      this.logger.info(`Loaded configuration with ${this.config.repositories.length} repositories`);
      this.logger.info(`Concurrency: ${this.config.concurrency}, Polling interval: ${this.config.pollingInterval}ms`);
      
      const baseDir = process.cwd();
      this.repositoryManager = new MultiRepositoryManager(
        baseDir,
        this.gitService,
        this.fsService,
        this.logger
      );
      this.resourceController = new ResourceController(this.logger);
      this.workflowDistributor = new WorkflowDistributor(this.logger);
      this.repositoryOptimizer = new RepositoryOptimizer(
        this.gitService,
        this.fsService,
        this.logger
      );
      
      for (const repo of this.config.repositories) {
        if (repo.enabled) {
          await this.repositoryManager.registerRepository(
            repo.name,
            `https://github.com/${repo.owner}/${repo.name}.git`
          );
        }
      }
      
      this.logger.info('Controller initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize controller: ${errorMessage}`);
    }
  }
  
  /**
   * Start the controller
   */
  public async start(): Promise<void> {
    try {
      if (this.isRunning) {
        this.logger.warn('Controller is already running');
        return;
      }
      
      this.logger.info('Starting controller');
      
      await this.initialize();
      
      if (!this.config) {
        throw new Error('Configuration not loaded');
      }
      
      this.isRunning = true;
      
      this.startPolling();
      
      this.logger.info('Controller started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start controller: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Stop the controller
   */
  public stop(): void {
    try {
      if (!this.isRunning) {
        this.logger.warn('Controller is not running');
        return;
      }
      
      this.logger.info('Stopping controller');
      
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
      
      for (const [repoPath, process] of this.childProcesses.entries()) {
        this.logger.info(`Stopping Stone process for repository: ${repoPath}`);
        process.kill();
      }
      
      this.childProcesses.clear();
      this.isRunning = false;
      
      this.logger.info('Controller stopped successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to stop controller: ${errorMessage}`);
    }
  }
  
  /**
   * Start polling for issues to process
   */
  private startPolling(): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    
    this.logger.info(`Starting polling with interval: ${this.config.pollingInterval}ms`);
    
    this.pollRepositories();
    
    this.pollingInterval = setInterval(() => {
      this.pollRepositories();
    }, this.config.pollingInterval);
  }
  
  /**
   * Poll repositories for issues to process
   */
  private async pollRepositories(): Promise<void> {
    try {
      if (!this.config || !this.repositoryManager) {
        throw new Error('Controller not properly initialized');
      }
      
      this.logger.info('Polling repositories for issues to process');
      
      const repositories = this.repositoryManager.getAllRepositories();
      
      if (repositories.length === 0) {
        this.logger.warn('No repositories registered');
        return;
      }
      // Check if we're already at max concurrency
      const currentParallelOps = this.resourceController?.getResourceUsage().parallelOperations || 0;
      if (currentParallelOps >= this.config.concurrency) {
        this.logger.info(`Already at max concurrency (${currentParallelOps}/${this.config.concurrency})`);
        return;
      }
      
      const availableSlots = this.config.concurrency - currentParallelOps;
      const activeRepos = repositories.slice(0, availableSlots);
      
      if (!activeRepos || activeRepos.length === 0) {
        this.logger.info('No repositories allocated for processing');
        return;
      }
      
      // Process each active repository
      for (const repo of activeRepos) {
        this.resourceController?.incrementParallelOperations();
        this.processRepository(repo.path);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to poll repositories: ${errorMessage}`);
    }
  }
  
  /**
   * Process a repository
   * @param repoPath Path to the repository
   */
  private processRepository(repoPath: string): void {
    try {
      if (this.childProcesses.has(repoPath)) {
        this.logger.info(`Repository already being processed: ${repoPath}`);
        return;
      }
      
      this.logger.info(`Processing repository: ${repoPath}`);
      
      const stoneProcess = spawn('npx', ['stone', 'process', '--auto'], {
        cwd: repoPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STONE_CONTROLLER: 'true' }
      });
      
      this.childProcesses.set(repoPath, stoneProcess);
      
      stoneProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          this.logger.info(`[${path.basename(repoPath)}] ${output}`);
        }
      });
      
      stoneProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          this.logger.error(`[${path.basename(repoPath)}] ${output}`);
        }
      });
      
      stoneProcess.on('close', (code) => {
        this.logger.info(`Stone process for repository ${repoPath} exited with code ${code}`);
        this.childProcesses.delete(repoPath);
        
        this.resourceController?.decrementParallelOperations();
      });
      
      stoneProcess.on('error', (error) => {
        this.logger.error(`Stone process for repository ${repoPath} failed: ${error.message}`);
        this.childProcesses.delete(repoPath);
        
        this.resourceController?.decrementParallelOperations();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process repository ${repoPath}: ${errorMessage}`);
      
      this.resourceController?.decrementParallelOperations();
    }
  }
  
  /**
   * Get the status of all repositories
   * @returns Status information for all repositories
   */
  public getStatus(): any {
    if (!this.repositoryManager) {
      return { running: this.isRunning, repositories: [] };
    }
    
    const repositories = this.repositoryManager.getAllRepositories();
    const activeRepos = Array.from(this.childProcesses.keys());
    
    return {
      running: this.isRunning,
      repositories: repositories.map(repo => ({
        path: repo.path,
        name: repo.name,
        active: activeRepos.includes(repo.path)
      })),
      concurrency: this.config?.concurrency || 0,
      pollingInterval: this.config?.pollingInterval || 0
    };
  }
}
