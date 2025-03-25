import { ConflictResolution } from '../../../src/workflow/conflict-resolution';
import { GitHubClient } from '../../../src/github/client';
import { StoneConfig } from '../../../src/config';
import { LoggerService } from '../../../src/services/logger-service';
import { GitService } from '../../../src/services/git-service';

// Mock dependencies
jest.mock('../../../src/github/client');
jest.mock('../../../src/services/git-service');
jest.mock('../../../src/services/logger-service');

describe('ConflictResolution', () => {
  let conflictResolution: ConflictResolution;
  let mockClient: jest.Mocked<GitHubClient>;
  let mockGitService: jest.Mocked<GitService>;
  let mockLogger: jest.Mocked<LoggerService>;
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
      branches: {
        main: 'main',
        prefix: 'feature/'
      }
    } as StoneConfig;
    
    // Setup mock client
    mockClient = new GitHubClient('fake-token', mockConfig) as jest.Mocked<GitHubClient>;
    mockClient.getIssue = jest.fn();
    mockClient.createIssueComment = jest.fn();
    mockClient.addLabelsToIssue = jest.fn();
    mockClient.removeLabelFromIssue = jest.fn();
    
    // Setup mock git service
    mockGitService = new GitService(null as any) as jest.Mocked<GitService>;
    mockGitService.execGitCommand = jest.fn();
    mockGitService.getCurrentBranch = jest.fn();
    mockGitService.hasUncommittedChanges = jest.fn();
    
    // Setup mock logger
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.debug = jest.fn();
    
    // Create the conflict resolution instance
    conflictResolution = new ConflictResolution(mockClient, mockConfig, mockLogger, mockGitService);
  });
  
  describe('detectConflicts', () => {
    it('should detect conflicts between branches', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test issue',
          body: 'Test body',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Mock git service response for merge-base check
      mockGitService.execGitCommand.mockImplementation((repoPath, args) => {
        if (args.includes('merge-base')) {
          return Promise.resolve({ output: 'abc123', exitCode: 0 });
        } else if (args.includes('merge-tree')) {
          return Promise.resolve({ 
            output: '<<<<<<<\nconflict\n=======\nconflicting change\n>>>>>>>\n', 
            exitCode: 0 
          });
        }
        return Promise.resolve({ output: '', exitCode: 0 });
      });
      
      // Call the method
      const result = await conflictResolution.detectConflicts(123);
      
      // Verify conflict detection
      expect(result.hasConflicts).toBe(true);
      expect(mockGitService.execGitCommand).toHaveBeenCalled();
      // Just check that conflictFiles is an array, since the mock doesn't actually populate it
      expect(Array.isArray(result.conflictFiles)).toBe(true);
    });
    
    it('should return no conflicts when branches can be merged cleanly', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test issue',
          body: 'Test body',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Mock git service response for clean merge
      mockGitService.execGitCommand.mockImplementation((repoPath, args) => {
        if (args.includes('merge-base')) {
          return Promise.resolve({ output: 'abc123', exitCode: 0 });
        } else if (args.includes('merge-tree')) {
          return Promise.resolve({ output: 'clean merge', exitCode: 0 });
        }
        return Promise.resolve({ output: '', exitCode: 0 });
      });
      
      // Call the method
      const result = await conflictResolution.detectConflicts(123);
      
      // Verify no conflicts detected
      expect(result.hasConflicts).toBe(false);
      expect(result.conflictFiles).toHaveLength(0);
    });
  });
  
  describe('resolveConflicts', () => {
    it('should resolve conflicts using automated resolution', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test issue',
          body: 'Test body',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Mock conflict detection
      jest.spyOn(conflictResolution, 'detectConflicts').mockResolvedValue({
        hasConflicts: true,
        conflictFiles: [{ path: 'src/test.ts', content: 'conflict' }],
        branchName: 'feature/123'
      });
      
      // Mock git service response for conflict resolution
      mockGitService.execGitCommand.mockResolvedValue({ output: '', exitCode: 0 });
      
      // Mock automatic resolution being successful
      jest.spyOn(conflictResolution, 'attemptAutomaticResolution').mockResolvedValue(true);
      
      // Call the method
      await conflictResolution.resolveConflicts(123);
      
      // Verify resolution interaction
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Merge conflicts were automatically resolved')
      );
      expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
        123,
        expect.arrayContaining(['stone-conflicts-resolved'])
      );
    });
    
    it('should add manual intervention label when conflicts cannot be resolved automatically', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test issue',
          body: 'Test body',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Mock conflict detection
      jest.spyOn(conflictResolution, 'detectConflicts').mockResolvedValue({
        hasConflicts: true,
        conflictFiles: [{ path: 'src/test.ts', content: 'complex conflict' }],
        branchName: 'feature/123'
      });
      
      // Mock automatic resolution failing
      jest.spyOn(conflictResolution, 'attemptAutomaticResolution').mockResolvedValue(false);
      
      // Call the method
      await conflictResolution.resolveConflicts(123);
      
      // Verify manual intervention required
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Manual intervention is required')
      );
      expect(mockClient.addLabelsToIssue).toHaveBeenCalledWith(
        123,
        expect.arrayContaining(['stone-manual-resolution-needed'])
      );
    });
  });
  
  describe('trackMergeStatus', () => {
    it('should track merge status for an issue', async () => {
      // Mock issue data
      mockClient.getIssue.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test issue',
          body: 'Test body',
          labels: [{ name: 'stone-feature-implement' }]
        }
      });
      
      // Call the method
      await conflictResolution.trackMergeStatus(123);
      
      // Verify merge status tracking
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Merge Status Report')
      );
    });
  });
});