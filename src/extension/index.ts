import { PluginSystem, PluginLoader, PluginManager } from './plugin-system';
import type { Plugin } from './plugin-system';
import { CustomRoleRegistry } from './custom-role';
import type { CustomRole } from './custom-role';
import { WorkflowCustomizer } from './workflow-customization';
import type { WorkflowExtensionPoint, CustomWorkflowStep } from './workflow-customization';
import { ExtensionManager } from './extension-manager';

/**
 * Extension system module that exports all extension-related components
 */
export {
  // Plugin system
  PluginSystem,
  PluginLoader,
  PluginManager,
  
  // Custom role system
  CustomRoleRegistry,
  
  // Workflow customization
  WorkflowCustomizer,
  
  // Extension manager
  ExtensionManager
};

// Export types
export type { Plugin, CustomRole, WorkflowExtensionPoint, CustomWorkflowStep };

/**
 * Default export of the extension system
 */
export default {
  PluginSystem,
  PluginLoader,
  PluginManager,
  CustomRoleRegistry,
  WorkflowCustomizer
};