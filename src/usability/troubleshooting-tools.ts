import { ConfigLoader } from '../config/loader';
import { GitHubClient } from '../github/client';
import { Logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Interface for environment info
 */
export interface EnvironmentInfo {
  node: {
    version: string;
    isCompatible: boolean;
  };
  npm: {
    version: string;
    isCompatible: boolean;
  };
  git: {
    version: string;
    isCompatible: boolean;
  };
  os?: {
    type: string;
    version: string;
  };
}

/**
 * Interface for GitHub access check
 */
export interface GitHubAccessCheck {
  isAuthenticated: boolean;
  hasRepoAccess?: boolean;
  hasPushAccess?: boolean;
  error?: string;
}

/**
 * Interface for config check
 */
export interface ConfigCheck {
  isValid: boolean;
  errors: string[];
}

/**
 * Interface for network check
 */
export interface NetworkCheck {
  canReachGitHub: boolean;
  dns?: boolean;
  latency?: number;
  error?: string;
}

/**
 * Interface for diagnostic result
 */
export interface DiagnosticResult {
  environment: EnvironmentInfo;
  githubAccess: GitHubAccessCheck;
  configuration: ConfigCheck;
  network?: NetworkCheck;
  overallStatus: 'healthy' | 'issues' | 'critical';
  issues: string[];
}

/**
 * Interface for fix result
 */
export interface FixResult {
  issue: string;
  canAutoFix: boolean;
  fixed?: boolean;
  fixSteps: string[];
}

/**
 * Class for troubleshooting tools
 */
export class TroubleshootingTools {
  private configLoader: ConfigLoader;
  private githubClient: GitHubClient;
  private logger: Logger;

  constructor(configLoader: ConfigLoader, githubClient: GitHubClient) {
    this.configLoader = configLoader;
    this.githubClient = githubClient;
    this.logger = new Logger();
  }

  /**
   * Check the environment for required dependencies
   */
  public async checkEnvironment(): Promise<EnvironmentInfo> {
    this.logger.info('Checking environment...');
    
    let nodeVersion = '';
    let npmVersion = '';
    let gitVersion = '';
    
    try {
      const { stdout: nodeOut } = await execAsync('node --version');
      nodeVersion = nodeOut.trim();
    } catch (error) {
      this.logger.error('Failed to get Node.js version');
    }
    
    try {
      const { stdout: npmOut } = await execAsync('npm --version');
      npmVersion = npmOut.trim();
    } catch (error) {
      this.logger.error('Failed to get npm version');
    }
    
    try {
      const { stdout: gitOut } = await execAsync('git --version');
      gitVersion = gitOut.trim().replace('git version ', '');
    } catch (error) {
      this.logger.error('Failed to get git version');
    }
    
    // Check compatibility
    const isNodeCompatible = this.checkNodeCompatibility(nodeVersion);
    const isNpmCompatible = this.checkNpmCompatibility(npmVersion);
    const isGitCompatible = this.checkGitCompatibility(gitVersion);
    
    // Get OS info
    let osInfo;
    try {
      const type = process.platform;
      const release = process.release?.name || 'unknown';
      osInfo = {
        type: type || 'unknown',
        version: release || 'unknown'
      };
    } catch (error) {
      this.logger.error('Failed to get OS info');
    }
    
    return {
      node: {
        version: nodeVersion,
        isCompatible: isNodeCompatible
      },
      npm: {
        version: npmVersion,
        isCompatible: isNpmCompatible
      },
      git: {
        version: gitVersion,
        isCompatible: isGitCompatible
      },
      os: osInfo
    };
  }

  /**
   * Check GitHub API access
   */
  public async checkGitHubAccess(): Promise<GitHubAccessCheck> {
    this.logger.info('Checking GitHub access...');
    
    try {
      // Try to get the current user
      const user = await this.githubClient.getCurrentUser();
      
      if (!user) {
        return {
          isAuthenticated: false,
          error: 'Failed to get user information'
        };
      }
      
      // Try to get the repository
      try {
        const config = await this.configLoader.getConfig();
        const repo = await this.githubClient.getRepository(
          config.repository.owner,
          config.repository.name
        );
        
        if (!repo) {
          return {
            isAuthenticated: true,
            hasRepoAccess: false,
            error: 'Repository not found'
          };
        }
        
        // Check permissions
        const hasPushAccess = repo.permissions?.push || false;
        
        return {
          isAuthenticated: true,
          hasRepoAccess: true,
          hasPushAccess
        };
      } catch (error) {
        return {
          isAuthenticated: true,
          hasRepoAccess: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } catch (error) {
      return {
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check the configuration
   */
  public async checkConfiguration(): Promise<ConfigCheck> {
    this.logger.info('Checking configuration...');
    
    try {
      // Load the config
      const config = await this.configLoader.load();
      
      // Validate the config
      return this.configLoader.validateConfig(config);
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Verify network connectivity
   */
  public async verifyNetworkConnectivity(): Promise<NetworkCheck> {
    this.logger.info('Verifying network connectivity...');
    
    // Ping GitHub to check connectivity
    try {
      const startTime = Date.now();
      await execAsync('ping github.com -c 3');
      const endTime = Date.now();
      
      return {
        canReachGitHub: true,
        dns: true,
        latency: (endTime - startTime) / 3 // Average latency
      };
    } catch (error) {
      return {
        canReachGitHub: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run all diagnostics
   */
  public async runDiagnostics(): Promise<DiagnosticResult> {
    this.logger.info('Running diagnostics...');
    
    // Run all checks
    const environment = await this.checkEnvironment();
    const githubAccess = await this.checkGitHubAccess();
    const configuration = await this.checkConfiguration();
    const network = await this.verifyNetworkConnectivity();
    
    // Collect issues
    const issues: string[] = [];
    
    // Check environment issues
    if (!environment.node.isCompatible) {
      issues.push(`Node.js version ${environment.node.version} is not compatible. Please upgrade to v14.0.0 or higher.`);
    }
    if (!environment.npm.isCompatible) {
      issues.push(`npm version ${environment.npm.version} is not compatible. Please upgrade to v6.0.0 or higher.`);
    }
    if (!environment.git.isCompatible) {
      issues.push(`git version ${environment.git.version} is not compatible. Please upgrade to v2.0.0 or higher.`);
    }
    
    // Check GitHub access issues
    if (!githubAccess.isAuthenticated) {
      issues.push(`GitHub authentication failed: ${githubAccess.error}`);
    } else if (!githubAccess.hasRepoAccess) {
      issues.push(`Cannot access repository: ${githubAccess.error}`);
    } else if (!githubAccess.hasPushAccess) {
      issues.push('You do not have push access to the repository.');
    }
    
    // Check configuration issues
    if (!configuration.isValid) {
      configuration.errors.forEach(error => {
        issues.push(`Configuration error: ${error}`);
      });
    }
    
    // Check network issues
    if (!network.canReachGitHub) {
      issues.push(`Cannot reach GitHub: ${network.error}`);
    }
    
    // Determine overall status
    let overallStatus: 'healthy' | 'issues' | 'critical';
    
    if (issues.length === 0) {
      overallStatus = 'healthy';
    } else if (!githubAccess.isAuthenticated || !configuration.isValid || !network.canReachGitHub) {
      overallStatus = 'critical';
    } else {
      overallStatus = 'issues';
    }
    
    return {
      environment,
      githubAccess,
      configuration,
      network,
      overallStatus,
      issues
    };
  }

  /**
   * Format diagnostic result as text
   */
  public formatDiagnosticReport(result: DiagnosticResult): string {
    const lines = [
      '===========================',
      'STONE DIAGNOSTIC REPORT',
      '===========================',
      '',
      `Overall Status: ${result.overallStatus}`,
      '',
      'Environment:',
      `  Node.js: ${result.environment.node.version} (${result.environment.node.isCompatible ? 'OK' : 'Incompatible'})`,
      `  npm: ${result.environment.npm.version} (${result.environment.npm.isCompatible ? 'OK' : 'Incompatible'})`,
      `  git: ${result.environment.git.version} (${result.environment.git.isCompatible ? 'OK' : 'Incompatible'})`,
      '',
      'GitHub Access:',
      `  Authenticated: ${result.githubAccess.isAuthenticated ? 'Yes' : 'No'}`,
      `  Repository Access: ${result.githubAccess.hasRepoAccess ? 'Yes' : 'No'}`
    ];
    
    if (result.githubAccess.hasPushAccess !== undefined) {
      lines.push(`  Push Access: ${result.githubAccess.hasPushAccess ? 'Yes' : 'No'}`);
    }
    
    lines.push('');
    lines.push('Configuration:');
    lines.push(`  Valid: ${result.configuration.isValid ? 'Yes' : 'No'}`);
    
    if (result.configuration.errors.length > 0) {
      lines.push('  Errors:');
      result.configuration.errors.forEach(error => {
        lines.push(`    - ${error}`);
      });
    }
    
    lines.push('');
    
    if (result.network) {
      lines.push('Network:');
      lines.push(`  GitHub Connectivity: ${result.network.canReachGitHub ? 'Yes' : 'No'}`);
      if (result.network.latency !== undefined) {
        lines.push(`  Latency: ${result.network.latency}ms`);
      }
      lines.push('');
    }
    
    if (result.issues.length > 0) {
      lines.push('Issues Found:');
      result.issues.forEach(issue => {
        lines.push(`  - ${issue}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Attempt to fix common issues
   */
  public async fixCommonIssues(issues: string[]): Promise<FixResult[]> {
    const results: FixResult[] = [];
    
    for (const issue of issues) {
      if (issue.includes('Node.js version')) {
        results.push({
          issue,
          canAutoFix: false,
          fixSteps: [
            'Visit https://nodejs.org/ to download and install the latest LTS version',
            'Follow the installation instructions for your platform',
            'Restart your terminal/command prompt after installation'
          ]
        });
      } else if (issue.includes('npm version')) {
        results.push({
          issue,
          canAutoFix: true,
          fixed: await this.tryToFixNpm(),
          fixSteps: [
            'Run: npm install -g npm@latest',
            'If that fails, reinstall Node.js from https://nodejs.org/'
          ]
        });
      } else if (issue.includes('git version')) {
        results.push({
          issue,
          canAutoFix: false,
          fixSteps: [
            'Visit https://git-scm.com/ to download and install the latest version',
            'Follow the installation instructions for your platform',
            'Restart your terminal/command prompt after installation'
          ]
        });
      } else if (issue.includes('GitHub authentication')) {
        results.push({
          issue,
          canAutoFix: false,
          fixSteps: [
            'Go to GitHub Settings > Developer settings > Personal access tokens',
            'Create a new token with the required permissions',
            'Update your token in stone.config.json',
            'Run: stone validate-token to verify it works'
          ]
        });
      } else if (issue.includes('Configuration error')) {
        results.push({
          issue,
          canAutoFix: true,
          fixed: await this.tryToFixConfig(),
          fixSteps: [
            'Run: stone init --wizard to create a new configuration',
            'Or manually edit stone.config.json to fix the issues'
          ]
        });
      } else if (issue.includes('Cannot reach GitHub')) {
        results.push({
          issue,
          canAutoFix: false,
          fixSteps: [
            'Check your internet connection',
            'Verify you can access github.com in a browser',
            'Check if you need to configure a proxy',
            'Check if GitHub is experiencing an outage at https://www.githubstatus.com/'
          ]
        });
      } else {
        // Generic fix steps for unknown issues
        results.push({
          issue,
          canAutoFix: false,
          fixSteps: [
            'Run diagnostics again with verbose logging: stone diagnostic --verbose',
            'Check the Stone logs: stone logs',
            'Refer to the documentation for more help',
            'If the issue persists, please report it as a bug'
          ]
        });
      }
    }
    
    return results;
  }

  /**
   * Try to fix npm version
   */
  private async tryToFixNpm(): Promise<boolean> {
    try {
      await execAsync('npm install -g npm@latest');
      // Check if it worked
      const { stdout: npmOut } = await execAsync('npm --version');
      const npmVersion = npmOut.trim();
      return this.checkNpmCompatibility(npmVersion);
    } catch (error) {
      return false;
    }
  }

  /**
   * Try to fix configuration
   */
  private async tryToFixConfig(): Promise<boolean> {
    try {
      // Backup existing config
      const config = await this.configLoader.load();
      const backupPath = path.join(process.cwd(), 'stone.config.backup.json');
      fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
      
      // Get validation results to identify issues
      const validationResult = this.configLoader.validateConfig(config);
      
      if (validationResult.isValid) {
        return true; // Already valid
      }
      
      // Fix common configuration issues
      let modified = false;
      
      // Ensure repository info exists
      if (!config.repository) {
        config.repository = {
          owner: '',
          name: ''
        };
        // Add defaultBranch with type assertion
        (config.repository as any).defaultBranch = 'main';
        modified = true;
      }
      
      // Ensure workflow configuration exists
      if (!config.workflow) {
        config.workflow = {
          issueTemplate: 'stone-feature.md',
          stoneLabel: 'stone-process',
          useWebhooks: true,
          testCommand: 'npm test',
          timeoutMinutes: 30
        };
        // Add additional properties with type assertion
        (config.workflow as any).issuePrefix = 'STONE';
        (config.workflow as any).branchPrefix = 'feature/';
        (config.workflow as any).useLabels = true;
        modified = true;
      }
      
      // Ensure claude configuration exists
      if (!(config as any).claude) {
        (config as any).claude = {
          apiKey: '',
          endpoint: 'https://api.anthropic.com/v1',
          model: 'claude-3-opus-20240229'
        };
        modified = true;
      }
      
      // Write fixed config
      if (modified) {
        const configPath = path.join(process.cwd(), 'stone.config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // Verify if the fixes resolved the issues
        const newValidation = this.configLoader.validateConfig(config);
        return newValidation.isValid;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Node.js compatibility
   */
  private checkNodeCompatibility(version: string): boolean {
    if (!version) return false;
    
    // Remove 'v' prefix if present
    const versionNumber = version.startsWith('v') 
      ? version.substring(1) 
      : version;
    
    // Get major version
    const major = parseInt(versionNumber.split('.')[0], 10);
    
    // Node.js 14+ is required
    return major >= 14;
  }

  /**
   * Check npm compatibility
   */
  private checkNpmCompatibility(version: string): boolean {
    if (!version) return false;
    
    // Get major version
    const major = parseInt(version.split('.')[0], 10);
    
    // npm 6+ is required
    return major >= 6;
  }

  /**
   * Check git compatibility
   */
  private checkGitCompatibility(version: string): boolean {
    if (!version) return false;
    
    // Get major version
    const major = parseInt(version.split('.')[0], 10);
    
    // git 2+ is required
    return major >= 2;
  }
}