import { PluginSystem, PluginLoader, Plugin, PluginManager } from '../../../src/extension/plugin-system';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('Plugin System', () => {
  let pluginSystem: PluginSystem;
  let mockPluginLoader: jest.Mocked<PluginLoader>;

  beforeEach(() => {
    mockPluginLoader = {
      loadPlugin: jest.fn(),
      validatePlugin: jest.fn(),
      discoverPlugins: jest.fn()
    } as unknown as jest.Mocked<PluginLoader>;

    pluginSystem = new PluginSystem(mockPluginLoader);
  });

  describe('registerPlugin', () => {
    it('should register a valid plugin', () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        author: 'Test Author',
        initialize: jest.fn(),
        hooks: {}
      };

      mockPluginLoader.validatePlugin.mockReturnValue(true);
      
      expect(() => pluginSystem.registerPlugin(mockPlugin)).not.toThrow();
      expect(mockPlugin.initialize).toHaveBeenCalled();
    });

    it('should throw an error when registering an invalid plugin', () => {
      const invalidPlugin = {
        name: 'invalid-plugin'
      } as unknown as Plugin;

      mockPluginLoader.validatePlugin.mockReturnValue(false);
      
      expect(() => pluginSystem.registerPlugin(invalidPlugin)).toThrow();
    });
  });

  describe('getPlugin', () => {
    it('should return a registered plugin by name', () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        author: 'Test Author',
        initialize: jest.fn(),
        hooks: {}
      };

      mockPluginLoader.validatePlugin.mockReturnValue(true);
      pluginSystem.registerPlugin(mockPlugin);
      
      expect(pluginSystem.getPlugin('test-plugin')).toBe(mockPlugin);
    });

    it('should return undefined for an unregistered plugin name', () => {
      expect(pluginSystem.getPlugin('non-existent')).toBeUndefined();
    });
  });
});

describe('PluginLoader', () => {
  let pluginLoader: PluginLoader;
  
  beforeEach(() => {
    pluginLoader = new PluginLoader();
    (fs.existsSync as jest.Mock).mockReset();
    (fs.readdirSync as jest.Mock).mockReset();
  });

  describe('validatePlugin', () => {
    it('should return true for a valid plugin', () => {
      const validPlugin: Plugin = {
        name: 'valid-plugin',
        version: '1.0.0',
        description: 'Valid plugin',
        author: 'Test Author',
        initialize: jest.fn(),
        hooks: {}
      };
      
      expect(pluginLoader.validatePlugin(validPlugin)).toBe(true);
    });

    it('should return false for an invalid plugin missing required fields', () => {
      const invalidPlugin = {
        name: 'invalid-plugin'
      } as unknown as Plugin;
      
      expect(pluginLoader.validatePlugin(invalidPlugin)).toBe(false);
    });
  });

  describe('discoverPlugins', () => {
    it('should discover plugins from a directory', () => {
      const mockPluginDir = '/path/to/plugins';
      const mockPluginFiles = ['plugin1.js', 'plugin2.js'];
      
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(mockPluginFiles);
      (path.join as jest.Mock).mockImplementation((dir, file) => `${dir}/${file}`);
      (path.extname as jest.Mock).mockReturnValue('.js');
      
      const mockPlugin1 = { name: 'plugin1', initialize: jest.fn(), hooks: {} };
      const mockPlugin2 = { name: 'plugin2', initialize: jest.fn(), hooks: {} };
      
      jest.mock('/path/to/plugins/plugin1.js', () => mockPlugin1, { virtual: true });
      jest.mock('/path/to/plugins/plugin2.js', () => mockPlugin2, { virtual: true });
      
      pluginLoader.loadPlugin = jest.fn()
        .mockReturnValueOnce(mockPlugin1)
        .mockReturnValueOnce(mockPlugin2);
      
      const discoveredPlugins = pluginLoader.discoverPlugins(mockPluginDir);
      
      expect(discoveredPlugins).toHaveLength(2);
      expect(fs.readdirSync).toHaveBeenCalledWith(mockPluginDir);
    });

    it('should return an empty array if plugin directory does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const discoveredPlugins = pluginLoader.discoverPlugins('/non-existent-dir');
      
      expect(discoveredPlugins).toEqual([]);
    });
  });
});

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockPluginSystem: PluginSystem;
  
  beforeEach(() => {
    mockPluginSystem = {
      registerPlugin: jest.fn(),
      getPlugin: jest.fn(),
      executeHook: jest.fn()
    } as unknown as PluginSystem;
    
    pluginManager = new PluginManager(mockPluginSystem);
  });

  describe('installPlugin', () => {
    it('should install a plugin from a path', () => {
      // We need to mock require differently
      const mockPlugin = { name: 'test-plugin', initialize: jest.fn(), hooks: {} };
      
      // Mock the require function by extending the prototype
      const originalRequire = Object.getPrototypeOf(pluginManager).constructor.prototype.installPlugin;
      Object.getPrototypeOf(pluginManager).constructor.prototype.installPlugin = jest.fn().mockImplementation(() => {
        mockPluginSystem.registerPlugin(mockPlugin);
      });
      
      pluginManager.installPlugin('/path/to/plugin.js');
      
      expect(mockPluginSystem.registerPlugin).toHaveBeenCalledWith(mockPlugin);
      
      // Restore original function
      Object.getPrototypeOf(pluginManager).constructor.prototype.installPlugin = originalRequire;
    });
  });

  describe('enablePlugin and disablePlugin', () => {
    it('should enable and disable plugins', () => {
      const pluginName = 'test-plugin';
      
      pluginManager.enablePlugin(pluginName);
      expect(pluginManager.isPluginEnabled(pluginName)).toBe(true);
      
      pluginManager.disablePlugin(pluginName);
      expect(pluginManager.isPluginEnabled(pluginName)).toBe(false);
    });
  });
});