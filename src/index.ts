/**
 * Stone - A Software Factory for GitHub
 * 
 * Stone is an npm module that implements a software factory approach to GitHub-based 
 * development. It uses Claude Code to orchestrate the software development process 
 * through specialized roles, each with defined responsibilities and boundaries.
 */

// Export services
export * from './services/git-service';
export * from './services/github-service';
export * from './services/filesystem-service';
export * from './services/logger-service';
export * from './services/notification-service';

// Export workflow components
export * from './workflow/conflict-resolution';
export * from './workflow/feedback-handler';
export * from './workflow/docs-manager';
export * from './workflow/error-recovery';
export * from './workflow/stone-workflow';

// Export factory function
export { createWorkflowComponents } from './workflow';

// Re-export StoneWorkflow as the main interface
export { StoneWorkflow } from './workflow/stone-workflow';

/**
 * Initialize Stone with repository configuration
 * @param options Configuration options
 */
export async function init(options?: any): Promise<void> {
  // Implementation to be added in later phases
  throw new Error('Not implemented yet');
}

/**
 * Process a GitHub webhook event
 * @param event Webhook event
 */
export async function processEvent(event: any): Promise<void> {
  // Implementation to be added in later phases
  throw new Error('Not implemented yet');
}

/**
 * Run a specific workflow manually
 * @param workflowType Type of workflow to run
 * @param issueOrPrNumber Issue or PR number
 * @param options Workflow options
 */
export async function runWorkflow(
  workflowType: string,
  issueOrPrNumber: number,
  options?: any
): Promise<void> {
  // Implementation to be added in later phases
  throw new Error('Not implemented yet');
}