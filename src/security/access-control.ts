import micromatch from 'micromatch';
import { LoggerService } from '../services/logger-service';

/**
 * Permissions for accessing files
 */
export interface FilePermissions {
  read: string[];
  write: string[];
}

/**
 * Permissions for GitHub operations
 */
export interface GitHubPermissions {
  issues: string[];
  pullRequests: string[];
  branches: string[];
}

/**
 * Permissions for executing workflows
 */
export interface WorkflowPermissions {
  execute: string[];
}

/**
 * Complete set of permissions for a role
 */
export interface RolePermissions {
  files: FilePermissions;
  github: GitHubPermissions;
  workflow: WorkflowPermissions;
}

/**
 * Definition of a role with its permissions
 */
export interface Role {
  name: string;
  permissions: RolePermissions;
}

/**
 * Manages role-based access control for Stone
 */
export class AccessControlManager {
  private roles: Map<string, Role> = new Map();

  constructor(private logger: LoggerService) {}

  /**
   * Define a new role with its permissions
   * @param roleName Name of the role
   * @param permissions Permissions for the role
   * @returns True if the role was defined, false if it already existed
   */
  public defineRole(roleName: string, permissions: RolePermissions): boolean {
    if (this.roles.has(roleName)) {
      this.logger.warn(`Role already exists: ${roleName}`);
      return false;
    }

    this.roles.set(roleName, { 
      name: roleName, 
      permissions 
    });
    
    this.logger.info(`Defined role: ${roleName}`);
    return true;
  }

  /**
   * Get a role by name
   * @param roleName Name of the role
   * @returns The role or null if not found
   */
  public getRole(roleName: string): Role | null {
    const role = this.roles.get(roleName);
    return role || null;
  }

  /**
   * Check if a role has permission for an operation
   * @param roleName Name of the role
   * @param resourceType Type of resource ('files', 'github', 'workflow')
   * @param operation Operation to check
   * @param resource Resource to check permission for
   * @returns True if the role has permission, false otherwise
   */
  public checkPermission(
    roleName: string, 
    resourceType: 'files' | 'github' | 'workflow',
    operation: string, 
    resource: string
  ): boolean {
    const role = this.getRole(roleName);
    
    if (!role) {
      this.logger.warn(`Role not found: ${roleName}`);
      return false;
    }

    // Handle different resource types
    switch (resourceType) {
      case 'files':
        return this.checkFilePermission(role, operation, resource);
      
      case 'github':
        return this.checkGitHubPermission(role, operation, resource);
      
      case 'workflow':
        return this.checkWorkflowPermission(role, operation, resource);
      
      default:
        this.logger.warn(`Unknown resource type: ${resourceType}`);
        return false;
    }
  }

  /**
   * Get all effective permissions for a role
   * @param roleName Name of the role
   * @returns The effective permissions or null if role not found
   */
  public getEffectivePermissions(roleName: string): RolePermissions | null {
    const role = this.getRole(roleName);
    return role ? role.permissions : null;
  }

  /**
   * Check file permission using glob patterns
   * @param role Role to check
   * @param operation Operation ('read' or 'write')
   * @param filePath File path to check
   * @returns True if allowed, false otherwise
   */
  private checkFilePermission(role: Role, operation: string, filePath: string): boolean {
    if (operation !== 'read' && operation !== 'write') {
      this.logger.warn(`Unknown file operation: ${operation}`);
      return false;
    }

    const patterns = role.permissions.files[operation];
    if (!patterns || patterns.length === 0) {
      return false;
    }

    // Using micromatch to check if the file path matches any of the patterns
    // This supports both inclusion and exclusion patterns (with ! prefix)
    return micromatch.isMatch(filePath, patterns);
  }

  /**
   * Check GitHub permission
   * @param role Role to check
   * @param operationType Type of GitHub resource ('issues', 'pullRequests', 'branches')
   * @param operation Operation to perform
   * @returns True if allowed, false otherwise
   */
  private checkGitHubPermission(role: Role, operationType: string, operation: string): boolean {
    const validTypes = ['issues', 'pullRequests', 'branches'];
    
    if (!validTypes.includes(operationType)) {
      this.logger.warn(`Unknown GitHub operation type: ${operationType}`);
      return false;
    }

    const permissions = role.permissions.github[operationType];
    if (!permissions || permissions.length === 0) {
      return false;
    }

    return permissions.includes(operation);
  }

  /**
   * Check workflow permission
   * @param role Role to check
   * @param operationType Type of operation ('execute')
   * @param workflowType Type of workflow
   * @returns True if allowed, false otherwise
   */
  private checkWorkflowPermission(role: Role, operationType: string, workflowType: string): boolean {
    if (operationType !== 'execute') {
      this.logger.warn(`Unknown workflow operation: ${operationType}`);
      return false;
    }

    const permissions = role.permissions.workflow.execute;
    if (!permissions || permissions.length === 0) {
      return false;
    }

    // Check if the role can execute this workflow type
    // Workflow permissions can use glob patterns or exact names
    return micromatch.isMatch(workflowType, permissions);
  }
}
