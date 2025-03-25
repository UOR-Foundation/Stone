import { expect } from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import { RepositoryOptimizer } from '../../../src/scalability/repository-optimizer';
import { GitService } from '../../../src/services/git-service';
import { FileSystemService } from '../../../src/services/filesystem-service';
import { LoggerService } from '../../../src/services/logger-service';

describe('RepositoryOptimizer', () => {
  let repositoryOptimizer: RepositoryOptimizer;
  let gitServiceStub: sinon.SinonStubbedInstance<GitService>;
  let fsServiceStub: sinon.SinonStubbedInstance<FileSystemService>;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    gitServiceStub = sinon.createStubInstance(GitService);
    fsServiceStub = sinon.createStubInstance(FileSystemService);
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };
    
    repositoryOptimizer = new RepositoryOptimizer(
      gitServiceStub,
      fsServiceStub,
      loggerStub
    );
  });

  describe('analyzeRepository', () => {
    it('should analyze a repository and return its statistics', async () => {
      // Stub git commands
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['count-objects', '-v']
      ).resolves({
        output: 'count: 1000\nsize: 500\nin-pack: 10000\nsize-pack: 5000',
        exitCode: 0
      });
      
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['rev-list', '--count', '--all']
      ).resolves({
        output: '1500',
        exitCode: 0
      });
      
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['ls-files', '|', 'wc', '-l']
      ).resolves({
        output: '3000',
        exitCode: 0
      });
      
      // Run analysis
      const repoPath = '/path/to/repo';
      const stats = await repositoryOptimizer.analyzeRepository(repoPath);
      
      expect(stats).to.be.an('object');
      expect(stats.objectCount).to.equal(11000); // 1000 + 10000
      expect(stats.sizeInKb).to.equal(5500); // 500 + 5000
      expect(stats.commitCount).to.equal(1500);
      expect(stats.fileCount).to.equal(3000);
      expect(stats.packRatio).to.be.closeTo(0.909, 0.001); // 10000 / 11000
    });

    it('should handle git command failures', async () => {
      gitServiceStub.execGitCommand.rejects(new Error('Git command failed'));
      
      try {
        await repositoryOptimizer.analyzeRepository('/path/to/repo');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to analyze repository');
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('optimizeRepository', () => {
    it('should perform repository optimization operations', async () => {
      // Stub git commands
      gitServiceStub.execGitCommand.resolves({
        output: 'Success',
        exitCode: 0
      });
      
      const repoPath = '/path/to/repo';
      const result = await repositoryOptimizer.optimizeRepository(repoPath);
      
      expect(result.success).to.be.true;
      expect(result.operations).to.include('git-gc');
      expect(result.operations).to.include('prune');
      
      // Check that the optimization commands were called
      expect(gitServiceStub.execGitCommand.calledWith(
        repoPath, ['gc', '--aggressive']
      )).to.be.true;
      
      expect(gitServiceStub.execGitCommand.calledWith(
        repoPath, ['prune']
      )).to.be.true;
    });

    it('should handle optimization failures', async () => {
      // Make one optimization step fail
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['gc', '--aggressive']
      ).rejects(new Error('GC failed'));
      
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['prune']
      ).resolves({
        output: 'Success',
        exitCode: 0
      });
      
      const result = await repositoryOptimizer.optimizeRepository('/path/to/repo');
      
      expect(result.success).to.be.false;
      expect(result.operations).to.not.include('git-gc');
      expect(result.operations).to.include('prune');
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0]).to.include('GC failed');
    });

    it('should apply custom optimization options', async () => {
      gitServiceStub.execGitCommand.resolves({
        output: 'Success',
        exitCode: 0
      });
      
      const options = {
        performGc: true,
        gcAggressive: false, // Regular GC, not aggressive
        prune: true,
        removeOldLogs: true
      };
      
      await repositoryOptimizer.optimizeRepository('/path/to/repo', options);
      
      // Check that options were respected
      expect(gitServiceStub.execGitCommand.calledWith(
        sinon.match.any, ['gc']
      )).to.be.true;
      
      expect(gitServiceStub.execGitCommand.calledWith(
        sinon.match.any, ['gc', '--aggressive']
      )).to.be.false;
    });
  });

  describe('setupSparseCheckout', () => {
    it('should set up sparse checkout for a repository', async () => {
      gitServiceStub.execGitCommand.resolves({
        output: 'Success',
        exitCode: 0
      });
      
      fsServiceStub.writeFile.resolves();
      
      const repoPath = '/path/to/repo';
      const patterns = ['src/', 'package.json', 'README.md'];
      
      const result = await repositoryOptimizer.setupSparseCheckout(repoPath, patterns);
      
      expect(result.success).to.be.true;
      
      // Check that sparse checkout was configured
      expect(gitServiceStub.execGitCommand.calledWith(
        repoPath, ['config', 'core.sparseCheckout', 'true']
      )).to.be.true;
      
      // Check that patterns were written to sparse checkout file
      expect(fsServiceStub.writeFile.calledOnce).to.be.true;
      const content = fsServiceStub.writeFile.firstCall.args[1];
      for (const pattern of patterns) {
        expect(content).to.include(pattern);
      }
    });

    it('should handle setup failures', async () => {
      gitServiceStub.execGitCommand.rejects(new Error('Sparse checkout failed'));
      
      try {
        await repositoryOptimizer.setupSparseCheckout('/path/to/repo', ['src/']);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to set up sparse checkout');
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });

    it('should handle pattern validation', async () => {
      gitServiceStub.execGitCommand.resolves({
        output: 'Success',
        exitCode: 0
      });
      
      fsServiceStub.writeFile.resolves();
      
      // Empty patterns should fail
      try {
        await repositoryOptimizer.setupSparseCheckout('/path/to/repo', []);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No patterns provided');
      }
    });
  });

  describe('getGitLFSStatus', () => {
    it('should return LFS status for a repository', async () => {
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['lfs', 'status']
      ).resolves({
        output: `
        Git LFS objects to be pushed to origin/main:
          file1.bin (10 MB)
          file2.bin (20 MB)
        
        Git LFS objects to be downloaded:
          file3.bin (30 MB)
        `,
        exitCode: 0
      });
      
      const status = await repositoryOptimizer.getGitLFSStatus('/path/to/repo');
      
      expect(status.enabled).to.be.true;
      expect(status.objectsToUpload).to.equal(2);
      expect(status.objectsToDownload).to.equal(1);
      expect(status.totalSizeMB).to.equal(60);
    });

    it('should handle repositories without LFS enabled', async () => {
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['lfs', 'status']
      ).rejects(new Error('git: \'lfs\' is not a git command'));
      
      const status = await repositoryOptimizer.getGitLFSStatus('/path/to/repo');
      
      expect(status.enabled).to.be.false;
      expect(status.objectsToUpload).to.equal(0);
      expect(status.objectsToDownload).to.equal(0);
    });
  });

  describe('setupGitLFS', () => {
    it('should set up Git LFS for specified file patterns', async () => {
      gitServiceStub.execGitCommand.resolves({
        output: 'Success',
        exitCode: 0
      });
      
      const repoPath = '/path/to/repo';
      const patterns = ['*.bin', '*.zip', '*.psd'];
      
      const result = await repositoryOptimizer.setupGitLFS(repoPath, patterns);
      
      expect(result.success).to.be.true;
      expect(result.patterns).to.deep.equal(patterns);
      
      // Check LFS install command
      expect(gitServiceStub.execGitCommand.calledWith(
        repoPath, ['lfs', 'install']
      )).to.be.true;
      
      // Check track commands for each pattern
      for (const pattern of patterns) {
        expect(gitServiceStub.execGitCommand.calledWith(
          repoPath, ['lfs', 'track', pattern]
        )).to.be.true;
      }
    });

    it('should handle LFS setup failures', async () => {
      gitServiceStub.execGitCommand.withArgs(
        sinon.match.any, 
        ['lfs', 'install']
      ).rejects(new Error('LFS install failed'));
      
      try {
        await repositoryOptimizer.setupGitLFS('/path/to/repo', ['*.bin']);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to set up Git LFS');
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('shouldUseShallowClone', () => {
    it('should recommend shallow clone for large repositories', async () => {
      // Stub a large repository
      sinon.stub(repositoryOptimizer, 'analyzeRepository').resolves({
        objectCount: 100000,
        sizeInKb: 1000000, // 1GB
        commitCount: 5000,
        fileCount: 10000,
        packRatio: 0.9
      });
      
      const result = await repositoryOptimizer.shouldUseShallowClone('/path/to/repo');
      
      expect(result.recommended).to.be.true;
      expect(result.recommendedDepth).to.be.a('number');
      expect(result.reason).to.include('large repository');
    });

    it('should not recommend shallow clone for small repositories', async () => {
      // Stub a small repository
      sinon.stub(repositoryOptimizer, 'analyzeRepository').resolves({
        objectCount: 1000,
        sizeInKb: 5000, // 5MB
        commitCount: 100,
        fileCount: 500,
        packRatio: 0.9
      });
      
      const result = await repositoryOptimizer.shouldUseShallowClone('/path/to/repo');
      
      expect(result.recommended).to.be.false;
    });

    it('should respect custom thresholds', async () => {
      // Stub a medium-sized repository
      sinon.stub(repositoryOptimizer, 'analyzeRepository').resolves({
        objectCount: 5000,
        sizeInKb: 20000, // 20MB
        commitCount: 500,
        fileCount: 2000,
        packRatio: 0.9
      });
      
      // With low thresholds, shallow clone should be recommended
      const resultWithLowThresholds = await repositoryOptimizer.shouldUseShallowClone(
        '/path/to/repo',
        { sizeThresholdKb: 10000, commitThreshold: 100 }
      );
      
      expect(resultWithLowThresholds.recommended).to.be.true;
      
      // With high thresholds, shallow clone should not be recommended
      const resultWithHighThresholds = await repositoryOptimizer.shouldUseShallowClone(
        '/path/to/repo',
        { sizeThresholdKb: 50000, commitThreshold: 1000 }
      );
      
      expect(resultWithHighThresholds.recommended).to.be.false;
    });
  });
});