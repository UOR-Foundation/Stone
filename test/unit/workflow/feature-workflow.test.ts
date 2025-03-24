import { FeatureWorkflow } from '../../../src/workflow/feature-workflow';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';

// Mock GitHub client
jest.mock('../../../src/github/client');

describe('FeatureWorkflow', () => {
  let featureWorkflow: FeatureWorkflow;
  let mockClient: jest.Mocked<GitHubClient>;
  let mockConfig: StoneConfig;
  
  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      repository: {
        owner: 'test-owner',
        name: 'test-repo',
      },
      workflow: {
        stoneLabel: 'stone-process',
        issueTemplate: 'feature_request.md',
      },
      github: {
        issueTemplateDirectory: '.github/ISSUE_TEMPLATE',
      },
      packages: [
        {
          name: 'core',
          path: 'src/core',
          team: 'core-team',
          dependencies: []
        },
        {
          name: 'auth',
          path: 'src/auth',
          team: 'auth-team',
          dependencies: ['core']
        },
        {
          name: 'api',
          path: 'src/api',
          team: 'api-team',
          dependencies: ['core', 'auth']
        }
      ]
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    
    // Create the workflow instance
    featureWorkflow = new FeatureWorkflow(mockClient, mockConfig);
  });
  
  describe('mapPackageForFeature', () => {
    it('should map a feature to the correct package', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Implement OAuth authentication',
          body: 'We need to implement OAuth with Google and GitHub',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Call the method
      const packageInfo = await featureWorkflow.mapPackageForFeature(1);
      
      // Verify package mapping
      expect(packageInfo.name).toBe('auth');
      expect(packageInfo.team).toBe('auth-team');
      expect(packageInfo.path).toBe('src/auth');
    });
  });
  
  describe('processImplementationRequest', () => {
    it('should process feature implementation request', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Implement OAuth authentication',
          body: 'We need to implement OAuth with Google and GitHub',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Mock comments containing test requirements
      mockClient.octokit = {
        rest: {
          issues: {
            listComments: jest.fn().mockResolvedValue({
              data: [{
                body: `## Test Requirements
                
                - Must implement Google OAuth
                - Must implement GitHub OAuth
                - Must handle authentication failures`
              }]
            })
          }
        }
      };
      
      // Call the method
      await featureWorkflow.processImplementationRequest(1);
      
      // Verify implementation request processing
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Implementation Plan')
      );
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('auth')
      );
    });
  });
  
  describe('trackDependencies', () => {
    it('should track dependencies between packages', async () => {
      // Define packages with dependencies
      const packageInfo = mockConfig.packages[1]; // Auth package with Core dependency
      
      // Call the method
      const dependencies = featureWorkflow.trackDependencies(packageInfo);
      
      // Verify dependency tracking
      expect(dependencies).toContain('core');
      expect(dependencies).toHaveLength(1);
    });
  });
  
  describe('trackImplementationStatus', () => {
    it('should track implementation status for a feature', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Implement OAuth authentication',
          body: 'We need to implement OAuth with Google and GitHub',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Set initial implementation status
      const initialStatus = {
        started: true,
        completed: false,
        progress: 30,
        tasks: [
          { description: 'Setup OAuth library', completed: true },
          { description: 'Implement Google OAuth', completed: false },
          { description: 'Implement GitHub OAuth', completed: false }
        ]
      };
      
      // Call the method
      await featureWorkflow.trackImplementationStatus(1, initialStatus);
      
      // Verify status tracking
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Implementation Status')
      );
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringMatching(/Progress: \d+% complete/)
      );
    });
  });
});