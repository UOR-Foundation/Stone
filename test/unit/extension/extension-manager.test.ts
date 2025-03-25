import { ExtensionManager } from '../../../src/extension/extension-manager';
import { RoleManager } from '../../../src/claude/roles/role-manager';

jest.mock('../../../src/claude/roles/role-manager');

describe('Extension Manager', () => {
  let extensionManager: ExtensionManager;
  let mockRoleManager: jest.Mocked<RoleManager>;

  beforeEach(() => {
    mockRoleManager = new RoleManager() as jest.Mocked<RoleManager>;
    extensionManager = new ExtensionManager(mockRoleManager);
  });

  it('should initialize and provide access to all extension systems', () => {
    // Test that all components are initialized and accessible
    expect(extensionManager.getPluginSystem()).toBeDefined();
    expect(extensionManager.getPluginManager()).toBeDefined();
    expect(extensionManager.getCustomRoleRegistry()).toBeDefined();
    expect(extensionManager.getWorkflowCustomizer()).toBeDefined();
    expect(extensionManager.getTemplateSystem()).toBeDefined();
    expect(extensionManager.getExternalToolIntegration()).toBeDefined();
    expect(extensionManager.getExtensionAPI()).toBeDefined();
    expect(extensionManager.getNotificationSystem()).toBeDefined();
    expect(extensionManager.getDataExchangeManager()).toBeDefined();
  });

  describe('initialize', () => {
    it('should initialize all extension systems', async () => {
      // Setup spies
      const customRoleRegistry = extensionManager.getCustomRoleRegistry();
      jest.spyOn(customRoleRegistry, 'integrateWithRoleManager');
      
      await extensionManager.initialize();
      
      expect(customRoleRegistry.integrateWithRoleManager).toHaveBeenCalled();
    });
  });
});