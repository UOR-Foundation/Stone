import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';

/**
 * Interface for an error solution
 */
export interface ErrorSolution {
  title: string;
  steps: string[];
}

/**
 * Interface for error context
 */
export interface ErrorContext {
  errorType: string;
  message: string;
  possibleCauses: string[];
}

/**
 * Interface for error diagnosis
 */
export interface ErrorDiagnosis {
  title: string;
  description: string;
  steps: string[];
}

/**
 * Interface for common error pattern
 */
interface CommonErrorPattern {
  errorPattern: RegExp;
  errorType: string;
  solutions: ErrorSolution[];
}

/**
 * Class for providing error recovery guidance
 */
export class ErrorRecoveryGuide {
  private configLoader: ConfigLoader;
  private logger: Logger;
  private commonErrorPatterns: CommonErrorPattern[] = [
    {
      errorPattern: /authentication|credentials|token|unauthorized/i,
      errorType: 'authentication',
      solutions: [
        {
          title: 'Regenerate GitHub token',
          steps: [
            'Go to GitHub Settings > Developer settings > Personal access tokens',
            'Create a new token with the required permissions',
            'Update your Stone configuration with the new token'
          ]
        },
        {
          title: 'Check token permissions',
          steps: [
            'Ensure your token has the following permissions:',
            '- repo: Full access',
            '- workflow: For GitHub Actions integration',
            '- admin:org: For creating labels'
          ]
        }
      ]
    },
    {
      errorPattern: /network|connection|timeout|ECONNREFUSED|ETIMEDOUT/i,
      errorType: 'network',
      solutions: [
        {
          title: 'Check internet connection',
          steps: [
            'Verify your internet connection is working',
            'Try accessing github.com in a browser',
            'Check if GitHub status is reporting any issues (https://www.githubstatus.com/)'
          ]
        },
        {
          title: 'Check proxy settings',
          steps: [
            'If using a proxy, verify your proxy settings',
            'Check if HTTPS_PROXY or HTTP_PROXY environment variables are set correctly'
          ]
        }
      ]
    },
    {
      errorPattern: /configuration|config|missing|invalid/i,
      errorType: 'configuration',
      solutions: [
        {
          title: 'Fix configuration file',
          steps: [
            'Verify that stone.config.json exists in your project root',
            'Check for syntax errors in the config file',
            'Ensure all required fields are present'
          ]
        },
        {
          title: 'Regenerate configuration',
          steps: [
            'Run "stone init" to regenerate the configuration',
            'Use the interactive mode for guidance: "stone init --interactive"'
          ]
        }
      ]
    },
    {
      errorPattern: /permission|access|denied|forbidden/i,
      errorType: 'permission',
      solutions: [
        {
          title: 'Check repository permissions',
          steps: [
            'Verify that you have write access to the repository',
            'Check if your GitHub token has sufficient permissions',
            'If using an organization repository, check organization settings'
          ]
        }
      ]
    }
  ];

  constructor(configLoader: ConfigLoader) {
    this.configLoader = configLoader;
    this.logger = new Logger();
  }

  /**
   * Analyze an error and determine its type and possible causes
   */
  public analyzeError(error: Error): ErrorContext {
    this.logger.info('Analyzing error...');
    
    const errorMessage = error.message;
    
    // Try to match the error against known patterns
    for (const pattern of this.commonErrorPatterns) {
      if (pattern.errorPattern.test(errorMessage)) {
        return {
          errorType: pattern.errorType,
          message: errorMessage,
          possibleCauses: this.getCausesForErrorType(pattern.errorType, errorMessage)
        };
      }
    }
    
    // If no pattern matches, return generic error info
    return {
      errorType: 'unknown',
      message: errorMessage,
      possibleCauses: ['Unknown issue', 'Could be a bug or unexpected error']
    };
  }

  /**
   * Get possible causes for an error type
   */
  private getCausesForErrorType(errorType: string, message: string): string[] {
    switch (errorType) {
      case 'authentication':
        return [
          'Invalid GitHub token',
          'Token expired',
          'Token lacks required permissions',
          'Two-factor authentication issue'
        ];
      case 'network':
        return [
          'Internet connection issue',
          'GitHub API is down',
          'Firewall blocking connections',
          'Proxy configuration issue'
        ];
      case 'configuration':
        return [
          'Configuration file is missing or invalid',
          'Required fields are missing',
          'Syntax error in configuration file',
          'Using wrong configuration format'
        ];
      case 'permission':
        return [
          'Insufficient repository access',
          'Token lacks required permissions',
          'Organization restrictions',
          'Repository is private and not accessible'
        ];
      default:
        // Try to extract clues from the message
        if (message.includes('file')) {
          return ['File system issue', 'Missing or invalid file'];
        } else if (message.includes('rate limit')) {
          return ['GitHub API rate limit exceeded', 'Too many requests in a short time'];
        } else {
          return ['Unknown issue'];
        }
    }
  }

