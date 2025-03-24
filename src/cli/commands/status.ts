import { Command } from 'commander';
import { ConfigLoader } from '../../config';
import { GitHubAuth, GitHubClient, IssueManager } from '../../github';
import { Logger } from '../../utils/logger';
import chalk from 'chalk';

// Logger instance
const logger = new Logger();

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Show status of Stone issues')
    .option('-a, --all', 'Show all issues, not just open ones')
    .action(async (options) => {
      try {
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

        // Get Stone issues
        const stoneIssues = await issueManager.getStoneIssues();
        
        if (stoneIssues.data.length === 0) {
          logger.info('No Stone issues found.');
          return;
        }

        // Display issues
        logger.info(`Found ${stoneIssues.data.length} Stone issues:`);
        console.log('');

        for (const issue of stoneIssues.data) {
          // Get labels
          const labels = issue.labels.map((label: any) => {
            return typeof label === 'string' ? label : label.name;
          }).filter(Boolean) as string[];

          // Determine current stage
          let stage = 'Unknown';
          let color = chalk.white;

          if (labels.includes(config.workflow.stoneLabel)) {
            stage = 'Initial';
            color = chalk.blue;
          } else if (labels.includes('stone-qa')) {
            stage = 'QA';
            color = chalk.red;
          } else if (labels.includes('stone-actions')) {
            stage = 'Actions';
            color = chalk.magenta;
          } else if (labels.includes('stone-feature-implement')) {
            stage = 'Feature';
            color = chalk.green;
          } else if (labels.includes('stone-audit')) {
            stage = 'Audit';
            color = chalk.yellow;
          } else if (labels.includes('stone-ready-for-tests')) {
            stage = 'Testing';
            color = chalk.cyan;
          } else if (labels.includes('stone-docs')) {
            stage = 'Docs';
            color = chalk.blue;
          } else if (labels.includes('stone-pr')) {
            stage = 'PR';
            color = chalk.magenta;
          } else if (labels.includes('stone-complete')) {
            stage = 'Complete';
            color = chalk.green;
          } else if (labels.includes('stone-error')) {
            stage = 'Error';
            color = chalk.red;
          }

          // Display issue
          console.log(`${color(`[${stage}]`)} #${issue.number}: ${issue.title}`);
          console.log(`  URL: ${issue.html_url}`);
          console.log(`  Labels: ${labels.join(', ')}`);
          console.log('');
        }
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Failed to get status: ${error.message}`);
          process.exit(1);
        }
      }
    });
}