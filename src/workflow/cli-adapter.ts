import { StoneWorkflow } from './stone-workflow';
import { ConflictResolution } from './conflict-resolution';
import { FeedbackHandler } from './feedback-handler';
import { DocumentationManager } from './docs-manager';
import { ErrorRecovery } from './error-recovery';
import { LoggerService } from '../services/logger-service';
import { GitService } from '../services/git-service';
import { GithubService } from '../services/github-service';
import { FileSystemService } from '../services/filesystem-service';
import { NotificationService } from '../services/notification-service';
import { createWorkflowComponents } from './index';
import { v4 as uuidv4 } from 'uuid';
import { StoneConfig } from '../config/schema';

/**
 * Adapter factory to create a StoneWorkflow instance compatible with the CLI
 * interface expected by the existing code.
 */
export function createWorkflowForCLI(client: any, config: any): any {
  // Extract needed services from the client and config
  const gitService: GitService = {
    cloneRepository: async (repoUrl: string) => {
      return client.cloneRepository(repoUrl);
    },
    checkoutBranch: async (repoPath: string, branchName: string) => {
      return client.checkoutBranch(repoPath, branchName);
    },
    rebaseBranch: async (repoPath: string, targetBranch: string) => {
      return client.rebaseBranch(repoPath, targetBranch);
    },
    checkMergeStatus: async (repoPath: string, sourceBranch: string, targetBranch: string) => {
      return client.checkMergeStatus(repoPath, sourceBranch, targetBranch);
    },
    resolveConflicts: async (repoPath: string, files: string[]) => {
      return client.resolveConflicts(repoPath, files);
    },
    pushChanges: async (repoPath: string, branchName: string) => {
      return client.pushChanges(repoPath, branchName);
    }
  };

  const githubService: GithubService = {
    getPullRequest: async (prNumber: number, owner: string, repo: string) => {
      return client.getPullRequest(prNumber, owner, repo);
    },
    getPullRequestComments: async (prNumber: number, owner: string, repo: string) => {
      return client.getPullRequestComments(prNumber, owner, repo);
    },
    updatePullRequest: async (prNumber: number, owner: string, repo: string, data: any) => {
      return client.updatePullRequest(prNumber, owner, repo, data);
    },
    commentOnPullRequest: async (prNumber: number, owner: string, repo: string, comment: string) => {
      return client.commentOnPullRequest(prNumber, owner, repo, comment);
    },
    addLabelToPullRequest: async (prNumber: number, owner: string, repo: string, label: string) => {
      return client.addLabelToPullRequest(prNumber, owner, repo, label);
    },
    createIssue: async (owner: string, repo: string, title: string, body: string) => {
      return client.createIssue(owner, repo, title, body);
    },
    addLabelToIssue: async (issueNumber: number, owner: string, repo: string, label: string) => {
      return client.addLabelToIssue(issueNumber, owner, repo, label);
    },
    commentOnIssue: async (issueNumber: number, owner: string, repo: string, comment: string) => {
      return client.commentOnIssue(issueNumber, owner, repo, comment);
    },
    assignIssueToTeam: async (issueNumber: number, owner: string, repo: string, team: string) => {
      return client.assignIssueToTeam(issueNumber, owner, repo, team);
    },
    createBranch: async (owner: string, repo: string, baseBranch: string, newBranch: string) => {
      return client.createBranch(owner, repo, baseBranch, newBranch);
    },
    commitFiles: async (owner: string, repo: string, branch: string, files: string[], message: string) => {
      return client.commitFiles(owner, repo, branch, files, message);
    },
    createPullRequest: async (owner: string, repo: string, title: string, body: string, head: string, base: string) => {
      return client.createPullRequest(owner, repo, title, body, head, base);
    },
    getWorkflowStatus: async (owner: string, repo: string, workflowId: string) => {
      return client.getWorkflowStatus(owner, repo, workflowId);
    }
  };

  const fsService: FileSystemService = {
    readFile: async (filePath: string) => {
      return client.readFile(filePath);
    },
    writeFile: async (filePath: string, content: string) => {
      return client.writeFile(filePath, content);
    },
    deleteFile: async (filePath: string) => {
      return client.deleteFile(filePath);
    },
    ensureDirectoryExists: async (dirPath: string) => {
      return client.ensureDirectoryExists(dirPath);
    },
    findFiles: async (globPattern: string) => {
      return client.findFiles(globPattern);
    }
  };

  const loggerService: LoggerService = {
    info: (message: string, metadata?: any) => {
      if (client.logger && client.logger.info) {
        client.logger.info(message, metadata);
      }
    },
    warn: (message: string, metadata?: any) => {
      if (client.logger && client.logger.warn) {
        client.logger.warn(message, metadata);
      }
    },
    error: (message: string, error?: Error, metadata?: any) => {
      if (client.logger && client.logger.error) {
        client.logger.error(message, error, metadata);
      }
    },
    debug: (message: string, metadata?: any) => {
      if (client.logger && client.logger.debug) {
        client.logger.debug(message, metadata);
      }
    }
  };

  const notificationService: NotificationService = {
    sendAlert: async (
      title: string,
      message: string,
      recipients: string[],
      severity?: 'info' | 'warning' | 'error' | 'critical'
    ) => {
      if (client.sendAlert) {
        return client.sendAlert(title, message, recipients, severity || 'info');
      }
      return Promise.resolve();
    },
    
    sendStatusUpdate: async (
      title: string,
      message: string,
      recipients: string[]
    ) => {
      if (client.sendStatusUpdate) {
        return client.sendStatusUpdate(title, message, recipients);
      }
      return Promise.resolve();
    }
  };

  // Create workflow components
  const components = createWorkflowComponents(
    gitService,
    githubService,
    fsService,
    loggerService,
    notificationService
  );

  // Create the actual workflow implementation
  const workflow = new StoneWorkflow(
    components.conflictResolution,
    components.feedbackHandler,
    components.documentationManager,
    components.errorRecovery,
    loggerService
  );

  // Return a proxy object that matches the expected CLI interface
  return {
    async runWorkflow(workflowType: string, issueNumber: number, options?: any): Promise<void> {
      const { repository } = config;
      const owner = repository.owner;
      const repo = repository.name;
      
      // Find the appropriate team mappings from config
      const teamMappings: Record<string, string> = {};
      if (config.packages && Array.isArray(config.packages)) {
        for (const pkg of config.packages) {
          if (pkg.name && pkg.team) {
            teamMappings[pkg.name] = pkg.team;
          }
        }
      }
      // Default team if no mappings found
      if (Object.keys(teamMappings).length === 0) {
        teamMappings.default = 'core-team';
      }
      
      // Handle different workflow types
      switch (workflowType) {
        case 'conflict-resolution':
          await workflow.handleMergeConflicts(issueNumber, owner, repo);
          break;
          
        case 'feedback':
          await workflow.handleFeedback(issueNumber, owner, repo, teamMappings);
          break;
          
        case 'documentation':
          // Get package path from options or use default
          const packagePath = options?.packagePath || './packages/core';
          const requiredSections = options?.requiredSections || ['Installation', 'Usage', 'API'];
          
          await workflow.handleDocumentation(packagePath, requiredSections, issueNumber, owner, repo);
          break;
          
        case 'error-recovery':
          const workflowId = options?.workflowId || `workflow-${issueNumber}-${uuidv4().slice(0, 8)}`;
          await workflow.handleErrorRecovery(workflowId);
          break;
          
        default:
          // For other workflow types, we delegate to the existing implementation
          if (client.runWorkflow) {
            await client.runWorkflow(workflowType, issueNumber, options);
          } else {
            throw new Error(`Unsupported workflow type: ${workflowType}`);
          }
      }
    },
    
    // Pass through other methods that might be expected by the CLI
    getWorkflowState: async (issueNumber: number) => {
      if (client.getWorkflowState) {
        return client.getWorkflowState(issueNumber);
      }
      return null;
    },
    
    resetWorkflow: async (issueNumber: number) => {
      if (client.resetWorkflow) {
        return client.resetWorkflow(issueNumber);
      }
      return null;
    }
  };
}