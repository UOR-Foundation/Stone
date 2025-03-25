import { RoleManager } from '../claude/roles/role-manager';

/**
 * Interface defining the structure of a custom role
 */
export interface CustomRole {
  id: string;
  name: string;
  description: string;
  prompt: string;
  systemMessages: string[];
  capabilities: string[];
  initialize: () => void;
}

/**
 * Class for managing custom roles
 */
export class CustomRoleRegistry {
  private customRoles: Map<string, CustomRole> = new Map();
  private roleManager: RoleManager;

  constructor(roleManager: RoleManager) {
    this.roleManager = roleManager;
  }

  /**
   * Registers a custom role
   */
  registerCustomRole(role: CustomRole): void {
    if (this.customRoles.has(role.id)) {
      throw new Error(`Custom role with ID "${role.id}" is already registered`);
    }

    // Initialize the role
    role.initialize();
    this.customRoles.set(role.id, role);
  }

  /**
   * Gets a custom role by ID
   */
  getCustomRole(id: string): CustomRole | undefined {
    return this.customRoles.get(id);
  }

  /**
   * Unregisters a custom role by ID
   */
  unregisterCustomRole(id: string): boolean {
    return this.customRoles.delete(id);
  }

  /**
   * Gets all registered custom roles
   */
  getAllCustomRoles(): CustomRole[] {
    return Array.from(this.customRoles.values());
  }

  /**
   * Integrates registered custom roles with the role manager
   */
  integrateWithRoleManager(): void {
    for (const role of this.customRoles.values()) {
      this.roleManager.registerCustomRole(role);
    }
  }

  /**
   * Validates if a custom role has all required properties
   */
  validateCustomRole(role: CustomRole): boolean {
    if (!role.id || typeof role.id !== 'string') return false;
    if (!role.name || typeof role.name !== 'string') return false;
    if (!role.description || typeof role.description !== 'string') return false;
    if (!role.prompt || typeof role.prompt !== 'string') return false;
    if (!Array.isArray(role.systemMessages)) return false;
    if (!Array.isArray(role.capabilities)) return false;
    if (!role.initialize || typeof role.initialize !== 'function') return false;
    
    return true;
  }
}

/**
 * Export necessary components
 */
export default {
  CustomRoleRegistry
};