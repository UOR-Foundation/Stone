import micromatch from 'micromatch';
import { LoggerService } from '../services/logger-service';
import { AccessControlManager, Role, RolePermissions } from './access-control';

/**
 * Enhanced RBAC system with performance optimizations and additional features
 */
export class RBAC {
  private patternCache: Map<string, RegExp[]> = new Map();
  private accessManager: AccessControlManager;
  private logger: LoggerService;
  private roleCache: Map<string, Role> = new Map();
  
  constructor(logger: LoggerService) {
    this.logger = logger;
    this.accessManager = new AccessControlManager(logger);
  }
  
  /**
   * Check if a role has permission to modify files in a diff
   * @param roleName Name of the role
   * @param fileDiffs Array of file paths that were modified
   * @returns Object with allowed and denied files
   */
  public checkDiffPermissions(
    roleName: string,
    fileDiffs: string[]
  ): { allowed: string[]; denied: string[] } {
    const result = {
      allowed: [] as string[],
      denied: [] as string[]
    };
    
    for (const filePath of fileDiffs) {
      if (this.checkPermission(roleName, 'files', 'write', filePath)) {
        result.allowed.push(filePath);
      } else {
        result.denied.push(filePath);
      }
    }
    
    return result;
  }
  
  /**
   * Check if a role has permission to modify all files in a diff
   * @param roleName Name of the role
   * @param fileDiffs Array of file paths that were modified
   * @returns True if all files are allowed, false otherwise
   */
  public canModifyAllFiles(roleName: string, fileDiffs: string[]): boolean {
    const { denied } = this.checkDiffPermissions(roleName, fileDiffs);
    return denied.length === 0;
  }
  
  /**
   * Get cached RegExp patterns for a glob pattern
   * @param pattern Glob pattern to compile
   * @returns Array of RegExp objects
   */
  private getCompiledPattern(pattern: string): RegExp[] {
    if (this.patternCache.has(pattern)) {
      return this.patternCache.get(pattern)!;
    }
    
    const isNegated = pattern.startsWith('!');
    const actualPattern = isNegated ? pattern.substring(1) : pattern;
    
    try {
      const regexPattern = micromatch.makeRe(actualPattern);
      const compiled = regexPattern ? [regexPattern] : [];
      this.patternCache.set(pattern, compiled);
      return compiled;
    } catch (error) {
      this.logger.error(`Invalid glob pattern: ${pattern}`);
      return [];
    }
  }
  
  /**
   * Check file permission using cached RegExp patterns for better performance
   * @param roleName Name of the role
   * @param operation Operation ('read' or 'write')
   * @param filePath File path to check
   * @returns True if allowed, false otherwise
   */
  public checkFilePermissionFast(roleName: string, operation: string, filePath: string): boolean {
    if (operation !== 'read' && operation !== 'write') {
      this.logger.warn(`Unknown file operation: ${operation}`);
      return false;
    }
    
    const role = this.getRole(roleName);
    if (!role) {
      this.logger.warn(`Role not found: ${roleName}`);
      return false;
    }
    
    const patterns = role.permissions.files[operation];
    if (!patterns || patterns.length === 0) {
      return false;
    }
    
    const exclusionPatterns = patterns.filter(p => p.startsWith('!'));
    for (const pattern of exclusionPatterns) {
      const regexes = this.getCompiledPattern(pattern);
      for (const regex of regexes) {
        if (regex.test(filePath)) {
          return false;
        }
      }
    }
    
    const inclusionPatterns = patterns.filter(p => !p.startsWith('!'));
    for (const pattern of inclusionPatterns) {
      const regexes = this.getCompiledPattern(pattern);
      for (const regex of regexes) {
        if (regex.test(filePath)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Load RBAC configuration from a file
   * @param config Configuration object with roles and permissions
   * @returns True if loaded successfully, false otherwise
   */
  public loadConfig(config: { roles: Record<string, RolePermissions> }): boolean {
    try {
      if (!config.roles) {
        this.logger.error('Invalid RBAC configuration: missing roles');
        return false;
      }
      
      this.roleCache.clear();
      this.accessManager = new AccessControlManager(this.logger); // Reset the access manager
      
      let roleCount = 0;
      for (const [roleName, permissions] of Object.entries(config.roles)) {
        this.defineRole(roleName, permissions);
        roleCount++;
      }
      
      this.logger.info(`Loaded ${roleCount} roles from configuration`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to load RBAC configuration: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Check if a role exists
   * @param roleName Name of the role
   * @returns True if the role exists, false otherwise
   */
  public hasRole(roleName: string): boolean {
    return this.roleCache.has(roleName) || this.accessManager.getRole(roleName) !== null;
  }
  
  /**
   * Get all role names
   * @returns Array of role names
   */
  public getRoleNames(): string[] {
    return Array.from(this.roleCache.keys());
  }
  
  /**
   * Define a new role with its permissions
   * @param roleName Name of the role
   * @param permissions Permissions for the role
   * @returns True if the role was defined, false if it already existed
   */
  public defineRole(roleName: string, permissions: RolePermissions): boolean {
    const result = this.accessManager.defineRole(roleName, permissions);
    if (result) {
      const role = this.accessManager.getRole(roleName);
      if (role) {
        this.roleCache.set(roleName, role);
      }
    }
    return result;
  }
  
  /**
   * Get a role by name
   * @param roleName Name of the role
   * @returns The role or null if not found
   */
  public getRole(roleName: string): Role | null {
    if (this.roleCache.has(roleName)) {
      return this.roleCache.get(roleName)!;
    }
    
    const role = this.accessManager.getRole(roleName);
    if (role) {
      this.roleCache.set(roleName, role);
    }
    
    return role;
  }
  
  /**
   * Get effective permissions for a role
   * @param roleName Name of the role
   * @returns The effective permissions or null if role not found
   */
  public getEffectivePermissions(roleName: string): RolePermissions | null {
    return this.accessManager.getEffectivePermissions(roleName);
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
    return this.accessManager.checkPermission(roleName, resourceType, operation, resource);
  }
  
  /**
   * Clear the pattern cache
   */
  public clearCache(): void {
    this.patternCache.clear();
    this.roleCache.clear();
    this.logger.debug('Cleared RBAC pattern cache');
  }
}
