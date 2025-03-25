import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { RoleOrchestrator } from '../claude/orchestrator';
import { TokenManager } from '../security/token-manager';
import { AccessControlManager } from '../security/access-control';
import { SensitiveDataFilter } from '../security/data-filter';
import { SecurityAuditLogger } from '../security/audit-logger';
import { RateLimiter } from '../performance/rate-limiter';
import { RequestBatcher } from '../performance/request-batcher';
import { ParallelExecutor } from '../performance/parallel-executor';
import { PerformanceMonitor } from '../performance/performance-monitor';
import { MultiRepositoryManager } from '../scalability/multi-repository-manager';
import { ResourceController } from '../scalability/resource-controller';
import { FileSystemService } from '../services/filesystem-service';
import { LoggerService } from '../services/logger-service';
import { GitService } from '../services/git-service';
import { ConflictResolution } from './conflict-resolution';
import { FeedbackHandler } from './feedback-handler';
import { DocumentationManager } from './docs-manager';
import { ErrorRecoverySystem } from './error-recovery';
import path from 'path';

/**
 * Stone Workflow Integration Options
 */
export interface StoneWorkflowOptions {
  enableSecurity?: boolean;
  enablePerformance?: boolean;
  enableScalability?: boolean;
  resourceLimits?: {
    memoryMB?: number;
    cpuPercent?: number;
    maxParallelism?: number;
  };
}

/**
 * Main workflow manager for Stone
 * Integrates all subsystems and provides a unified interface
 */
export class StoneWorkflow {
  private logger: LoggerService;
  private fsService: FileSystemService;
  private gitService: GitService;
  private roleOrchestrator: RoleOrchestrator;
  private conflictResolution: ConflictResolution;
  private feedbackHandler: FeedbackHandler;
  private docsManager: DocumentationManager;
  private errorRecovery: ErrorRecoverySystem;
  
  // Security components
  private tokenManager?: TokenManager;
  private accessControl?: AccessControlManager;
  private dataFilter?: SensitiveDataFilter;
  private auditLogger?: SecurityAuditLogger;
  
  // Performance components
  private rateLimiter?: RateLimiter;
  private requestBatcher?: RequestBatcher<any, any>;
  private parallelExecutor?: ParallelExecutor;
  private performanceMonitor?: PerformanceMonitor;
  
  // Scalability components
  private multiRepoManager?: MultiRepositoryManager;
  private resourceController?: ResourceController;
  
  // Workflow state
  private initialized = false;

  constructor(
    private client: GitHubClient,
    private config: StoneConfig,
    private options: StoneWorkflowOptions = {}
  ) {
    // Initialize core services
    this.logger = new LoggerService();
    this.fsService = new FileSystemService(this.logger);
    this.gitService = new GitService(this.logger);
    
    // Set default options
    this.options = {
      enableSecurity: true,
      enablePerformance: true,
      enableScalability: true,
      ...options
    };
    
    // Initialize basic workflow components
    this.roleOrchestrator = new RoleOrchestrator(client.getToken());
    this.conflictResolution = new ConflictResolution(client, config, this.logger);
    this.feedbackHandler = new FeedbackHandler(client, config, this.logger);
    this.docsManager = new DocumentationManager(client, config, this.logger);
    this.errorRecovery = new ErrorRecoverySystem(client, config, this.logger);
  }

