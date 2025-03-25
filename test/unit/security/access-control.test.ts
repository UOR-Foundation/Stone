// Using Jest for testing
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
      
      expect(result).toBe(true);
      
      const role = accessControl.getRole('pm');
      expect(role).toBeDefined();
      expect(role.permissions.files.read).toContain('**/*.md');
      expect(role.permissions.files.read).toContain('!CLAUDE.md');
      expect(role.permissions.github.issues).toContain('read');
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
      
      expect(result).toBe(false);
      
      // Role should not be changed
      const role = accessControl.getRole('qa');
      expect(role.permissions.files.write).toContain('**/test/**/*.ts');
      expect(role.permissions.files.write).not.toContain('**/*');
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
      expect(accessControl.checkPermission('pm', 'files', 'read', 'README.md')).toBe(true);
      expect(accessControl.checkPermission('pm', 'files', 'read', 'docs/guide.md')).toBe(true);
      
      // PM can write to docs and README
      expect(accessControl.checkPermission('pm', 'files', 'write', 'docs/guide.md')).toBe(true);
      expect(accessControl.checkPermission('pm', 'files', 'write', 'README.md')).toBe(true);
      
      // Feature team can read TS files
      expect(accessControl.checkPermission('feature', 'files', 'read', 'src/index.ts')).toBe(true);
      
      // Feature team can write to src files
      expect(accessControl.checkPermission('feature', 'files', 'write', 'src/utils/helper.ts')).toBe(true);
    });

    it('should deny unpermitted file operations', () => {
      // PM cannot read CLAUDE.md
      expect(accessControl.checkPermission('pm', 'files', 'read', 'CLAUDE.md')).toBe(false);
      
      // PM cannot write to source files
      expect(accessControl.checkPermission('pm', 'files', 'write', 'src/index.ts')).toBe(false);
      
      // Feature team cannot write to claude files
      expect(accessControl.checkPermission('feature', 'files', 'write', 'src/claude/generator.ts')).toBe(false);
    });

    it('should check GitHub permissions correctly', () => {
      // PM can perform all issue operations
      expect(accessControl.checkPermission('pm', 'github', 'issues', 'read')).toBe(true);
      expect(accessControl.checkPermission('pm', 'github', 'issues', 'write')).toBe(true);
      expect(accessControl.checkPermission('pm', 'github', 'issues', 'comment')).toBe(true);
      
      // PM cannot write to branches
      expect(accessControl.checkPermission('pm', 'github', 'branches', 'write')).toBe(false);
      
      // Feature team can read but not write issues
      expect(accessControl.checkPermission('feature', 'github', 'issues', 'read')).toBe(true);
      expect(accessControl.checkPermission('feature', 'github', 'issues', 'write')).toBe(false);
      
      // Feature team can write to branches
      expect(accessControl.checkPermission('feature', 'github', 'branches', 'write')).toBe(true);
    });

    it('should check workflow permissions correctly', () => {
      // PM can execute pm workflows
      expect(accessControl.checkPermission('pm', 'workflow', 'execute', 'pm')).toBe(true);
      expect(accessControl.checkPermission('pm', 'workflow', 'execute', 'docs')).toBe(true);
      
      // PM cannot execute feature workflows
      expect(accessControl.checkPermission('pm', 'workflow', 'execute', 'feature')).toBe(false);
      
      // Feature team can execute feature workflows
      expect(accessControl.checkPermission('feature', 'workflow', 'execute', 'feature')).toBe(true);
      expect(accessControl.checkPermission('feature', 'workflow', 'execute', 'implement')).toBe(true);
      
      // Feature team cannot execute PM workflows
      expect(accessControl.checkPermission('feature', 'workflow', 'execute', 'pm')).toBe(false);
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
      
      expect(permissions).toBeInstanceOf(Object);
      expect(permissions.files.read).toEqual(['**/*.md', '!CLAUDE.md']);
      expect(permissions.github.issues).toEqual(['read', 'write', 'comment']);
      expect(permissions.workflow.execute).toEqual(['pm', 'docs']);
    });

    it('should return null for non-existent role', () => {
      const permissions = accessControl.getEffectivePermissions('nonexistent');
      expect(permissions).toBeNull();
    });
  });
});