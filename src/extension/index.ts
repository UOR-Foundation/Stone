import { PluginSystem, PluginLoader, PluginManager, Plugin } from './plugin-system';
import { CustomRoleRegistry, CustomRole } from './custom-role';
import { WorkflowCustomizer, WorkflowExtensionPoint, CustomWorkflowStep } from './workflow-customization';

/**
 * Extension system module that exports all extension-related components
 */
export {
  // Plugin system
  PluginSystem,
  PluginLoader,
  PluginManager,
  Plugin,
  
  // Custom role system
  CustomRoleRegistry,
  CustomRole,
  
  // Workflow customization
  WorkflowCustomizer,
  WorkflowExtensionPoint,
  CustomWorkflowStep
};

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