  /**
   * Initialize the workflow system
   * Sets up all required components based on configuration
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      this.logger.info('Initializing Stone Workflow');
      
      // Initialize security components if enabled
      if (this.options.enableSecurity) {
        await this.initializeSecurity();
      }
      
      // Initialize performance components if enabled
      if (this.options.enablePerformance) {
        this.initializePerformance();
      }
      
      // Initialize scalability components if enabled
      if (this.options.enableScalability) {
        await this.initializeScalability();
      }
      
      this.initialized = true;
      this.logger.info('Stone Workflow initialized successfully');
      
      // Log security audit event for initialization
      if (this.auditLogger) {
        await this.auditLogger.logSecurityEvent({
          type: 'system',
          action: 'initialization',
          status: 'success'
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Stone Workflow', { error: error.message });
      
      // Log security audit event for failed initialization
      if (this.auditLogger) {
        await this.auditLogger.logSecurityEvent({
          type: 'system',
          action: 'initialization',
          status: 'failed',
          details: { error: error.message }
        });
      }
      
      throw error;
    }
  }

  /**
   * Run a specific workflow
   * @param workflowType Type of workflow to run
   * @param issueNumber Issue number to process
   */
  public async runWorkflow(workflowType: string, issueNumber: number): Promise<void> {
    // Ensure system is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Start performance monitoring if enabled
      const timer = this.performanceMonitor?.startTimer(`workflow-${workflowType}`);
      
      // Security check for workflow execution
      if (this.accessControl) {
        // Get the current context role (from Claude orchestrator)
        const currentRole = await this.roleOrchestrator.getCurrentRole();
        
        // Check if role has permission to execute this workflow
        const hasPermission = this.accessControl.checkPermission(
          currentRole.name,
          'workflow',
          'execute',
          workflowType
        );
        
        if (!hasPermission) {
          const errorMessage = `Role ${currentRole.name} does not have permission to execute workflow ${workflowType}`;
          this.logger.error(errorMessage);
          
          // Log security audit event for permission denial
          if (this.auditLogger) {
            await this.auditLogger.logSecurityEvent({
              type: 'access_control',
              action: 'permission_denied',
              user: currentRole.name,
              resource: `workflow:${workflowType}`,
              status: 'denied'
            });
          }
          
          throw new Error(errorMessage);
        }
        
        // Log successful authorization
        if (this.auditLogger) {
          await this.auditLogger.logSecurityEvent({
            type: 'access_control',
            action: 'permission_granted',
            user: currentRole.name,
            resource: `workflow:${workflowType}`,
            status: 'granted'
          });
        }
      }
      
      // Handle API rate limiting if enabled
      if (this.rateLimiter) {
        const tokenResult = await this.rateLimiter.waitForToken('github-api', 120);
        if (!tokenResult.success) {
          throw new Error(`GitHub API rate limit reached, could not execute workflow within timeout period`);
        }
      }
      
      // Execute workflow based on type
      this.logger.info(`Executing workflow: ${workflowType} for issue #${issueNumber}`);
      
      switch (workflowType) {
        case 'pm':
          await this.roleOrchestrator.processWithPMRole(issueNumber);
          break;
        case 'qa':
          await this.roleOrchestrator.processWithQARole(issueNumber);
          break;
        case 'feature':
          await this.roleOrchestrator.processWithFeatureRole(issueNumber);
          break;
        case 'audit':
          await this.roleOrchestrator.processWithAuditorRole(issueNumber);
          break;
        case 'actions':
          await this.roleOrchestrator.processWithActionsRole(issueNumber);
          break;
        case 'conflict-resolution':
          await this.conflictResolution.resolveConflicts(issueNumber);
          break;
        case 'feedback':
          await this.feedbackHandler.processFeedback(issueNumber);
          break;
        case 'docs':
          await this.docsManager.updateDocumentation(issueNumber);
          break;
        case 'pr':
          await this.createPullRequest(issueNumber);
          break;
        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }
      
      // End performance monitoring
      timer?.end();
      
      this.logger.info(`Workflow ${workflowType} completed successfully for issue #${issueNumber}`);
      
      // Log security audit event for workflow completion
      if (this.auditLogger) {
        await this.auditLogger.logSecurityEvent({
          type: 'workflow',
          action: 'execution',
          resource: workflowType,
          status: 'success',
          details: { issueNumber }
        });
      }
    } catch (error) {
      this.logger.error(`Workflow ${workflowType} failed for issue #${issueNumber}`, { error: error.message });
      
      // Log security audit event for workflow failure
      if (this.auditLogger) {
        await this.auditLogger.logSecurityEvent({
          type: 'workflow',
          action: 'execution',
          resource: workflowType,
          status: 'failed',
          details: { issueNumber, error: error.message }
        });
      }
      
      // Handle error recovery
      if (this.errorRecovery) {
        await this.errorRecovery.handleWorkflowError(workflowType, issueNumber, error);
      }
      
      throw error;
    }
  }

  /**
   * Create a pull request for a completed issue
   * @param issueNumber Issue number to create PR for
   */
  private async createPullRequest(issueNumber: number): Promise<void> {
    // Implementation would use the GitHub client to create a PR
    // This is a placeholder for future implementation
    this.logger.info(`Creating pull request for issue #${issueNumber}`);
    
    // In a real implementation, we would:
    // 1. Get the issue details
    // 2. Get the branch name (from issue or config)
    // 3. Create a PR with appropriate title and body
    // 4. Link the PR to the issue
  }

  /**
   * Initialize security components
   */
  private async initializeSecurity(): Promise<void> {
    this.logger.info('Initializing security components');
    
    // Initialize token manager
    this.tokenManager = new TokenManager(this.fsService, this.logger);
    await this.tokenManager.initialize();
    
    // Store the GitHub token securely if not already stored
    try {
      await this.tokenManager.storeToken(this.client.getToken(), 'github');
    } catch (error) {
      this.logger.warn('Could not store GitHub token securely', { error: error.message });
    }
    
    // Initialize access control
    this.accessControl = new AccessControlManager(this.logger);
    
    // Define roles based on Stone specification
    this.accessControl.defineRole('pm', {
      files: {
        read: ['**/*.md', '!CLAUDE.md'],
        write: ['**/docs/**/*.md', 'README.md']
      },
      github: {
        issues: ['read', 'write', 'comment'],
        pullRequests: ['read', 'write', 'comment'],
        branches: ['read']
      },
      workflow: {
        execute: ['pm', 'conflict-resolution', 'feedback', 'docs', 'pr']
      }
    });
    
    this.accessControl.defineRole('qa', {
      files: {
        read: ['**/*'],
        write: ['**/test/**/*.ts', '**/test/**/*.js', '**/benchmarks/**/*']
      },
      github: {
        issues: ['read', 'comment'],
        pullRequests: ['read', 'comment'],
        branches: ['read']
      },
      workflow: {
        execute: ['qa', 'test']
      }
    });
    
    this.accessControl.defineRole('feature', {
      files: {
        read: ['**/*.ts', '**/*.js', '**/*.json'],
        write: ['**/src/**/*.ts', '**/src/**/*.js', '!**/src/claude/**']
      },
      github: {
        issues: ['read', 'comment'],
        pullRequests: ['read', 'comment'],
        branches: ['read', 'write']
      },
      workflow: {
        execute: ['feature', 'implement']
      }
    });
    
    this.accessControl.defineRole('auditor', {
      files: {
        read: ['**/*'],
        write: []
      },
      github: {
        issues: ['read', 'comment'],
        pullRequests: ['read', 'comment'],
        branches: ['read']
      },
      workflow: {
        execute: ['audit']
      }
    });
    
    this.accessControl.defineRole('actions', {
      files: {
        read: ['**/*'],
        write: ['**/.github/workflows/**', '**/.github/actions/**']
      },
      github: {
        issues: ['read', 'comment'],
        pullRequests: ['read', 'comment'],
        branches: ['read']
      },
      workflow: {
        execute: ['actions']
      }
    });
    
    // Initialize sensitive data filter
    this.dataFilter = new SensitiveDataFilter(this.logger);
    
    // Initialize security audit logger
    this.auditLogger = new SecurityAuditLogger(this.fsService, this.logger, this.dataFilter);
    
    this.logger.info('Security components initialized successfully');
  }

  /**
   * Initialize performance components
   */
  private initializePerformance(): void {
    this.logger.info('Initializing performance components');
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.logger);
    
    // Register rate limits for GitHub API
    this.rateLimiter.registerLimit('github-api', 5000, 3600); // Core: 5000 req/hr
    this.rateLimiter.registerLimit('github-search', 30, 60); // Search: 30 req/min
    this.rateLimiter.registerLimit('github-graphql', 5000, 3600); // GraphQL: 5000 points/hr
    
    // Initialize request batcher for GitHub API calls
    this.requestBatcher = new RequestBatcher(
      async (requests) => {
        // This is a placeholder for the real batch processing function
        // In a real implementation, this would batch GitHub API calls
        const results: Record<string, any> = {};
        
        for (const request of requests) {
          results[request.id] = { success: true };
        }
        
        return results;
      },
      this.logger,
      { maxBatchSize: 20, maxWaitTimeMs: 100 }
    );
    
    // Initialize parallel executor
    this.parallelExecutor = new ParallelExecutor(this.logger, {
      maxConcurrent: this.options.resourceLimits?.maxParallelism || 5
    });
    
    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor(this.logger);
    
    // Register operations for monitoring
    this.performanceMonitor.registerOperation('github-api-call');
    this.performanceMonitor.registerOperation('claude-api-call');
    this.performanceMonitor.registerOperation('workflow-execution');
    
    this.logger.info('Performance components initialized successfully');
  }

  /**
   * Initialize scalability components
   */
  private async initializeScalability(): Promise<void> {
    this.logger.info('Initializing scalability components');
    
    // Create repository base directory
    const repoBaseDir = path.join(process.cwd(), '.stone', 'repositories');
    await this.fsService.ensureDirectoryExists(repoBaseDir);
    
    // Initialize multi-repository manager
    this.multiRepoManager = new MultiRepositoryManager(
      repoBaseDir,
      this.gitService,
      this.fsService,
      this.logger
    );
    
    // Register the main repository
    await this.multiRepoManager.registerRepository(
      'main',
      `https://github.com/${this.config.repository.owner}/${this.config.repository.name}`,
      'main'
    );
    
    // Initialize resource controller
    this.resourceController = new ResourceController(this.logger, {
      autoThrottle: true,
      limits: {
        memoryMB: this.options.resourceLimits?.memoryMB,
        cpuPercent: this.options.resourceLimits?.cpuPercent,
        maxParallelism: this.options.resourceLimits?.maxParallelism
      }
    });
    
    // Register for throttle events
    this.resourceController.onThrottle(() => {
      this.logger.warn('Resource limits reached, throttling operations');
      
      // Pause non-critical operations
      if (this.parallelExecutor) {
        // Reduce parallel operations
        this.parallelExecutor.shutdown(true).then(() => {
          // Restart with lower concurrency
          this.parallelExecutor = new ParallelExecutor(this.logger, {
            maxConcurrent: 2 // Reduced concurrency during throttling
          });
        });
      }
    });
    
    // Register for resume events
    this.resourceController.onResume(() => {
      this.logger.info('Resource throttling removed, resuming normal operations');
      
      // Restore normal operations
      if (this.parallelExecutor) {
        // Restore normal concurrency
        this.parallelExecutor.shutdown(true).then(() => {
          this.parallelExecutor = new ParallelExecutor(this.logger, {
            maxConcurrent: this.options.resourceLimits?.maxParallelism || 5
          });
        });
      }
    });
    
    this.logger.info('Scalability components initialized successfully');
  }
}