import { AuditSystem } from '../../../src/workflow/audit-system';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';

// Mock GitHub client
jest.mock('../../../src/github/client');

describe('AuditSystem', () => {
  let auditSystem: AuditSystem;
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
      }],
      audit: {
        minCodeCoverage: 80,
        requiredReviewers: 1,
        maxComplexity: 20,
        qualityChecks: ['lint', 'types', 'tests']
      }
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    
    // Create the audit system instance
    auditSystem = new AuditSystem(mockClient, mockConfig);
  });
  
  describe('evaluateAuditCriteria', () => {
    it('should evaluate audit criteria for a feature', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Implement OAuth authentication',
          body: 'We need to implement OAuth with Google and GitHub',
          labels: [{ name: 'stone-audit' }]
        }
      });
      
      // Mock pull request for the issue
      mockClient.octokit = {
        rest: {
          issues: {
            listComments: jest.fn().mockResolvedValue({ data: [] })
          },
          search: {
            issuesAndPullRequests: jest.fn().mockResolvedValue({
              data: {
                items: [{
                  number: 10,
                  pull_request: { url: 'https://api.github.com/repos/test-owner/test-repo/pulls/10' }
                }]
              }
            })
          },
          pulls: {
            get: jest.fn().mockResolvedValue({
              data: {
                number: 10,
                head: { ref: 'feature-branch' },
                base: { ref: 'main' },
                title: 'Implement OAuth authentication',
                body: 'Closes #1',
                requested_reviewers: [{ login: 'reviewer1' }]
              }
            }),
            listFiles: jest.fn().mockResolvedValue({
              data: [
                { filename: 'src/auth/oauth.ts', additions: 100, deletions: 0, changes: 100 },
                { filename: 'test/unit/auth/oauth.test.ts', additions: 50, deletions: 0, changes: 50 }
              ]
            })
          }
        }
      };
      
      // Call the method
      const criteria = await auditSystem.evaluateAuditCriteria(1);
      
      // Verify audit criteria evaluation
      expect(criteria.codeCoverage).toBeGreaterThanOrEqual(0);
      expect(criteria.reviewersAssigned).toBeGreaterThanOrEqual(0);
      expect(criteria.complexityScore).toBeGreaterThanOrEqual(0);
      expect(criteria.hasUnitTests).toBeDefined();
    });
  });
  
  describe('verifyImplementation', () => {
    it('should verify implementation against requirements', async () => {
      // Mock the response for getIssue
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 1,
          title: 'Implement OAuth authentication',
          body: 'We need to implement OAuth with Google and GitHub',
          labels: [{ name: 'stone-audit' }]
        }
      });
      
      // Mock comments containing requirements
      mockClient.octokit = {
        rest: {
          issues: {
            listComments: jest.fn().mockResolvedValue({
              data: [{
                body: `## Gherkin Specification

Feature: OAuth Authentication
  Scenario: User logs in with Google
    Given the user has a Google account
    When they click "Sign in with Google"
    Then they should be authenticated successfully`
              }]
            })
          },
          search: {
            issuesAndPullRequests: jest.fn().mockResolvedValue({
              data: { items: [] }
            })
          }
        }
      };
      
      // Call the method
      const verification = await auditSystem.verifyImplementation(1);
      
      // Verify implementation verification
      expect(verification.success).toBeDefined();
      expect(verification.missingRequirements).toBeDefined();
    });
  });
  
  describe('validateCodeQuality', () => {
    it('should validate code quality for a pull request', async () => {
      // Mock pull request data
      const prData = {
        number: 10,
        head: { ref: 'feature-branch' },
        base: { ref: 'main' }
      };
      
      // Mock check runs for the PR
      mockClient.octokit = {
        rest: {
          checks: {
            listForRef: jest.fn().mockResolvedValue({
              data: {
                check_runs: [
                  { name: 'lint', conclusion: 'success' },
                  { name: 'typecheck', conclusion: 'success' },
                  { name: 'test', conclusion: 'success' }
                ]
              }
            })
          }
        }
      };
      
      // Call the method
      const quality = await auditSystem.validateCodeQuality(prData);
      
      // Verify code quality validation
      expect(quality.lintPassed).toBe(true);
      expect(quality.typesPassed).toBe(true);
      expect(quality.testsPassed).toBe(true);
    });
  });
  
  describe('processAuditResults', () => {
    it('should process audit results and provide recommendations', async () => {
      // Mock audit results
      const auditResults = {
        criteria: {
          codeCoverage: 85,
          reviewersAssigned: 1,
          complexityScore: 15,
          hasUnitTests: true
        },
        verification: {
          success: true,
          missingRequirements: []
        },
        quality: {
          lintPassed: true,
          typesPassed: true,
          testsPassed: true
        }
      };
      
      // Call the method
      await auditSystem.processAuditResults(1, auditResults);
      
      // Verify results processing
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringMatching(/Audit (Passed|Results)/)
      );
      expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
        1,
        expect.arrayContaining(['stone-ready-for-tests'])
      );
    });
    
    it('should handle failed audit results', async () => {
      // Mock failed audit results
      const auditResults = {
        criteria: {
          codeCoverage: 60, // Below minimum
          reviewersAssigned: 0, // Below minimum
          complexityScore: 25, // Above maximum
          hasUnitTests: false
        },
        verification: {
          success: false,
          missingRequirements: ['Google OAuth implementation']
        },
        quality: {
          lintPassed: false,
          typesPassed: false,
          testsPassed: false
        }
      };
      
      // Call the method
      await auditSystem.processAuditResults(1, auditResults);
      
      // Verify results processing for failure
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Audit Failed')
      );
      expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
        1,
        expect.arrayContaining(['stone-audit-failed'])
      );
    });
  });
});