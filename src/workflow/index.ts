/**
 * Stone Workflow Advanced Features
 * 
 * This module provides advanced features for the Stone workflow system:
 * - Merge conflict resolution
 * - User feedback handling
 * - Documentation management
 * - Error recovery
 */

export * from './conflict-resolution';
export * from './feedback-handler';
export * from './docs-manager';
export * from './error-recovery';
export * from './stone-workflow';
export * from './cli-adapter';

import { ConflictResolution } from './conflict-resolution';
import { FeedbackHandler } from './feedback-handler';
import { DocumentationManager } from './docs-manager';
import { ErrorRecovery } from './error-recovery';

import { GitService } from '../services/git-service';
import { GithubService } from '../services/github-service';
import { FileSystemService } from '../services/filesystem-service';
import { LoggerService } from '../services/logger-service';
import { NotificationService } from '../services/notification-service';

/**
 * Factory function to create all workflow components
 * @param gitService Git service instance
 * @param githubService GitHub service instance
 * @param fsService Filesystem service instance
 * @param loggerService Logger service instance
 * @param notificationService Notification service instance
 * @returns Object containing all workflow components
 */
export function createWorkflowComponents(
  gitService: GitService,
  githubService: GithubService,
  fsService: FileSystemService,
  loggerService: LoggerService,
  notificationService: NotificationService
) {
  return {
    conflictResolution: new ConflictResolution(
      gitService,
      githubService,
      loggerService
    ),
    
    feedbackHandler: new FeedbackHandler(
      githubService,
      loggerService
    ),
    
    documentationManager: new DocumentationManager(
      fsService,
      githubService,
      loggerService
    ),
    
    errorRecovery: new ErrorRecovery(
      fsService,
      githubService,
      loggerService,
      notificationService
    )
  };
}