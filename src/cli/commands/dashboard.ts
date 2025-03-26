import { Command } from 'commander';
import { ConfigLoader } from '../../config/loader';
import { GitHubAuth } from '../../github/auth';
import { GitHubClient } from '../../github/client';
import { StatusDashboard } from '../../dashboard/status-dashboard';
import { ProgressVisualization } from '../../dashboard/progress-visualization';
import { PerformanceAnalytics } from '../../dashboard/performance-analytics';
import { Logger } from '../../utils/logger';

/**
 * Command for displaying the Stone status dashboard
 */
export function createDashboardCommand(): Command {
  const dashboard = new Command('dashboard')
    .description('Display the Stone status dashboard')
    .option('-i, --issue <number>', 'Show progress for a specific issue')
    .option('-p, --performance', 'Show detailed performance analytics')
    .option('-w, --workflow', 'Show workflow graph')
    .action(async (options) => {
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
        
        // Create dashboard components
        const statusDashboard = new StatusDashboard(client, configLoader);
        const progressVisualization = new ProgressVisualization(statusDashboard, configLoader);
        const performanceAnalytics = new PerformanceAnalytics(statusDashboard, client, configLoader);
        
        // Determine what to display
        if (options.issue) {
          // Show issue progress
          const issueNumber = parseInt(options.issue, 10);
          
          logger.info(`Displaying progress for issue #${issueNumber}...`);
          
          // Display progress bar
          const progressData = await progressVisualization.generateProgressData(issueNumber);
          const progressBar = progressVisualization.renderProgressBar(progressData);
          console.log(progressBar);
          
          // Display timeline
          const timeline = await progressVisualization.renderTimelineView(issueNumber);
          console.log(timeline);
        } else if (options.performance) {
          // Show performance analytics
          logger.info('Generating performance report...');
          
          const report = await performanceAnalytics.renderPerformanceReport();
          console.log(report);
        } else if (options.workflow) {
          // Show workflow graph
          logger.info('Generating workflow graph...');
          
          const graph = await progressVisualization.generateWorkflowGraph();
          console.log(graph);
        } else {
          // Show general dashboard
          logger.info('Displaying status dashboard...');
          
          const dashboardText = await statusDashboard.renderStatusDashboard();
          console.log(dashboardText);
        }
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Dashboard error: ${error.message}`);
        }
        process.exit(1);
      }
    });
  
  return dashboard;
}