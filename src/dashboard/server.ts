import { ExtensionAPI, APIRequest, APIResponse } from '../integration/api';
import { StatusDashboard } from './status-dashboard';
import { ProgressVisualization } from './progress-visualization';
import { PerformanceAnalytics } from './performance-analytics';
import { GitHubClient } from '../github/client';
import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Class for serving the dashboard UI and API
 */
export class Server {
  private api: ExtensionAPI;
  private statusDashboard: StatusDashboard;
  private progressVisualization: ProgressVisualization;
  private performanceAnalytics: PerformanceAnalytics;
  private logger: Logger;

  constructor(
    githubClient: GitHubClient,
    configLoader: ConfigLoader
  ) {
    this.logger = new Logger();
    this.api = new ExtensionAPI();
    this.statusDashboard = new StatusDashboard(githubClient, configLoader);
    this.progressVisualization = new ProgressVisualization(this.statusDashboard, configLoader);
    this.performanceAnalytics = new PerformanceAnalytics(this.statusDashboard, githubClient, configLoader);
    
    // Register API endpoints
    this.registerEndpoints();
  }

  /**
   * Register all dashboard API endpoints
   */
  private registerEndpoints(): void {
    // Status data endpoint
    this.api.registerEndpoint({
      path: '/api/status',
      method: 'GET',
      requiresAuth: true,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          const statusData = await this.statusDashboard.getStatusData();
          return {
            status: 200,
            body: statusData
          };
        } catch (error) {
          this.logger.error(`Error getting status data: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to get status data' }
          };
        }
      }
    });

    // Performance metrics endpoint
    this.api.registerEndpoint({
      path: '/api/performance',
      method: 'GET',
      requiresAuth: true,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          const performanceMetrics = await this.statusDashboard.getPerformanceMetrics();
          return {
            status: 200,
            body: performanceMetrics
          };
        } catch (error) {
          this.logger.error(`Error getting performance metrics: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to get performance metrics' }
          };
        }
      }
    });

    // Bottlenecks endpoint
    this.api.registerEndpoint({
      path: '/api/bottlenecks',
      method: 'GET',
      requiresAuth: true,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          const bottlenecks = await this.statusDashboard.identifyBottlenecks();
          return {
            status: 200,
            body: bottlenecks
          };
        } catch (error) {
          this.logger.error(`Error identifying bottlenecks: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to identify bottlenecks' }
          };
        }
      }
    });

    // Workflow progress endpoint
    this.api.registerEndpoint({
      path: '/api/workflow-progress',
      method: 'GET',
      requiresAuth: true,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          const workflowStages = await this.getWorkflowStages();
          return {
            status: 200,
            body: workflowStages
          };
        } catch (error) {
          this.logger.error(`Error getting workflow stages: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to get workflow stages' }
          };
        }
      }
    });

    // Repository list endpoint
    this.api.registerEndpoint({
      path: '/api/repositories',
      method: 'GET',
      requiresAuth: true,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          // This would fetch the actual repositories from GitHub
          // For now, we return a placeholder list
          return {
            status: 200,
            body: [
              { name: 'UOR-Foundation/Stone', id: 'stone' }
            ]
          };
        } catch (error) {
          this.logger.error(`Error getting repositories: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to get repositories' }
          };
        }
      }
    });

    // Issue progress endpoint
    this.api.registerEndpoint({
      path: '/api/issue-progress/:issueNumber',
      method: 'GET',
      requiresAuth: true,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          const issueNumber = parseInt(request.path.split('/').pop() || '0', 10);
          if (!issueNumber) {
            return {
              status: 400,
              body: { error: 'Issue number is required' }
            };
          }

          const progressData = await this.progressVisualization.generateProgressData(issueNumber);
          return {
            status: 200,
            body: progressData
          };
        } catch (error) {
          this.logger.error(`Error getting issue progress: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to get issue progress' }
          };
        }
      }
    });

    // Performance report endpoint
    this.api.registerEndpoint({
      path: '/api/performance-report',
      method: 'GET',
      requiresAuth: true,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          const report = await this.performanceAnalytics.generatePerformanceReport();
          return {
            status: 200,
            body: report
          };
        } catch (error) {
          this.logger.error(`Error generating performance report: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to generate performance report' }
          };
        }
      }
    });

    // Static HTML dashboard endpoint
    this.api.registerEndpoint({
      path: '/',
      method: 'GET',
      requiresAuth: false,
      handler: async (request: APIRequest): Promise<APIResponse> => {
        try {
          // Serve the dashboard HTML
          const htmlContent = this.getDashboardHtml();
          return {
            status: 200,
            body: htmlContent,
            headers: {
              'Content-Type': 'text/html'
            }
          };
        } catch (error) {
          this.logger.error(`Error serving dashboard: ${error}`);
          return {
            status: 500,
            body: { error: 'Failed to serve dashboard' }
          };
        }
      }
    });
  }

  /**
   * Get the dashboard HTML content
   */
  private getDashboardHtml(): string {
    try {
      // Read the HTML file from the root directory
      const htmlPath = path.resolve(process.cwd(), 'index.html');
      return fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      this.logger.error(`Error reading dashboard HTML: ${error}`);
      return '<html><body><h1>Error: Could not load dashboard</h1></body></html>';
    }
  }

  /**
   * Get the current workflow stages
   */
  private async getWorkflowStages(): Promise<any[]> {
    try {
      // This would get the real workflow stages from the repository
      // For now, we return a mock set of stages
      const config = await new ConfigLoader().getConfig();
      
      // Get workflow stages from config or use default
      const workflowStages = config.workflow?.stages || 
        ['stone', 'stone-feature-implement', 'stone-qa', 'stone-audit', 'stone-release'];
      
      // Map stages to the format expected by the dashboard
      const stageNames: Record<string, string> = {
        'stone': 'Planning',
        'stone-feature-implement': 'Implementation',
        'stone-qa': 'QA',
        'stone-audit': 'Audit',
        'stone-release': 'Release'
      };
      
      // Get status data to determine active stages
      const statusData = await this.statusDashboard.getStatusData();
      
      // Create stage objects
      return workflowStages.map((stage, index) => {
        // Find issues with this stage label
        const count = statusData.labelDistribution[stage] || 0;
        const stageName = stageNames[stage] || stage;
        
        // Simple logic to determine current and completed stages
        // In a real implementation, this would be more sophisticated
        return {
          name: stageName,
          label: stage,
          completed: false, // Determine based on real data
          current: false,   // Determine based on real data
          count
        };
      });
    } catch (error) {
      this.logger.error(`Error getting workflow stages: ${error}`);
      throw error;
    }
  }

  /**
   * Handle an API request
   */
  async handleRequest(request: APIRequest): Promise<APIResponse> {
    return this.api.handleRequest(request);
  }

  /**
   * Start the server on the specified port
   */
  async start(port: number): Promise<void> {
    this.logger.info(`Dashboard server started on port ${port}`);
    // Implementation would depend on the HTTP server being used
    // This is just a placeholder
  }
}