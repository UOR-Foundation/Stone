import { CustomRoleRegistry, CustomRole } from '../../../src/extension/custom-role';
import { RoleManager } from '../../../src/claude/roles/role-manager';

jest.mock('../../../src/claude/roles/role-manager');

describe('Custom Role System', () => {
  let customRoleRegistry: CustomRoleRegistry;
  let mockRoleManager: jest.Mocked<RoleManager>;

  beforeEach(() => {
    mockRoleManager = new RoleManager() as jest.Mocked<RoleManager>;
    customRoleRegistry = new CustomRoleRegistry(mockRoleManager);
  });

  describe('registerCustomRole', () => {
    it('should register a valid custom role', () => {
      const customRole: CustomRole = {
        id: 'custom-developer',
        name: 'Custom Developer',
        description: 'A custom developer role',
        prompt: 'You are a custom developer',
        systemMessages: ['Focus on writing clean code'],
        capabilities: ['codeReview', 'implementation'],
        initialize: jest.fn()
      };

      customRoleRegistry.registerCustomRole(customRole);
      
      expect(customRoleRegistry.getCustomRole('custom-developer')).toBe(customRole);
      expect(customRole.initialize).toHaveBeenCalled();
    });

    it('should throw error when registering a role with duplicate ID', () => {
      const customRole: CustomRole = {
        id: 'custom-developer',
        name: 'Custom Developer',
        description: 'A custom developer role',
        prompt: 'You are a custom developer',
        systemMessages: ['Focus on writing clean code'],
        capabilities: ['codeReview', 'implementation'],
        initialize: jest.fn()
      };

      customRoleRegistry.registerCustomRole(customRole);
      
      expect(() => customRoleRegistry.registerCustomRole(customRole)).toThrow();
    });
  });

  describe('unregisterCustomRole', () => {
    it('should unregister a custom role by ID', () => {
      const customRole: CustomRole = {
        id: 'custom-developer',
        name: 'Custom Developer',
        description: 'A custom developer role',
        prompt: 'You are a custom developer',
        systemMessages: ['Focus on writing clean code'],
        capabilities: ['codeReview', 'implementation'],
        initialize: jest.fn()
      };

      customRoleRegistry.registerCustomRole(customRole);
      expect(customRoleRegistry.getCustomRole('custom-developer')).toBe(customRole);
      
      customRoleRegistry.unregisterCustomRole('custom-developer');
      expect(customRoleRegistry.getCustomRole('custom-developer')).toBeUndefined();
    });
  });

  describe('getAllCustomRoles', () => {
    it('should return all registered custom roles', () => {
      const customRole1: CustomRole = {
        id: 'custom-developer',
        name: 'Custom Developer',
        description: 'A custom developer role',
        prompt: 'You are a custom developer',
        systemMessages: ['Focus on writing clean code'],
        capabilities: ['codeReview', 'implementation'],
        initialize: jest.fn()
      };

      const customRole2: CustomRole = {
        id: 'custom-architect',
        name: 'Custom Architect',
        description: 'A custom architect role',
        prompt: 'You are a custom architect',
        systemMessages: ['Focus on system design'],
        capabilities: ['architecture', 'review'],
        initialize: jest.fn()
      };

      customRoleRegistry.registerCustomRole(customRole1);
      customRoleRegistry.registerCustomRole(customRole2);
      
      const allRoles = customRoleRegistry.getAllCustomRoles();
      
      expect(allRoles).toHaveLength(2);
      expect(allRoles).toContain(customRole1);
      expect(allRoles).toContain(customRole2);
    });
  });

  describe('integrateWithRoleManager', () => {
    it('should integrate custom roles with the role manager', () => {
      const customRole: CustomRole = {
        id: 'custom-developer',
        name: 'Custom Developer',
        description: 'A custom developer role',
        prompt: 'You are a custom developer',
        systemMessages: ['Focus on writing clean code'],
        capabilities: ['codeReview', 'implementation'],
        initialize: jest.fn()
      };

      customRoleRegistry.registerCustomRole(customRole);
      customRoleRegistry.integrateWithRoleManager();
      
      expect(mockRoleManager.registerCustomRole).toHaveBeenCalledWith(customRole);
    });
  });
});