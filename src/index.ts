import { ConfigLoader, ConfigGenerator, StoneConfig } from './config';
import { GitHubAuth, GitHubClient, IssueManager, LabelManager } from './github';
import { StoneWorkflow } from './workflow';
import {
  ClaudeFileGenerator,
  ClaudeClient,
  ContextProvider,
  ResponseParser,
  Role,
  RoleManager,
  RoleOrchestrator,
  PMRole,
  QARole,
  FeatureRole,
  AuditorRole,
  ActionsRole
} from './claude';
import { Logger } from './utils/logger';
import { 
  GitHubActionsIntegration,
  WorkflowGenerator,
  WebhookHandler,
  CIPipeline
} from './github-actions';

/**
 * Initialize Stone in a repository
 */
export async function init(options?: { owner?: string; name?: string; token?: string }): Promise<void> {
  const logger = new Logger();
  
  try {
    // Get repository information
    const owner = options?.owner;
    const name = options?.name;
    
    if (!owner || !name) {
      throw new Error('Repository owner and name are required');
    }
    
    // Get GitHub token
    const auth = new GitHubAuth();
    const token = options?.token || await auth.getToken();
    
    if (!token) {
      throw new Error('GitHub token is required');
    }
    
    // Generate configuration
    const generator = new ConfigGenerator();
    const config = await generator.generate(owner, name);
    
    // Create directories
    await generator.createDirectories(config);
    
    // Create GitHub client
    const client = new GitHubClient(token, config);
    
    // Create labels
    const labelManager = new LabelManager(client, config);
    await labelManager.createLabels();
    
    // Create Claude files
    const claudeGenerator = new ClaudeFileGenerator(config);
    await claudeGenerator.generateClaudeFiles();
    
    logger.success('Stone initialized successfully!');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Process a GitHub webhook event
 */
export async function processEvent(event: any): Promise<void> {
  const logger = new Logger();
  
  try {
    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    
    // Get GitHub token
    const auth = new GitHubAuth();
    const token = await auth.getToken();
    
    if (!token) {
      throw new Error('GitHub token is required');
    }
    
    // Create GitHub client
    const client = new GitHubClient(token, config);
    
    // Create role orchestrator
    const orchestrator = new RoleOrchestrator(token);
    
    // Process based on event type
    if (event.action === 'labeled' && event.issue) {
      const label = event.label.name;
      const issueNumber = event.issue.number;
      
      // Check if it's a Stone label
      if (await orchestrator.isStoneLabel(label)) {
        logger.info(`Processing issue #${issueNumber} with label: ${label}`);
        
        // Process issue with the role orchestrator
        await orchestrator.processIssueWithLabel(issueNumber, label);
      }
    } else if (event.action === 'created' && event.comment && event.issue) {
      // Handle new comments (for future implementation)
      logger.info(`New comment on issue #${event.issue.number}`);
    } else if (event.action === 'opened' && event.pull_request) {
      // Handle new pull requests (for future implementation)
      logger.info(`New pull request #${event.pull_request.number}`);
    }
    
    logger.success('Event processed successfully!');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Event processing failed: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Run a specific workflow manually
 */
export async function runWorkflow(
  workflowType: string,
  issueNumber: number,
  options?: { token?: string }
): Promise<void> {
  const logger = new Logger();
  
  try {
    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    
    // Get GitHub token
    const auth = new GitHubAuth();
    const token = options?.token || await auth.getToken();
    
    if (!token) {
      throw new Error('GitHub token is required');
    }
    
    // Create GitHub client
    const client = new GitHubClient(token, config);
    
    // Run workflow
    const workflow = new StoneWorkflow(client, config);
    await workflow.runWorkflow(workflowType, issueNumber);
    
    logger.success(`Workflow ${workflowType} completed for issue #${issueNumber}!`);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Workflow execution failed: ${error.message}`);
      throw error;
    }
  }
}

// Export core classes
export { 
  ClaudeClient,
  ContextProvider,
  ResponseParser,
  Role,
  RoleManager,
  RoleOrchestrator,
  PMRole,
  QARole,
  FeatureRole,
  AuditorRole,
  ActionsRole,
  // GitHub Actions exports
  GitHubActionsIntegration,
  WorkflowGenerator,
  WebhookHandler,
  CIPipeline
};

// Export core types
export type {
  StoneConfig
};

// Export security components
export {
  TokenManager,
  AccessControlManager,
  SensitiveDataFilter,
  SecurityAuditLogger
} from './security';

// Export performance components
export {
  RateLimiter,
  RequestBatcher,
  ParallelExecutor,
  PerformanceMonitor
} from './performance';

// Export scalability components
export {
  RepositoryOptimizer,
  MultiRepositoryManager,
  WorkflowDistributor,
  ResourceController
} from './scalability';

// Export extensibility components
export {
  PluginSystem,
  PluginLoader,
  PluginManager,
  CustomRoleRegistry,
  WorkflowCustomizer,
  ExtensionManager
} from './extension';

// Export template components
export { TemplateSystem } from './templates';
export type { Template, TemplateVariable } from './templates';

// Export integration components
export {
  ExternalToolIntegration,
  ExtensionAPI,
  NotificationSystem,
  DataExchangeManager
} from './integration';

// Export dashboard components
export {
  StatusDashboard,
  ProgressVisualization,
  PerformanceAnalytics
} from './dashboard';

// Export documentation components
export {
  DocumentationManager,
  QuickStartGuideGenerator,
  ExampleProjectGenerator
} from './documentation';

// Export usability components
export {
  InteractiveCLI,
  ConfigurationWizard,
  ErrorRecoveryGuide,
  TroubleshootingTools
} from './usability';