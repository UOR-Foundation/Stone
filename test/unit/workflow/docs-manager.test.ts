import { expect } from 'chai';
import sinon from 'sinon';
import { DocumentationManager } from '../../../src/workflow/docs-manager';
import { FileSystemService } from '../../../src/services/filesystem-service';
import { GithubService } from '../../../src/services/github-service';
import { LoggerService } from '../../../src/services/logger-service';

describe('DocumentationManager', () => {
  let docsManager: DocumentationManager;
  let fsServiceStub: sinon.SinonStubbedInstance<FileSystemService>;
  let githubServiceStub: sinon.SinonStubbedInstance<GithubService>;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    fsServiceStub = sinon.createStubInstance(FileSystemService);
    githubServiceStub = sinon.createStubInstance(GithubService);
    loggerStub = sinon.createStubInstance(LoggerService);

    docsManager = new DocumentationManager(
      fsServiceStub as unknown as FileSystemService,
      githubServiceStub as unknown as GithubService,
      loggerStub as unknown as LoggerService
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('generateDocumentation', () => {
    it('should extract and generate documentation from source code', async () => {
      const packagePath = '/packages/package1';
      const srcPath = '/packages/package1/src';
      const outputPath = '/packages/package1/docs';
      
      fsServiceStub.findFiles.withArgs(`${srcPath}/**/*.ts`).resolves([
        `${srcPath}/index.ts`,
        `${srcPath}/models/user.ts`,
        `${srcPath}/services/auth.ts`,
      ]);
      
      fsServiceStub.readFile.withArgs(`${srcPath}/index.ts`).resolves(`
        /**
         * @module Package1
         * @description Main module for Package1 functionality
         */

        export * from './models/user';
        export * from './services/auth';
      `);
      
      fsServiceStub.readFile.withArgs(`${srcPath}/models/user.ts`).resolves(`
        /**
         * @interface User
         * @description Represents a user in the system
         */
        export interface User {
          id: string;
          name: string;
          email: string;
        }
      `);
      
      fsServiceStub.readFile.withArgs(`${srcPath}/services/auth.ts`).resolves(`
        /**
         * @class AuthService
         * @description Handles authentication operations
         */
        export class AuthService {
          /**
           * @method login
           * @description Authenticates a user
           * @param {string} username - The username
           * @param {string} password - The password
           * @returns {Promise<boolean>} Success status
           */
          async login(username: string, password: string): Promise<boolean> {
            // Implementation
            return true;
          }
        }
      `);
      
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.writeFile.resolves();

      const result = await docsManager.generateDocumentation(packagePath);

      expect(result.success).to.be.true;
      expect(result.generatedFiles).to.be.an('array').that.is.not.empty;
      expect(fsServiceStub.findFiles.calledWith(`${srcPath}/**/*.ts`)).to.be.true;
      expect(fsServiceStub.readFile.calledThrice).to.be.true;
      expect(fsServiceStub.ensureDirectoryExists.calledWith(outputPath)).to.be.true;
      expect(fsServiceStub.writeFile.callCount).to.be.at.least(1);
    });

    it('should handle files with no documentation', async () => {
      const packagePath = '/packages/package1';
      const srcPath = '/packages/package1/src';
      
      fsServiceStub.findFiles.withArgs(`${srcPath}/**/*.ts`).resolves([
        `${srcPath}/empty.ts`,
      ]);
      
      fsServiceStub.readFile.withArgs(`${srcPath}/empty.ts`).resolves(`
        // No JSDoc comments here
        export const value = 42;
      `);
      
      fsServiceStub.ensureDirectoryExists.resolves();
      fsServiceStub.writeFile.resolves();

      const result = await docsManager.generateDocumentation(packagePath);

      expect(result.success).to.be.true;
      expect(result.generatedFiles).to.be.an('array');
      expect(result.warnings).to.include('No documentation found');
    });

    it('should handle errors during documentation generation', async () => {
      const packagePath = '/packages/package1';
      const srcPath = '/packages/package1/src';
      const errorMessage = 'Failed to read source files';
      
      fsServiceStub.findFiles.withArgs(`${srcPath}/**/*.ts`).rejects(new Error(errorMessage));

      try {
        await docsManager.generateDocumentation(packagePath);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('verifyDocumentation', () => {
    it('should verify that documentation meets requirements', async () => {
      const packagePath = '/packages/package1';
      const docsPath = '/packages/package1/docs';
      
      fsServiceStub.findFiles.withArgs(`${docsPath}/**/*.md`).resolves([
        `${docsPath}/index.md`,
        `${docsPath}/models.md`,
        `${docsPath}/services.md`,
      ]);
      
      fsServiceStub.readFile.withArgs(`${docsPath}/index.md`).resolves(`
        # Package1 Documentation
        
        This is the main documentation for Package1.
        
        ## Installation
        
        \`\`\`bash
        npm install @example/package1
        \`\`\`
        
        ## Usage
        
        \`\`\`typescript
        import { User, AuthService } from '@example/package1';
        \`\`\`
      `);
      
      fsServiceStub.readFile.withArgs(`${docsPath}/models.md`).resolves(`
        # Models
        
        ## User
        
        Represents a user in the system.
        
        | Property | Type | Description |
        |----------|------|-------------|
        | id | string | Unique identifier |
        | name | string | User's name |
        | email | string | User's email |
      `);
      
      fsServiceStub.readFile.withArgs(`${docsPath}/services.md`).resolves(`
        # Services
        
        ## AuthService
        
        Handles authentication operations.
        
        ### Methods
        
        #### login(username: string, password: string): Promise<boolean>
        
        Authenticates a user with the provided credentials.
        
        - **username**: The username
        - **password**: The password
        - **Returns**: Promise resolving to login success status
      `);

      const requiredSections = ['Installation', 'Usage'];
      const result = await docsManager.verifyDocumentation(packagePath, requiredSections);

      expect(result.isComplete).to.be.true;
      expect(result.missingElements).to.be.empty;
      expect(fsServiceStub.findFiles.calledWith(`${docsPath}/**/*.md`)).to.be.true;
      expect(fsServiceStub.readFile.calledThrice).to.be.true;
    });

    it('should identify missing required documentation sections', async () => {
      const packagePath = '/packages/package1';
      const docsPath = '/packages/package1/docs';
      
      fsServiceStub.findFiles.withArgs(`${docsPath}/**/*.md`).resolves([
        `${docsPath}/index.md`,
      ]);
      
      fsServiceStub.readFile.withArgs(`${docsPath}/index.md`).resolves(`
        # Package1 Documentation
        
        This is the main documentation for Package1.
        
        ## Usage
        
        \`\`\`typescript
        import { User, AuthService } from '@example/package1';
        \`\`\`
      `);

      const requiredSections = ['Installation', 'Usage', 'API Reference', 'Examples'];
      const result = await docsManager.verifyDocumentation(packagePath, requiredSections);

      expect(result.isComplete).to.be.false;
      expect(result.missingElements).to.include('Installation');
      expect(result.missingElements).to.include('API Reference');
      expect(result.missingElements).to.include('Examples');
    });

    it('should handle missing documentation files', async () => {
      const packagePath = '/packages/package1';
      const docsPath = '/packages/package1/docs';
      
      fsServiceStub.findFiles.withArgs(`${docsPath}/**/*.md`).resolves([]);

      const requiredSections = ['Installation', 'Usage'];
      const result = await docsManager.verifyDocumentation(packagePath, requiredSections);

      expect(result.isComplete).to.be.false;
      expect(result.missingElements).to.include('All documentation files');
    });

    it('should handle errors during documentation verification', async () => {
      const packagePath = '/packages/package1';
      const docsPath = '/packages/package1/docs';
      const errorMessage = 'Failed to read documentation files';
      
      fsServiceStub.findFiles.withArgs(`${docsPath}/**/*.md`).rejects(new Error(errorMessage));

      try {
        await docsManager.verifyDocumentation(packagePath, ['Installation', 'Usage']);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });

  describe('createDocumentationPR', () => {
    it('should create a PR with documentation changes', async () => {
      const packageName = 'package1';
      const docsPath = '/packages/package1/docs';
      const generatedFiles = [
        `${docsPath}/index.md`,
        `${docsPath}/models.md`,
        `${docsPath}/services.md`,
      ];
      const issueNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      
      githubServiceStub.createBranch.resolves('docs/package1-update');
      githubServiceStub.commitFiles.resolves('abc123');
      githubServiceStub.createPullRequest.resolves({ number: 456 });

      const result = await docsManager.createDocumentationPR(
        packageName,
        generatedFiles,
        issueNumber,
        repoOwner,
        repoName
      );

      expect(result.success).to.be.true;
      expect(result.prNumber).to.equal(456);
      expect(githubServiceStub.createBranch.calledOnce).to.be.true;
      expect(githubServiceStub.commitFiles.calledOnce).to.be.true;
      expect(githubServiceStub.createPullRequest.calledOnce).to.be.true;
    });

    it('should handle errors during PR creation', async () => {
      const packageName = 'package1';
      const docsPath = '/packages/package1/docs';
      const generatedFiles = [
        `${docsPath}/index.md`,
        `${docsPath}/models.md`,
        `${docsPath}/services.md`,
      ];
      const issueNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';
      const errorMessage = 'Failed to create branch';
      
      githubServiceStub.createBranch.rejects(new Error(errorMessage));

      try {
        await docsManager.createDocumentationPR(
          packageName,
          generatedFiles,
          issueNumber,
          repoOwner,
          repoName
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include(errorMessage);
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });

    it('should handle empty file list', async () => {
      const packageName = 'package1';
      const generatedFiles: string[] = [];
      const issueNumber = 123;
      const repoOwner = 'owner';
      const repoName = 'repo';

      try {
        await docsManager.createDocumentationPR(
          packageName,
          generatedFiles,
          issueNumber,
          repoOwner,
          repoName
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('No documentation files');
        expect(loggerStub.error.calledOnce).to.be.true;
      }
    });
  });
});