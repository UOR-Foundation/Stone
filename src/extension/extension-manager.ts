import { PluginSystem, PluginLoader, PluginManager } from './plugin-system';
import { CustomRoleRegistry } from './custom-role';
import { WorkflowCustomizer } from './workflow-customization';
import { RoleManager } from '../claude/roles/role-manager';
import { TemplateSystem } from '../templates/template-system';
import { ExternalToolIntegration } from '../integration/external-tool';
import { ExtensionAPI } from '../integration/api';
import { NotificationSystem } from '../integration/notification';
import { DataExchangeManager } from '../integration/data-exchange';
import { initializeTools } from '../tools/init-tools';

/**
 * Central manager for all extension systems
 */
export class ExtensionManager {
  // Plugin system
  private pluginLoader: PluginLoader;
  private pluginSystem: PluginSystem;
  private pluginManager: PluginManager;
  
  // Custom role system
  private customRoleRegistry: CustomRoleRegistry;
  
  // Workflow customization
  private workflowCustomizer: WorkflowCustomizer;
  
  // Template system
  private templateSystem: TemplateSystem;
  
  // Integration capabilities
  private externalToolIntegration: ExternalToolIntegration;
  private extensionAPI: ExtensionAPI;
  private notificationSystem: NotificationSystem;
  private dataExchangeManager: DataExchangeManager;

  constructor(roleManager: RoleManager) {
    // Initialize plugin system
    this.pluginLoader = new PluginLoader();
    this.pluginSystem = new PluginSystem(this.pluginLoader);
    this.pluginManager = new PluginManager(this.pluginSystem);
    
    // Initialize custom role system
    this.customRoleRegistry = new CustomRoleRegistry(roleManager);
    
    // Initialize workflow customization
    this.workflowCustomizer = new WorkflowCustomizer();
    
    // Initialize template system
    this.templateSystem = new TemplateSystem();
    
    // Initialize integration capabilities
    this.externalToolIntegration = new ExternalToolIntegration();
    this.extensionAPI = new ExtensionAPI();
    this.notificationSystem = new NotificationSystem();
    this.dataExchangeManager = new DataExchangeManager();
  }

  /**
   * Gets the plugin system
   */
  getPluginSystem(): PluginSystem {
    return this.pluginSystem;
  }

  /**
   * Gets the plugin manager
   */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  /**
   * Gets the custom role registry
   */
  getCustomRoleRegistry(): CustomRoleRegistry {
    return this.customRoleRegistry;
  }

  /**
   * Gets the workflow customizer
   */
  getWorkflowCustomizer(): WorkflowCustomizer {
    return this.workflowCustomizer;
  }

  /**
   * Gets the template system
   */
  getTemplateSystem(): TemplateSystem {
    return this.templateSystem;
  }

  /**
   * Gets the external tool integration
   */
  getExternalToolIntegration(): ExternalToolIntegration {
    return this.externalToolIntegration;
  }

  /**
   * Gets the extension API
   */
  getExtensionAPI(): ExtensionAPI {
    return this.extensionAPI;
  }

  /**
   * Gets the notification system
   */
  getNotificationSystem(): NotificationSystem {
    return this.notificationSystem;
  }

  /**
   * Gets the data exchange manager
   */
  getDataExchangeManager(): DataExchangeManager {
    return this.dataExchangeManager;
  }

  /**
   * Initializes all extension systems
   */
  async initialize(pluginDirectory?: string): Promise<void> {
    // Load plugins if directory is provided
    if (pluginDirectory) {
      const plugins = this.pluginLoader.discoverPlugins(pluginDirectory);
      for (const plugin of plugins) {
        this.pluginSystem.registerPlugin(plugin);
      }
    }
    
    // Integrate custom roles with role manager
    this.customRoleRegistry.integrateWithRoleManager();
    
    // Initialize custom tools
    initializeTools(this.externalToolIntegration);
  }
}

/**
 * Export necessary components
 */
export default {
  ExtensionManager
};
