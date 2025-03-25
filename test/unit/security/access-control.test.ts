import { expect } from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import { AccessControlManager } from '../../../src/security/access-control';
import { LoggerService } from '../../../src/services/logger-service';

describe('AccessControlManager', () => {
  let accessControl: AccessControlManager;
  let loggerStub: sinon.SinonStubbedInstance<LoggerService>;

  beforeEach(() => {
    loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };

    accessControl = new AccessControlManager(loggerStub);
  });

  describe('defineRole', () => {
    it('should define a new role with permissions', () => {
      const result = accessControl.defineRole('pm', {
        files: {
          read: ['**/*.md', '!CLAUDE.md'],
          write: ['**/docs/**/*.md', 'README.md']
        },
        github: {
          issues: ['read', 'write', 'comment'],
          pullRequests: ['read', 'write', 'comment'],
          branches: ['read']
        },
        workflow: {
          execute: ['pm', 'docs']
        }
      });
      
      expect(result).to.be.true;
      
      const role = accessControl.getRole('pm');
      expect(role).to.exist;
      expect(role.permissions.files.read).to.include('**/*.md');
      expect(role.permissions.files.read).to.include('!CLAUDE.md');
      expect(role.permissions.github.issues).to.include('read');
    });

    it('should not allow redefining an existing role', () => {
      // First definition should succeed
      accessControl.defineRole('qa', {
        files: {
          read: ['**/*.ts', '**/*.js'],
          write: ['**/test/**/*.ts']
        },
        github: {
          issues: ['read', 'comment'],
          pullRequests: ['read', 'comment'],
          branches: ['read']
        },
        workflow: {
          execute: ['qa', 'test']
        }
      });
      
      // Second definition should fail
      const result = accessControl.defineRole('qa', {
        files: {
          read: ['**/*'],
          write: ['**/*']
        },
        github: {
          issues: ['read', 'write', 'comment'],
          pullRequests: ['read', 'write', 'comment'],
          branches: ['read', 'write']
        },
        workflow: {
          execute: ['*']
        }
      });
      
      expect(result).to.be.false;
      
      // Role should not be changed
      const role = accessControl.getRole('qa');
      expect(role.permissions.files.write).to.include('**/test/**/*.ts');
      expect(role.permissions.files.write).to.not.include('**/*');
    });
  });

  describe('checkPermission', () => {
    beforeEach(() => {
      // Set up roles
      accessControl.defineRole('pm', {
        files: {
          read: ['**/*.md', '!CLAUDE.md'],
          write: ['**/docs/**/*.md', 'README.md']
        },
        github: {
          issues: ['read', 'write', 'comment'],
          pullRequests: ['read', 'write', 'comment'],
          branches: ['read']
        },
        workflow: {
          execute: ['pm', 'docs']
        }
      });
      
      accessControl.defineRole('feature', {
        files: {
          read: ['**/*.ts', '**/*.js', '**/*.json'],
          write: ['**/src/**/*.ts', '**/src/**/*.js', '!**/src/claude/**']
        },
        github: {
          issues: ['read', 'comment'],
          pullRequests: ['read', 'comment'],
          branches: ['read', 'write']
        },
        workflow: {
          execute: ['feature', 'implement']
        }
      });
    });

    it('should allow permitted file operations', () => {
      // PM can read markdown files
      expect(accessControl.checkPermission('pm', 'files', 'read', 'README.md')).to.be.true;
      expect(accessControl.checkPermission('pm', 'files', 'read', 'docs/guide.md')).to.be.true;
      
      // PM can write to docs and README
      expect(accessControl.checkPermission('pm', 'files', 'write', 'docs/guide.md')).to.be.true;
      expect(accessControl.checkPermission('pm', 'files', 'write', 'README.md')).to.be.true;
      
      // Feature team can read TS files
      expect(accessControl.checkPermission('feature', 'files', 'read', 'src/index.ts')).to.be.true;
      
      // Feature team can write to src files
      expect(accessControl.checkPermission('feature', 'files', 'write', 'src/utils/helper.ts')).to.be.true;
    });

    it('should deny unpermitted file operations', () => {
      // PM cannot read CLAUDE.md
      expect(accessControl.checkPermission('pm', 'files', 'read', 'CLAUDE.md')).to.be.false;
      
      // PM cannot write to source files
      expect(accessControl.checkPermission('pm', 'files', 'write', 'src/index.ts')).to.be.false;
      
      // Feature team cannot write to claude files
      expect(accessControl.checkPermission('feature', 'files', 'write', 'src/claude/generator.ts')).to.be.false;
    });

    it('should check GitHub permissions correctly', () => {
      // PM can perform all issue operations
      expect(accessControl.checkPermission('pm', 'github', 'issues', 'read')).to.be.true;
      expect(accessControl.checkPermission('pm', 'github', 'issues', 'write')).to.be.true;
      expect(accessControl.checkPermission('pm', 'github', 'issues', 'comment')).to.be.true;
      
      // PM cannot write to branches
      expect(accessControl.checkPermission('pm', 'github', 'branches', 'write')).to.be.false;
      
      // Feature team can read but not write issues
      expect(accessControl.checkPermission('feature', 'github', 'issues', 'read')).to.be.true;
      expect(accessControl.checkPermission('feature', 'github', 'issues', 'write')).to.be.false;
      
      // Feature team can write to branches
      expect(accessControl.checkPermission('feature', 'github', 'branches', 'write')).to.be.true;
    });

    it('should check workflow permissions correctly', () => {
      // PM can execute pm workflows
      expect(accessControl.checkPermission('pm', 'workflow', 'execute', 'pm')).to.be.true;
      expect(accessControl.checkPermission('pm', 'workflow', 'execute', 'docs')).to.be.true;
      
      // PM cannot execute feature workflows
      expect(accessControl.checkPermission('pm', 'workflow', 'execute', 'feature')).to.be.false;
      
      // Feature team can execute feature workflows
      expect(accessControl.checkPermission('feature', 'workflow', 'execute', 'feature')).to.be.true;
      expect(accessControl.checkPermission('feature', 'workflow', 'execute', 'implement')).to.be.true;
      
      // Feature team cannot execute PM workflows
      expect(accessControl.checkPermission('feature', 'workflow', 'execute', 'pm')).to.be.false;
    });
  });

  describe('getEffectivePermissions', () => {
    beforeEach(() => {
      // Set up roles
      accessControl.defineRole('pm', {
        files: {
          read: ['**/*.md', '!CLAUDE.md'],
          write: ['**/docs/**/*.md', 'README.md']
        },
        github: {
          issues: ['read', 'write', 'comment'],
          pullRequests: ['read', 'write', 'comment'],
          branches: ['read']
        },
        workflow: {
          execute: ['pm', 'docs']
        }
      });
    });

    it('should return effective permissions for a role', () => {
      const permissions = accessControl.getEffectivePermissions('pm');
      
      expect(permissions).to.be.an('object');
      expect(permissions.files.read).to.deep.equal(['**/*.md', '!CLAUDE.md']);
      expect(permissions.github.issues).to.deep.equal(['read', 'write', 'comment']);
      expect(permissions.workflow.execute).to.deep.equal(['pm', 'docs']);
    });

    it('should return null for non-existent role', () => {
      const permissions = accessControl.getEffectivePermissions('nonexistent');
      expect(permissions).to.be.null;
    });
  });
});