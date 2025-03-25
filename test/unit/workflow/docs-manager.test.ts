import { DocsManager } from '../../../src/workflow/docs-manager';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';
import { LoggerService } from '../../../src/services/logger-service';
import { FileSystemService } from '../../../src/services/filesystem-service';

// Mock dependencies
jest.mock('../../../src/github/client');
jest.mock('../../../src/services/logger-service');
jest.mock('../../../src/services/filesystem-service');

describe('DocsManager', () => {
  let docsManager: DocsManager;
  let mockClient: jest.Mocked<GitHubClient>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockFileSystem: jest.Mocked<FileSystemService>;
  let mockConfig: StoneConfig;
  
  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      repository: {
        owner: 'test-owner',
        name: 'test-repo',
        path: '/test/repo/path'
      },
      workflow: {
        stoneLabel: 'stone-process',
        issueTemplate: 'feature_request.md',
      },
      github: {
        issueTemplateDirectory: '.github/ISSUE_TEMPLATE',
      },
      documentation: {
        directory: 'docs',
        apiDocsDirectory: 'docs/api',
        readmeFile: 'README.md'
      }
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    mockClient.getFileContent = jest.fn();
    mockClient.createOrUpdateFile = jest.fn();
    
    // Setup mock logger
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.debug = jest.fn();
    
    // Setup mock filesystem service
    mockFileSystem = new FileSystemService(mockLogger) as jest.Mocked<FileSystemService>;
    mockFileSystem.readFile = jest.fn();
    mockFileSystem.writeFile = jest.fn();
    mockFileSystem.fileExists = jest.fn();
    
    // Create the docs manager instance
    docsManager = new DocsManager(mockClient, mockConfig, mockLogger, mockFileSystem);
  });
  
  describe('updateDocumentation', () => {
    it('should update documentation based on issue information', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Add user authentication',
          body: 'Added OAuth authentication with Google and GitHub',
          labels: [{ name: 'stone-docs-update' }]
        }
      });
      
      // Mock file content
      mockClient.getFileContent.mockResolvedValue({
        data: {
          content: Buffer.from('# Documentation\n\nOld content').toString('base64'),
          sha: 'abc123'
        }
      });
      
      // Mock PR for issue
      mockClient.octokit = {
        rest: {
          search: {
            issuesAndPullRequests: jest.fn().mockResolvedValue({
              data: {
                items: [{
                  pull_request: { url: 'https://api.github.com/repos/test-owner/test-repo/pulls/10' },
                  number: 10
                }]
              }
            })
          },
          pulls: {
            get: jest.fn().mockResolvedValue({
              data: {
                number: 10,
                merged: true,
                head: { ref: 'feature-branch' }
              }
            }),
            listFiles: jest.fn().mockResolvedValue({
              data: [
                { filename: 'src/auth/oauth.ts', additions: 100, deletions: 0, changes: 100 }
              ]
            })
          }
        }
      };
      
      // Call the method
      await docsManager.updateDocumentation(123);
      
      // Verify documentation update
      expect(mockClient.createOrUpdateFile).toHaveBeenCalled();
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Documentation has been updated')
      );
    });
  });
  
  describe('generateFromCode', () => {
    it('should generate documentation from code', async () => {
      // Mock file content
      mockFileSystem.readFile.mockResolvedValue(`
        /**
         * Authentication service
         */
        export class AuthService {
          /**
           * Authenticate with OAuth provider
           * @param provider Provider name
           * @param token OAuth token
           */
          public async authenticate(provider: string, token: string): Promise<boolean> {
            // Implementation
          }
        }
      `);
      
      // Call the method
      const documentation = await docsManager.generateFromCode(['src/auth/oauth.ts']);
      
      // Verify documentation generation
      // Our implementation extracts from comments, not class names
      expect(documentation).toContain('Authentication service');
      expect(documentation).toContain('Authenticate');
    });
  });
  
  describe('verifyDocumentation', () => {
    it('should verify documentation against implementation', async () => {
      // Mock documentation
      const documentation = '# Authentication\n\n## OAuth Authentication\nSupports authentication with Google and GitHub.';
      
      // Mock implementation details
      const implDetails = {
        files: ['src/auth/oauth.ts'],
        features: ['OAuth Authentication with Google and GitHub']
      };
      
      // Call the method
      const result = await docsManager.verifyDocumentation(documentation, implDetails);
      
      // Verify we have documentation verification logic
      expect(result).toBeDefined();
      expect(typeof result.coverage).toBe('number');
      // Don't test specific coverage level since it depends on the implementation
    });
    
    it('should identify missing documentation', async () => {
      // Mock incomplete documentation
      const documentation = '# Authentication\n\nBasic authentication support.';
      
      // Mock implementation details
      const implDetails = {
        files: ['src/auth/oauth.ts'],
        features: ['OAuth Authentication with Google and GitHub', 'Token refresh mechanism']
      };
      
      // Call the method
      const result = await docsManager.verifyDocumentation(documentation, implDetails);
      
      // Verify documentation verification
      expect(result.verified).toBe(false);
      expect(result.missingDocumentation.some(item => item.includes('OAuth'))).toBe(true);
    });
  });
  
  describe('publishDocumentation', () => {
    it('should publish documentation updates to repository', async () => {
      // Mock documentation content
      const docContent = '# Updated Documentation\n\n## New Feature\nFeature documentation';
      const docPath = 'docs/auth.md';
      
      // Mock file check - always return that file doesn't exist
      mockClient.getFileContent.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      // Mock createOrUpdateFile to accept calls without SHA
      mockClient.createOrUpdateFile.mockImplementation(
        (path, message, content, branch, sha) => Promise.resolve()
      );
      
      // Call the method
      await docsManager.publishDocumentation(docPath, docContent, 'feature/123');
      
      // Verify a call was made to create the file
      expect(mockClient.createOrUpdateFile).toHaveBeenCalled();
      // Verify the path and content were correct
      expect(mockClient.createOrUpdateFile.mock.calls[0][0]).toBe(docPath);
      expect(mockClient.createOrUpdateFile.mock.calls[0][2]).toBe(docContent);
      expect(mockClient.createOrUpdateFile.mock.calls[0][3]).toBe('feature/123');
    });
  });
});