import { ConfigLoader, ConfigGenerator, StoneConfig } from './config';
import { GitHubAuth, GitHubClient, IssueManager, LabelManager } from './github';
import { StoneWorkflow } from './workflow';
import { ClaudeFileGenerator } from './claude';
import { Logger } from './utils/logger';

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
    
    // Process based on event type
    if (event.action === 'labeled' && event.issue) {
      const label = event.label.name;
      const issueNumber = event.issue.number;
      
      // Handle different labels
      if (label === config.workflow.stoneLabel) {
        // Process new Stone issue
        const issueManager = new IssueManager(client, config);
        await issueManager.processIssue(issueNumber);
      } else if (label.startsWith('stone-')) {
        // Process issue with Stone label
        const workflow = new StoneWorkflow(client, config);
        const workflowType = label.replace('stone-', '');
        await workflow.runWorkflow(workflowType, issueNumber);
      }
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

// Export core types
export { StoneConfig };