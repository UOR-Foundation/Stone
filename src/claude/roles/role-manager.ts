import { ConfigLoader } from '../../config';
import { GitHubAuth } from '../../github';
import { Role } from './role';
import { PMRole } from './pm-role';
import { QARole } from './qa-role';
import { FeatureRole } from './feature-role';
import { AuditorRole } from './auditor-role';
import { ActionsRole } from './actions-role';
import { Logger } from '../../utils/logger';

export class RoleManager {
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger();
  }
  
  /**
   * Get role instance by name
   */
  public async getRoleByName(roleName: string): Promise<Role> {
    const token = await this.getGitHubToken();
    const config = await this.getConfig();
    
    const roleKey = roleName.toLowerCase();
    
    // Check if role exists and is enabled
    if (!(roleKey in config.roles)) {
      throw new Error(`Unknown role: ${roleName}`);
    }
    
    if (!config.roles[roleKey as keyof typeof config.roles]?.enabled) {
      throw new Error(`Role ${roleName} is disabled in configuration`);
    }
    
    // Create and return appropriate role instance
    switch (roleKey) {
      case 'pm':
        return new PMRole(token);
      case 'qa':
        return new QARole(token);
      case 'feature':
        return new FeatureRole(token);
      case 'auditor':
        return new AuditorRole(token);
      case 'actions':
        return new ActionsRole(token);
      default:
        throw new Error(`Unknown role: ${roleName}`);
    }
  }
  
  /**
   * Get role instance by issue label
   */
  public async getRoleByLabel(label: string): Promise<Role> {
    const config = await this.getConfig();
    
    // Map labels to roles
    if (label === config.workflow.stoneLabel) {
      return this.getRoleByName('pm');
    } else if (label === 'stone-qa') {
      return this.getRoleByName('qa');
    } else if (label === 'stone-feature-implement' || label === 'stone-feature-fix') {
      return this.getRoleByName('feature');
    } else if (label === 'stone-audit') {
      return this.getRoleByName('auditor');
    } else if (label === 'stone-actions') {
      return this.getRoleByName('actions');
    }
    
    throw new Error(`No role found for label: ${label}`);
  }
  
  /**
   * Process an issue with the appropriate role based on label
   */
  public async processIssue(issueNumber: number, label: string): Promise<void> {
    try {
      const role = await this.getRoleByLabel(label);
      this.logger.info(`Processing issue #${issueNumber} with ${role.name} role`);
      
      await role.processIssue(issueNumber);
    } catch (error) {
      const roleName = await this.getRoleLabelName(label);
      const errorMessage = `Error processing issue #${issueNumber} with ${roleName} role: ${error instanceof Error ? error.message : String(error)}`;
      
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Get GitHub token
   */
  private async getGitHubToken(): Promise<string> {
    const auth = new GitHubAuth();
    const token = await auth.getToken();
    
    if (!token) {
      throw new Error('GitHub token is required');
    }
    
    return token;
  }
  
  /**
   * Get configuration
   */
  private async getConfig() {
    const configLoader = new ConfigLoader();
    return configLoader.getConfig();
  }
  
  /**
   * Get role name from label for error messages
   */
  private async getRoleLabelName(label: string): Promise<string> {
    const config = await this.getConfig();
    
    if (label === config.workflow.stoneLabel) {
      return 'PM';
    } else if (label === 'stone-qa') {
      return 'QA';
    } else if (label === 'stone-feature-implement' || label === 'stone-feature-fix') {
      return 'Feature';
    } else if (label === 'stone-audit') {
      return 'Auditor';
    } else if (label === 'stone-actions') {
      return 'Actions';
    }
    
    return 'Unknown';
  }
}