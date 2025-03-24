import { TestFramework } from '../../../src/workflow/test-framework';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';

// Mock GitHub client
jest.mock('../../../src/github/client');

describe('TestFramework', () => {
  let testFramework: TestFramework;
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
      packages: [{
        name: 'core',
        path: 'src/core',
        team: 'core-team'
      }]
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    mockClient.getFileContent = jest.fn();
    
    // Create the framework instance
    testFramework = new TestFramework(mockClient, mockConfig);
  });
  
  describe('generateTestFile', () => {
    it('should generate a test file based on Gherkin specifications', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Add user authentication',
          body: 'Test body',
          labels: [{ name: 'stone-qa' }]
        }
      });
      
      // Mock issue comments to include Gherkin spec
      mockClient.octokit = {
        rest: {
          issues: {
            listComments: jest.fn().mockResolvedValue({
              data: [{
                body: `## Gherkin Specification

Feature: User Authentication
  Scenario: User logs in with valid credentials
    Given the user has an account
    When they enter valid username and password
    Then they should be logged in successfully`
              }]
            })
          }
        }
      };
      
      // Call the method
      await testFramework.generateTestFile(1);
      
      // Verify test file generation
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('import { describe, it, expect }')
      );
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Test File Generated')
      );
    });
  });
  
  describe('determineTestLocation', () => {
    it('should determine the correct test location based on feature', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Add user authentication',
          body: 'We need to add user authentication to the application',
          labels: [{ name: 'stone-qa' }]
        }
      });
      
      // Call the method
      const location = await testFramework.determineTestLocation(1);
      
      // Verify test location determination
      expect(location).toContain('test/');
      expect(location).toContain('authentication');
    });
  });
  
  describe('generateTestCommands', () => {
    it('should generate test run commands for the feature', async () => {
      // Call the method
      const commands = testFramework.generateTestCommands('test/unit/auth/login.test.ts');
      
      // Verify test command generation
      expect(commands).toContain('npm test');
      expect(commands).toContain('test/unit/auth/login.test.ts');
    });
  });
  
  describe('analyzeTestFailure', () => {
    it('should analyze test failures and provide feedback', async () => {
      const testOutput = `FAIL test/unit/auth/login.test.ts
      ● User Authentication › User logs in with valid credentials
        
        expect(received).toBe(expected)
        
        Expected: true
        Received: false
      `;
      
      // Call the method
      const analysis = testFramework.analyzeTestFailure(testOutput);
      
      // Verify test failure analysis
      expect(analysis.success).toBe(false);
      expect(analysis.message).toContain('test failed');
      expect(analysis.failedTests).toHaveLength(1);
    });
  });
});