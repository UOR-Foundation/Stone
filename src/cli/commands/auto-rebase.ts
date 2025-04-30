import { Command } from 'commander';
import { ConfigLoader } from '../../config/loader';
import { GitHubAuth } from '../../github/auth';
import { GitHubClient } from '../../github/client';
import { GitService } from '../../services/git-service';
import { AutoRebase } from '../../workflow/auto-rebase';
import { LoggerService } from '../../services/logger-service';

/**
 * Command for auto-rebasing feature branches
 */
export function createAutoRebaseCommand(): Command {
  const autoRebase = new Command('auto-rebase')
    .description('Auto-rebase a feature branch on the main branch')
    .option('-p, --pr <number>', 'Pull request number')
    .option('-i, --issue <number>', 'Issue number')
    .action(async (options) => {
      const logger = new LoggerService();
      
      try {
        const configLoader = new ConfigLoader();
        const config = await configLoader.load();
        
        if (!config) {
          logger.error('Failed to load configuration');
          process.exit(1);
        }
        
        const auth = new GitHubAuth();
        const token = await auth.getToken();
        
        if (!token) {
          throw new Error('GitHub token is required');
        }
        
        const client = new GitHubClient(token, config);
        
        const gitService = new GitService(logger);
        
        const autoRebaseService = new AutoRebase(client, config, gitService);
        
        if (options.pr) {
          const prNumber = parseInt(options.pr, 10);
          logger.info(`Processing PR #${prNumber} for auto-rebase`);
          
          const result = await autoRebaseService.processPullRequest(prNumber);
          
          if (result) {
            logger.info(`Successfully rebased PR #${prNumber}`);
          } else {
            logger.error(`Failed to rebase PR #${prNumber}`);
            process.exit(1);
          }
        } else if (options.issue) {
          const issueNumber = parseInt(options.issue, 10);
          logger.info(`Finding PR for issue #${issueNumber}`);
          
          const searchResult = await client.octokit.rest.search.issuesAndPullRequests({
            q: `repo:${config.repository.owner}/${config.repository.name} is:pr is:open issue:${issueNumber}`,
          });
          
          if (searchResult.data.items.length === 0) {
            logger.error(`No open PR found for issue #${issueNumber}`);
            process.exit(1);
          }
          
          const prNumber = searchResult.data.items[0].number;
          logger.info(`Found PR #${prNumber} for issue #${issueNumber}`);
          
          const result = await autoRebaseService.processPullRequest(prNumber);
          
          if (result) {
            logger.info(`Successfully rebased PR #${prNumber} for issue #${issueNumber}`);
          } else {
            logger.error(`Failed to rebase PR #${prNumber} for issue #${issueNumber}`);
            process.exit(1);
          }
        } else {
          logger.error('Either --pr or --issue option is required');
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Auto-rebase error: ${error.message}`);
        }
        process.exit(1);
      }
    });
  
  return autoRebase;
}
