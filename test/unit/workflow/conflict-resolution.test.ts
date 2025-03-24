import { expect } from 'chai';
import sinon from 'sinon';
import { ConflictResolution } from '../../../src/workflow/conflict-resolution';
import { GitService } from '../../../src/services/git-service';
import { GithubService } from '../../../src/services/github-service';
import { LoggerService } from '../../../src/services/logger-service';

describe('ConflictResolution', () => {
  let conflictResolution: ConflictResolution;
  let gitServiceStub: sinon.SinonStubbedInstance<GitService>;
  let githubServiceStub: sinon.SinonStubbedInstance<GithubService>;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    gitServiceStub = sinon.createStubInstance(GitService);
    githubServiceStub = sinon.createStubInstance(GithubService);
    loggerStub = sinon.createStubInstance(LoggerService);

    conflictResolution = new ConflictResolution(
      gitServiceStub as unknown as GitService,
      githubServiceStub as unknown as GithubService,
      loggerStub as unknown as LoggerService
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('detectConflicts', () => {
    it('should detect conflicts in a PR', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.getPullRequest.resolves({
        number: prNumber,
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' }
      });
      
      gitServiceStub.checkMergeStatus.resolves({
        canMerge: false,
        conflictingFiles: ['src/file1.ts', 'src/file2.ts']
      });

      const result = await conflictResolution.detectConflicts(prNumber, repoOwner, repoName);

      expect(result.hasConflicts).to.be.true;
      expect(result.conflictingFiles).to.deep.equal(['src/file1.ts', 'src/file2.ts']);
      expect(githubServiceStub.getPullRequest.calledOnceWith(prNumber, repoOwner, repoName)).to.be.true;
      expect(gitServiceStub.checkMergeStatus.calledOnce).to.be.true;
    });

    it('should return no conflicts when PR can be merged', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.getPullRequest.resolves({
        number: prNumber,
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' }
      });
      
      gitServiceStub.checkMergeStatus.resolves({
        canMerge: true,
        conflictingFiles: []
      });

      const result = await conflictResolution.detectConflicts(prNumber, repoOwner, repoName);

      expect(result.hasConflicts).to.be.false;
      expect(result.conflictingFiles).to.be.empty;
    });

    it('should handle error during conflict detection', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      const errorMessage = 'Failed to check merge status';
      
      githubServiceStub.getPullRequest.resolves({
        number: prNumber,
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' }
      });
      
      gitServiceStub.checkMergeStatus.rejects(new Error(errorMessage));

      try {
        await conflictResolution.detectConflicts(prNumber, repoOwner, repoName);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('resolveConflicts', () => {
    it('should successfully resolve conflicts in a PR', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.getPullRequest.resolves({
        number: prNumber,
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' }
      });
      
      gitServiceStub.cloneRepository.resolves('/tmp/repo-clone');
      gitServiceStub.checkoutBranch.resolves();
      gitServiceStub.rebaseBranch.resolves();
      gitServiceStub.resolveConflicts.resolves({
        success: true,
        resolvedFiles: ['src/file1.ts', 'src/file2.ts']
      });
      gitServiceStub.pushChanges.resolves();

      const result = await conflictResolution.resolveConflicts(
        prNumber, 
        repoOwner, 
        repoName,
        ['src/file1.ts', 'src/file2.ts']
      );

      expect(result.success).to.be.true;
      expect(result.resolvedFiles).to.deep.equal(['src/file1.ts', 'src/file2.ts']);
      expect(gitServiceStub.cloneRepository.calledOnce).to.be.true;
      expect(gitServiceStub.checkoutBranch.calledOnce).to.be.true;
      expect(gitServiceStub.rebaseBranch.calledOnce).to.be.true;
      expect(gitServiceStub.resolveConflicts.calledOnce).to.be.true;
      expect(gitServiceStub.pushChanges.calledOnce).to.be.true;
      expect(githubServiceStub.updatePullRequest.calledOnce).to.be.true;
    });

    it('should handle failure to resolve conflicts', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.getPullRequest.resolves({
        number: prNumber,
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' }
      });
      
      gitServiceStub.cloneRepository.resolves('/tmp/repo-clone');
      gitServiceStub.checkoutBranch.resolves();
      gitServiceStub.rebaseBranch.resolves();
      gitServiceStub.resolveConflicts.resolves({
        success: false,
        resolvedFiles: [],
        error: 'Complex conflicts require manual resolution'
      });

      const result = await conflictResolution.resolveConflicts(
        prNumber, 
        repoOwner, 
        repoName,
        ['src/file1.ts', 'src/file2.ts']
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Complex conflicts');
      expect(githubServiceStub.commentOnPullRequest.calledOnce).to.be.true;
    });

    it('should handle errors during conflict resolution process', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      const errorMessage = 'Failed to clone repository';
      
      githubServiceStub.getPullRequest.resolves({
        number: prNumber,
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' }
      });
      
      gitServiceStub.cloneRepository.rejects(new Error(errorMessage));

      try {
        await conflictResolution.resolveConflicts(
          prNumber, 
          repoOwner, 
          repoName,
          ['src/file1.ts', 'src/file2.ts']
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
        expect(githubServiceStub.commentOnPullRequest.calledOnce).to.be.true;
      }
    });
  });

  describe('updatePRStatus', () => {
    it('should update PR status with resolution results', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      const resolutionResult = {
        success: true,
        resolvedFiles: ['src/file1.ts', 'src/file2.ts'],
        message: 'Successfully resolved conflicts'
      };

      await conflictResolution.updatePRStatus(prNumber, repoOwner, repoName, resolutionResult);

      expect(githubServiceStub.commentOnPullRequest.calledOnce).to.be.true;
      expect(githubServiceStub.updatePullRequest.calledOnce).to.be.true;
    });

    it('should update PR status with failure message when resolution fails', async () => {
      const prNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      const resolutionResult = {
        success: false,
        resolvedFiles: [],
        error: 'Failed to resolve conflicts due to complex changes'
      };

      await conflictResolution.updatePRStatus(prNumber, repoOwner, repoName, resolutionResult);

      expect(githubServiceStub.commentOnPullRequest.calledOnce).to.be.true;
      expect(githubServiceStub.addLabelToPullRequest.calledOnce).to.be.true;
    });
  });
});