  /**
   * Get solutions for an error context
   */
  public getSolutions(errorContext: ErrorContext): ErrorSolution[] {
    // Find solutions for the error type
    for (const pattern of this.commonErrorPatterns) {
      if (pattern.errorType === errorContext.errorType) {
        return pattern.solutions;
      }
    }
    
    // Generic solutions for unknown errors
    return [
      {
        title: 'General troubleshooting',
        steps: [
          'Check the logs for more details: "stone logs"',
          'Run diagnostics: "stone diagnostic"',
          'Verify your configuration: "stone validate-config"',
          'Try again with verbose logging: "stone --verbose <command>"'
        ]
      }
    ];
  }

  /**
   * Format error analysis and solutions in a readable way
   */
  public formatErrorHelp(context: ErrorContext, solutions: ErrorSolution[]): string {
    const lines = [
      '===========================',
      'ERROR RECOVERY GUIDE',
      '===========================',
      '',
      `ERROR: ${context.message}`,
      '',
      'POSSIBLE CAUSES:',
      ...context.possibleCauses.map(cause => `- ${cause}`),
      '',
      'SOLUTIONS:',
      ''
    ];
    
    for (const solution of solutions) {
      lines.push(`## ${solution.title}:`);
      solution.steps.forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });
      lines.push('');
    }
    
    lines.push('If you continue to experience issues, please check the documentation or ask for help.');
    
    return lines.join('\n');
  }

  /**
   * Analyze an error and get recovery steps
   */
  public getRecoverySteps(error: Error): string {
    const errorContext = this.analyzeError(error);
    const solutions = this.getSolutions(errorContext);
    return this.formatErrorHelp(errorContext, solutions);
  }

  /**
   * Diagnose errors during initialization
   */
  public diagnoseDuringInit(error: Error): ErrorDiagnosis {
    const errorMessage = error.message;
    let diagnosis: ErrorDiagnosis;
    
    if (errorMessage.includes('token') || errorMessage.includes('authentication')) {
      diagnosis = {
        title: 'GitHub Authentication Issue',
        description: 'There was a problem authenticating with GitHub.',
        steps: [
          'Check your GitHub token is valid and has the correct permissions',
          'Regenerate your token in GitHub Settings > Developer settings > Personal access tokens',
          'Update your token in stone.config.json',
          'Try again: stone init'
        ]
      };
    } else if (errorMessage.includes('config') || errorMessage.includes('configuration')) {
      diagnosis = {
        title: 'Configuration Issue',
        description: 'There was a problem with your Stone configuration.',
        steps: [
          'Check your stone.config.json file exists and is valid JSON',
          'Verify all required fields are present',
          'Try using the configuration wizard: stone init --wizard'
        ]
      };
    } else if (errorMessage.includes('directory') || errorMessage.includes('file')) {
      diagnosis = {
        title: 'File System Issue',
        description: 'There was a problem creating or accessing files or directories.',
        steps: [
          'Check your permissions in the current directory',
          'Verify the directory structure exists',
          'Try running with elevated permissions if needed'
        ]
      };
    } else {
      // Generic diagnosis
      diagnosis = {
        title: 'Initialization Error',
        description: 'An error occurred during initialization.',
        steps: [
          'Check the error message: ' + errorMessage,
          'Run with verbose logging: stone init --verbose',
          'Check your GitHub token and configuration',
          'Try again after resolving the issue'
        ]
      };
    }
    
    return diagnosis;
  }

  /**
   * Diagnose errors during workflow execution
   */
  public diagnoseDuringWorkflow(error: Error, context: any): ErrorDiagnosis {
    const errorMessage = error.message;
    let diagnosis: ErrorDiagnosis;
    
    if (errorMessage.includes('issue not found') || errorMessage.includes('no such issue')) {
      diagnosis = {
        title: 'Issue Not Found',
        description: `Issue #${context.issueNumber} could not be found.`,
        steps: [
          'Verify the issue number is correct',
          'Check that the issue exists in the repository',
          'Ensure your GitHub token has access to the repository'
        ]
      };
    } else if (errorMessage.includes('label') || errorMessage.includes('stone-')) {
      diagnosis = {
        title: 'Label Issue',
        description: 'There was a problem with Stone labels.',
        steps: [
          'Verify the issue has the correct Stone label',
          'Check if Stone labels exist in the repository',
          'Try creating labels: stone create-labels'
        ]
      };
    } else if (errorMessage.includes('role') || errorMessage.includes('workflow')) {
      diagnosis = {
        title: 'Workflow Role Issue',
        description: 'There was a problem with a workflow role.',
        steps: [
          'Check your Stone configuration for correct role settings',
          'Verify the workflow is properly configured',
          'Try running with verbose logging: stone run --verbose'
        ]
      };
    } else {
      // Generic diagnosis
      diagnosis = {
        title: 'Workflow Error',
        description: `An error occurred during ${context.workflowType} workflow.`,
        steps: [
          'Check the error message: ' + errorMessage,
          'Run with verbose logging: stone run --verbose',
          'Check your GitHub token and permissions',
          'Try again after resolving the issue'
        ]
      };
    }
    
    return diagnosis;
  }

  /**
   * Get common errors and their solutions
   */
  public getCommonErrors(): CommonErrorPattern[] {
    return this.commonErrorPatterns;
  }
}