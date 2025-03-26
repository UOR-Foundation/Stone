import { Command } from 'commander';
import { ConfigLoader } from '../../config/loader';
import { GitHubAuth } from '../../github/auth';
import { GitHubClient } from '../../github/client';
import { StatusDashboard } from '../../dashboard/status-dashboard';
import { ProgressVisualization } from '../../dashboard/progress-visualization';
import { PerformanceAnalytics } from '../../dashboard/performance-analytics';
import { DashboardServer } from '../../dashboard';
import { Logger } from '../../utils/logger';
import * as http from 'http';
import open from 'open';

/**
 * Command for displaying the Stone status dashboard
 */
export function createDashboardCommand(): Command {
  const dashboard = new Command('dashboard')
    .description('Display the Stone status dashboard')
    .option('-i, --issue <number>', 'Show progress for a specific issue')
    .option('-p, --performance', 'Show detailed performance analytics')
    .option('-w, --workflow', 'Show workflow graph')
    .option('-s, --server', 'Start the dashboard web server')
    .option('-port, --port <number>', 'Port for the dashboard server', '3000')
    .option('-o, --open', 'Open the dashboard in the default browser')
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
        
        // Check if we should start the server
        if (options.server) {
          await startDashboardServer(client, configLoader, parseInt(options.port, 10), options.open);
          return;
        }
        
        // Determine what to display in CLI mode
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

/**
 * Start the dashboard web server
 */
async function startDashboardServer(
  client: GitHubClient, 
  configLoader: ConfigLoader,
  port: number = 3000,
  openBrowser: boolean = false
): Promise<void> {
  const logger = new Logger();
  logger.info(`Starting dashboard server on port ${port}...`);
  
  // Create the dashboard server
  const dashboardServer = new DashboardServer(client, configLoader);
  
  // Create an HTTP server to handle requests
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    
    // Parse request
    const apiRequest = {
      path: req.url.split('?')[0],
      method: req.method || 'GET',
      query: parseQueryString(req.url),
      body: {},
      headers: req.headers as Record<string, string>
    };
    
    // Handle the request
    try {
      const response = await dashboardServer.handleRequest(apiRequest);
      
      // Set status code
      res.statusCode = response.status;
      
      // Set headers
      if (response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          res.setHeader(key, value);
        }
      }
      
      // Set content type if not already set
      if (!response.headers?.['Content-Type']) {
        res.setHeader('Content-Type', 'application/json');
      }
      
      // Send response
      if (typeof response.body === 'string') {
        res.end(response.body);
      } else {
        res.end(JSON.stringify(response.body));
      }
    } catch (error) {
      logger.error(`Server error: ${error}`);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
  
  // Start the server
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    logger.info(`Dashboard server running at ${url}`);
    
    // Open browser if requested
    if (openBrowser) {
      open(url);
    }
    
    // Keep the server running until interrupted
    logger.info('Press Ctrl+C to stop the server');
  });
}

/**
 * Parse query string from URL
 */
function parseQueryString(url: string): Record<string, any> {
  const query: Record<string, any> = {};
  const queryString = url.split('?')[1];
  
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
  }
  
  return query;
}