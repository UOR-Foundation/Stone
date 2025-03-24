import { Command } from 'commander';
import { ConfigLoader } from '../../config';
import { GitHubAuth, GitHubClient } from '../../github';
import { Logger } from '../../utils/logger';
import { createWorkflowForCLI } from '../../workflow/cli-adapter';

// Logger instance
const logger = new Logger();

export function runCommand(program: Command): void {
  program
    .command('run')
    .description('Run a specific workflow step manually')
    .requiredOption('-w, --workflow <name>', 'Workflow step to run (pm, qa, feature, audit, actions)')
    .requiredOption('-i, --issue <number>', 'Issue number to process')
    .action(async (options) => {
      try {
        const issueNumber = parseInt(options.issue, 10);
        const workflowName = options.workflow.toLowerCase();
        
        if (isNaN(issueNumber) || issueNumber <= 0) {
          throw new Error('Invalid issue number');
        }

        // Validate workflow name
        const validWorkflows = ['pm', 'qa', 'feature', 'audit', 'actions', 'test', 'docs', 'pr'];
        if (!validWorkflows.includes(workflowName)) {
          throw new Error(`Invalid workflow name. Must be one of: ${validWorkflows.join(', ')}`);
        }

        logger.info(`Running ${workflowName} workflow for issue #${issueNumber}...`);

        // Load configuration
        const configLoader = new ConfigLoader();
        const config = await configLoader.load();

        // Set up GitHub authentication
        const auth = new GitHubAuth();
        const token = await auth.getToken();

        if (!token) {
          throw new Error('GitHub token is required. Use stone init to set up authentication.');
        }

        // Create GitHub client
        const client = new GitHubClient(token, config);
        
        // Create workflow handler using our adapter
        const workflow = createWorkflowForCLI(client, config);
        
        // Run the specified workflow
        await workflow.runWorkflow(workflowName, issueNumber);
        
        logger.success(`Workflow ${workflowName} completed for issue #${issueNumber}!`);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Failed to run workflow: ${error.message}`);
          process.exit(1);
        }
      }
    });
}