import { ErrorRecoveryGuide, ErrorSolution, ErrorContext } from '../../../src/usability/error-recovery';
import { ConfigLoader } from '../../../src/config/loader';

jest.mock('../../../src/config/loader');

describe('Error Recovery Guide', () => {
  let errorRecovery: ErrorRecoveryGuide;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;

  beforeEach(() => {
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>;
    
    errorRecovery = new ErrorRecoveryGuide(mockConfigLoader);
  });

  describe('analyzeError', () => {
    it('should identify the type of error and return analysis', () => {
      const error = new Error('Authentication failed: Bad credentials');
      
      const analysis = errorRecovery.analyzeError(error);
      
      expect(analysis).toBeDefined();
      expect(analysis.errorType).toBe('authentication');
      expect(analysis.message).toContain('Authentication failed');
      expect(analysis.possibleCauses).toBeDefined();
      expect(analysis.possibleCauses.length).toBeGreaterThan(0);
    });
    
    it('should identify network errors', () => {
      const error = new Error('Failed to connect: Network error');
      
      const analysis = errorRecovery.analyzeError(error);
      
      expect(analysis.errorType).toBe('network');
    });
    
    it('should identify configuration errors', () => {
      const error = new Error('Invalid configuration: Missing repository owner');
      
      const analysis = errorRecovery.analyzeError(error);
      
      expect(analysis.errorType).toBe('configuration');
    });
    
    it('should identify permission errors', () => {
      const error = new Error('Permission denied: Insufficient access to repository');
      
      const analysis = errorRecovery.analyzeError(error);
      
      expect(analysis.errorType).toBe('permission');
    });
    
    it('should handle unknown errors', () => {
      const error = new Error('Something unexpected happened');
      
      const analysis = errorRecovery.analyzeError(error);
      
      expect(analysis.errorType).toBe('unknown');
      expect(analysis.possibleCauses).toBeDefined();
    });
  });

  describe('getSolutions', () => {
    it('should provide solutions for authentication errors', () => {
      const errorContext: ErrorContext = {
        errorType: 'authentication',
        message: 'Authentication failed: Bad credentials',
        possibleCauses: ['Invalid GitHub token', 'Token expired']
      };
      
      const solutions = errorRecovery.getSolutions(errorContext);
      
      expect(solutions).toBeDefined();
      expect(solutions.length).toBeGreaterThan(0);
      expect(solutions[0]).toHaveProperty('title');
      expect(solutions[0]).toHaveProperty('steps');
      expect(solutions[0].steps.length).toBeGreaterThan(0);
    });
    
    it('should provide solutions for configuration errors', () => {
      const errorContext: ErrorContext = {
        errorType: 'configuration',
        message: 'Invalid configuration: Missing repository owner',
        possibleCauses: ['Configuration file is missing or invalid']
      };
      
      const solutions = errorRecovery.getSolutions(errorContext);
      
      expect(solutions).toBeDefined();
      expect(solutions.length).toBeGreaterThan(0);
    });
    
    it('should provide solutions for network errors', () => {
      const errorContext: ErrorContext = {
        errorType: 'network',
        message: 'Failed to connect: Network error',
        possibleCauses: ['Internet connection issue', 'GitHub API is down']
      };
      
      const solutions = errorRecovery.getSolutions(errorContext);
      
      expect(solutions).toBeDefined();
      expect(solutions.length).toBeGreaterThan(0);
    });
    
    it('should provide generic solutions for unknown errors', () => {
      const errorContext: ErrorContext = {
        errorType: 'unknown',
        message: 'Something unexpected happened',
        possibleCauses: ['Unknown issue']
      };
      
      const solutions = errorRecovery.getSolutions(errorContext);
      
      expect(solutions).toBeDefined();
      expect(solutions.length).toBeGreaterThan(0);
    });
  });

  describe('formatErrorHelp', () => {
    it('should format error analysis and solutions in a readable way', () => {
      const errorContext: ErrorContext = {
        errorType: 'authentication',
        message: 'Authentication failed: Bad credentials',
        possibleCauses: ['Invalid GitHub token', 'Token expired']
      };
      
      const solutions: ErrorSolution[] = [
        {
          title: 'Regenerate GitHub token',
          steps: [
            'Go to GitHub Settings > Developer settings > Personal access tokens',
            'Create a new token with the required permissions',
            'Update your Stone configuration with the new token'
          ]
        }
      ];
      
      const helpText = errorRecovery.formatErrorHelp(errorContext, solutions);
      
      expect(helpText).toBeDefined();
      expect(helpText).toContain('ERROR:');
      expect(helpText).toContain('Authentication failed');
      expect(helpText).toContain('POSSIBLE CAUSES:');
      expect(helpText).toContain('SOLUTIONS:');
      expect(helpText).toContain('Regenerate GitHub token');
    });
  });

  describe('getRecoverySteps', () => {
    it('should analyze an error and return formatted recovery steps', () => {
      const error = new Error('Authentication failed: Bad credentials');
      
      const recoverySteps = errorRecovery.getRecoverySteps(error);
      
      expect(recoverySteps).toBeDefined();
      expect(recoverySteps).toContain('ERROR:');
      expect(recoverySteps).toContain('Authentication failed');
      expect(recoverySteps).toContain('SOLUTIONS:');
    });
  });

  describe('diagnoseDuringInit', () => {
    it('should diagnose errors during initialization', () => {
      const error = new Error('Failed to create directory structure');
      
      const diagnosis = errorRecovery.diagnoseDuringInit(error);
      
      expect(diagnosis).toBeDefined();
      expect(diagnosis.title).toBeDefined();
      expect(diagnosis.description).toBeDefined();
      expect(diagnosis.steps).toBeDefined();
      expect(diagnosis.steps.length).toBeGreaterThan(0);
    });
  });

  describe('diagnoseDuringWorkflow', () => {
    it('should diagnose errors during workflow execution', () => {
      const error = new Error('Failed to process issue #123');
      
      const diagnosis = errorRecovery.diagnoseDuringWorkflow(error, {
        workflowType: 'issue',
        issueNumber: 123
      });
      
      expect(diagnosis).toBeDefined();
      expect(diagnosis.title).toBeDefined();
      expect(diagnosis.description).toBeDefined();
      expect(diagnosis.steps).toBeDefined();
      expect(diagnosis.steps.length).toBeGreaterThan(0);
    });
  });

  describe('getCommonErrors', () => {
    it('should return a list of common errors and their solutions', () => {
      const commonErrors = errorRecovery.getCommonErrors();
      
      expect(commonErrors).toBeDefined();
      expect(commonErrors.length).toBeGreaterThan(0);
      expect(commonErrors[0]).toHaveProperty('errorPattern');
      expect(commonErrors[0]).toHaveProperty('errorType');
      expect(commonErrors[0]).toHaveProperty('solutions');
    });
  });
});