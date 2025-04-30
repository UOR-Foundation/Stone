import { RBAC } from '../../../src/security/rbac';
import { LoggerService } from '../../../src/services/logger-service';
import { RolePermissions } from '../../../src/security/access-control';

jest.mock('../../../src/services/logger-service');

describe('RBAC', () => {
  let rbac: RBAC;
  let logger: jest.Mocked<LoggerService>;
  
  beforeEach(() => {
    logger = new LoggerService() as jest.Mocked<LoggerService>;
    rbac = new RBAC(logger);
    
    const developerPermissions: RolePermissions = {
      files: {
        read: ['**/*.ts', '**/*.js', '**/*.json', '!**/secrets/**'],
        write: ['src/**/*.ts', 'src/**/*.js', '!src/security/**', '!**/secrets/**']
      },
      github: {
        issues: ['read', 'comment'],
        pullRequests: ['read', 'create', 'comment'],
        branches: ['create']
      },
      workflow: {
        execute: ['build', 'test']
      }
    };
    
    const securityPermissions: RolePermissions = {
      files: {
        read: ['**/*.ts', '**/*.js', '**/*.json'],
        write: ['src/security/**/*.ts', 'src/security/**/*.js']
      },
      github: {
        issues: ['read', 'comment', 'close'],
        pullRequests: ['read', 'review', 'comment'],
        branches: ['create']
      },
      workflow: {
        execute: ['security-scan', 'test']
      }
    };
    
    rbac.defineRole('developer', developerPermissions);
    rbac.defineRole('security', securityPermissions);
  });
  
  describe('checkDiffPermissions', () => {
    it('should correctly identify allowed and denied files for a role', () => {
      const fileDiffs = [
        'src/app.ts',
        'src/security/auth.ts',
        'src/utils/helpers.ts',
        'secrets/keys.json'
      ];
      
      const result = rbac.checkDiffPermissions('developer', fileDiffs);
      
      expect(result.allowed).toContain('src/app.ts');
      expect(result.allowed).toContain('src/utils/helpers.ts');
      expect(result.denied).toContain('src/security/auth.ts');
      expect(result.denied).toContain('secrets/keys.json');
    });
    
    it('should handle non-existent roles', () => {
      const fileDiffs = ['src/app.ts'];
      const result = rbac.checkDiffPermissions('non-existent-role', fileDiffs);
      
      expect(result.allowed).toHaveLength(0);
      expect(result.denied).toHaveLength(1);
    });
  });
  
  describe('canModifyAllFiles', () => {
    it('should return true when all files are allowed', () => {
      const fileDiffs = ['src/app.ts', 'src/utils/helpers.ts'];
      const result = rbac.canModifyAllFiles('developer', fileDiffs);
      
      expect(result).toBe(true);
    });
    
    it('should return false when some files are denied', () => {
      const fileDiffs = ['src/app.ts', 'src/security/auth.ts'];
      const result = rbac.canModifyAllFiles('developer', fileDiffs);
      
      expect(result).toBe(false);
    });
  });
  
  describe('loadConfig', () => {
    it('should load roles from configuration', () => {
      const config = {
        roles: {
          admin: {
            files: {
              read: ['**/*'],
              write: ['**/*']
            },
            github: {
              issues: ['read', 'write', 'close'],
              pullRequests: ['read', 'write', 'merge'],
              branches: ['create', 'delete']
            },
            workflow: {
              execute: ['**/*']
            }
          }
        }
      };
      
      const result = rbac.loadConfig(config);
      
      expect(result).toBe(true);
      expect(rbac.hasRole('admin')).toBe(true);
      expect(rbac.hasRole('developer')).toBe(false); // Previous roles should be cleared
    });
    
    it('should handle invalid configuration', () => {
      const result = rbac.loadConfig({} as any);
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('getRoleNames', () => {
    it('should return all role names', () => {
      const roleNames = rbac.getRoleNames();
      
      expect(roleNames).toContain('developer');
      expect(roleNames).toContain('security');
      expect(roleNames).toHaveLength(2);
    });
  });
  
  describe('checkPermission', () => {
    it('should check file read permissions correctly', () => {
      expect(rbac.checkPermission('developer', 'files', 'read', 'src/app.ts')).toBe(true);
      expect(rbac.checkPermission('developer', 'files', 'read', 'secrets/keys.json')).toBe(false);
    });
    
    it('should check file write permissions correctly', () => {
      expect(rbac.checkPermission('developer', 'files', 'write', 'src/app.ts')).toBe(true);
      expect(rbac.checkPermission('developer', 'files', 'write', 'src/security/auth.ts')).toBe(false);
    });
    
    it('should check GitHub permissions correctly', () => {
      expect(rbac.checkPermission('developer', 'github', 'issues', 'read')).toBe(true);
      expect(rbac.checkPermission('developer', 'github', 'issues', 'close')).toBe(false);
    });
    
    it('should check workflow permissions correctly', () => {
      expect(rbac.checkPermission('developer', 'workflow', 'execute', 'build')).toBe(true);
      expect(rbac.checkPermission('developer', 'workflow', 'execute', 'security-scan')).toBe(false);
    });
  });
});
