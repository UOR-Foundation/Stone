import { Command } from 'commander';
import { ConfigLoader } from '../../config';
import { GitHubAuth, GitHubClient, IssueManager } from '../../github';
import { Logger } from '../../utils/logger';

// Logger instance
const logger = new Logger();

export function processCommand(program: Command): void {
  program
    .command('process')
    .description('Process a Stone issue')
    .requiredOption('-i, --issue <number>', 'Issue number to process')
    .action(async (options) => {
      try {
        const issueNumber = parseInt(options.issue, 10);
        
        if (isNaN(issueNumber) || issueNumber <= 0) {
          throw new Error('Invalid issue number');
        }

        logger.info(`Processing issue #${issueNumber}...`);

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
        const issueManager = new IssueManager(client, config);

        // Process the issue
        const stage = await issueManager.processIssue(issueNumber);
        
        logger.success(`Issue #${issueNumber} processed successfully!`);
        logger.info(`Current stage: ${stage}`);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Failed to process issue: ${error.message}`);
          process.exit(1);
        }
      }
    });
}