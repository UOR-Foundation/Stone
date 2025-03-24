import { Command } from 'commander';
import { ConfigLoader } from '../../config';
import { GitHubAuth, GitHubClient } from '../../github';
import { Logger } from '../../utils/logger';

// Logger instance
const logger = new Logger();

export function resetCommand(program: Command): void {
  program
    .command('reset')
    .description('Reset a Stone issue to start over')
    .requiredOption('-i, --issue <number>', 'Issue number to reset')
    .action(async (options) => {
      try {
        const issueNumber = parseInt(options.issue, 10);
        
        if (isNaN(issueNumber) || issueNumber <= 0) {
          throw new Error('Invalid issue number');
        }

        logger.info(`Resetting issue #${issueNumber}...`);

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
        
        // Get all current labels
        const { data: issue } = await client.getIssue(issueNumber);
        
        // Remove all Stone labels
        const stoneLabels = issue.labels
          .map((label: any) => typeof label === 'string' ? label : label.name)
          .filter(Boolean)
          .filter((name: string | undefined) => name?.startsWith('stone-'));
        
        for (const label of stoneLabels) {
          if (label) {
            try {
              await client.removeLabelFromIssue(issueNumber, label);
            } catch (error) {
              // Ignore if label doesn't exist
            }
          }
        }
        
        // Add stone-process label to start over
        await client.addLabelsToIssue(issueNumber, [config.workflow.stoneLabel]);
        
        // Add comment about reset
        await client.createIssueComment(
          issueNumber,
          'Issue has been reset to the initial state by the Stone CLI. The workflow will start from the beginning.'
        );
        
        logger.success(`Issue #${issueNumber} has been reset successfully!`);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Failed to reset issue: ${error.message}`);
          process.exit(1);
        }
      }
    });
}