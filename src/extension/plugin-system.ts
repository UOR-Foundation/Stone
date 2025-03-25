import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface defining the structure of a plugin hook
 */
export interface PluginHook {
  name: string;
  handler: (...args: any[]) => any;
}

/**
 * Interface defining the structure of a plugin
 */
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  initialize: () => void;
  hooks: Record<string, PluginHook>;
}

/**
 * Class responsible for loading plugins
 */
export class PluginLoader {
  /**
   * Validates if a plugin has all required properties
   */
  validatePlugin(plugin: Plugin): boolean {
    if (!plugin.name || typeof plugin.name !== 'string') return false;
    if (!plugin.version || typeof plugin.version !== 'string') return false;
    if (!plugin.description || typeof plugin.description !== 'string') return false;
    if (!plugin.author || typeof plugin.author !== 'string') return false;
    if (!plugin.initialize || typeof plugin.initialize !== 'function') return false;
    if (!plugin.hooks || typeof plugin.hooks !== 'object') return false;
    
    return true;
  }

  /**
   * Loads a plugin from a file path
   */
  loadPlugin(pluginPath: string): Plugin {
    try {
      // Dynamic import for Node.js
      const plugin = require(pluginPath);
      return plugin;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load plugin from ${pluginPath}: ${errorMessage}`);
    }
  }

  /**
   * Discovers plugins in a directory
   */
  discoverPlugins(pluginDir: string): Plugin[] {
    if (!fs.existsSync(pluginDir)) {
      return [];
    }

    const plugins: Plugin[] = [];
    const files = fs.readdirSync(pluginDir);

    for (const file of files) {
      // Only load JavaScript files
      if (path.extname(file) === '.js') {
        try {
          const pluginPath = path.join(pluginDir, file);
          const plugin = this.loadPlugin(pluginPath);
          plugins.push(plugin);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error loading plugin ${file}: ${errorMessage}`);
        }
      }
    }

    return plugins;
  }
}

/**
 * Main class for managing the plugin system
 */
export class PluginSystem {
  private plugins: Map<string, Plugin> = new Map();
  private pluginLoader: PluginLoader;

  constructor(pluginLoader: PluginLoader = new PluginLoader()) {
    this.pluginLoader = pluginLoader;
  }

  /**
   * Registers a plugin in the system
   */
  registerPlugin(plugin: Plugin): void {
    if (!this.pluginLoader.validatePlugin(plugin)) {
      throw new Error(`Invalid plugin: ${plugin.name || 'unknown'}`);
    }

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" is already registered`);
    }

    // Initialize the plugin
    plugin.initialize();
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Gets a plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Lists all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Executes a hook from a plugin
   */
  executeHook(pluginName: string, hookName: string, ...args: any[]): any {
    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" not found`);
    }

    const hook = plugin.hooks[hookName];
    if (!hook) {
      throw new Error(`Hook "${hookName}" not found in plugin "${pluginName}"`);
    }

    return hook.handler(...args);
  }

  /**
   * Executes a named hook across all plugins that implement it
   */
  executeHookAcrossPlugins(hookName: string, ...args: any[]): any[] {
    const results: any[] = [];

    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks[hookName];
      if (hook) {
        try {
          results.push(hook.handler(...args));
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error executing hook "${hookName}" in plugin "${plugin.name}": ${errorMessage}`);
        }
      }
    }

    return results;
  }

  /**
   * Unregisters a plugin by name
   */
  unregisterPlugin(name: string): boolean {
    return this.plugins.delete(name);
  }
}

/**
 * Class for managing plugin installation and enabling/disabling
 */
export class PluginManager {
  private pluginSystem: PluginSystem;
  private enabledPlugins: Set<string> = new Set();

  constructor(pluginSystem: PluginSystem) {
    this.pluginSystem = pluginSystem;
  }

  /**
   * Installs a plugin from a file path
   */
  installPlugin(pluginPath: string): void {
    try {
      const plugin = require(pluginPath);
      this.pluginSystem.registerPlugin(plugin);
      this.enablePlugin(plugin.name);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to install plugin from ${pluginPath}: ${errorMessage}`);
    }
  }

  /**
   * Enables a plugin by name
   */
  enablePlugin(name: string): void {
    this.enabledPlugins.add(name);
  }

  /**
   * Disables a plugin by name
   */
  disablePlugin(name: string): void {
    this.enabledPlugins.delete(name);
  }

  /**
   * Checks if a plugin is enabled
   */
  isPluginEnabled(name: string): boolean {
    return this.enabledPlugins.has(name);
  }

  /**
   * Gets all enabled plugins
   */
  getEnabledPlugins(): string[] {
    return Array.from(this.enabledPlugins);
  }
}

/**
 * Export necessary components
 */
export default {
  PluginSystem,
  PluginLoader,
  PluginManager
};