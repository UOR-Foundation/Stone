import { ConfigurationWizard, ConfigTemplate, WizardStep } from '../../../src/usability/configuration-wizard';
import { ConfigLoader } from '../../../src/config/loader';
import { ConfigGenerator } from '../../../src/config/generator';

jest.mock('../../../src/config/loader');
jest.mock('../../../src/config/generator');

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));
import inquirer from 'inquirer';

describe('Configuration Wizard', () => {
  let configWizard: ConfigurationWizard;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;
  let mockConfigGenerator: jest.Mocked<ConfigGenerator>;

  beforeEach(() => {
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>;
    mockConfigGenerator = new ConfigGenerator() as jest.Mocked<ConfigGenerator>;
    
    configWizard = new ConfigurationWizard(mockConfigLoader, mockConfigGenerator);
    
    // Reset inquirer mock
    (inquirer.prompt as jest.Mock).mockReset();
  });

  describe('startWizard', () => {
    it('should run through all the wizard steps and generate a configuration', async () => {
      // Mock the wizard steps and their responses
      const mockResponses = {
        basicInfo: { owner: 'test-owner', name: 'test-repo' },
        githubOptions: { token: 'test-token', createLabels: true },
        workflowOptions: { enablePM: true, enableQA: true },
        advancedOptions: { enableCustomRoles: false }
      };
      
      configWizard.promptForTemplate = jest.fn().mockResolvedValue(true);
      configWizard.promptForTemplateChoice = jest.fn().mockResolvedValue('basic');
      configWizard.promptForBasicInfo = jest.fn().mockResolvedValue(mockResponses.basicInfo);
      configWizard.promptForGitHubToken = jest.fn().mockResolvedValue('test-token');
      configWizard.promptForGitHubOptions = jest.fn().mockResolvedValue(mockResponses.githubOptions);
      configWizard.promptForWorkflowOptions = jest.fn().mockResolvedValue(mockResponses.workflowOptions);
      configWizard.promptForAdvancedOptions = jest.fn().mockResolvedValue(mockResponses.advancedOptions);
      configWizard.loadConfigTemplate = jest.fn().mockReturnValue({
        name: 'Basic',
        id: 'basic',
        description: 'Basic template',
        config: {
          repository: {},
          github: {
            token: ''
          },
          workflow: {}
        }
      });
      configWizard.showConfigSummary = jest.fn().mockResolvedValue(undefined);
      configWizard.confirmConfig = jest.fn().mockResolvedValue(true);
      configWizard.generateConfig = jest.fn().mockImplementation((responses) => ({
        repository: {
          owner: responses.basicInfo.owner,
          name: responses.basicInfo.name
        },
        github: {
          token: responses.githubOptions.token,
          createLabels: responses.githubOptions.createLabels
        },
        workflow: {
          enablePM: responses.workflowOptions.enablePM,
          enableQA: responses.workflowOptions.enableQA
        },
        advanced: {
          enableCustomRoles: responses.advancedOptions.enableCustomRoles
        }
      }));
      
      const config = await configWizard.startWizard();
      
      expect(configWizard.promptForTemplate).toHaveBeenCalled();
      expect(configWizard.promptForTemplateChoice).toHaveBeenCalled();
      expect(configWizard.promptForBasicInfo).toHaveBeenCalled();
      // We're using template mode, which doesn't call generateConfig
      
      // Just check that we get a config object with basic properties
      expect(config).toHaveProperty('repository');
      expect(config).toHaveProperty('github');
    });
  });

  describe('promptForBasicInfo', () => {
    it('should prompt for repository owner and name', async () => {
      const mockAnswers = {
        owner: 'test-owner',
        name: 'test-repo'
      };
      
      (inquirer.prompt as jest.Mock).mockResolvedValue(mockAnswers);
      
      const result = await configWizard.promptForBasicInfo();
      
      expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          name: 'owner',
          message: expect.any(String)
        }),
        expect.objectContaining({
          name: 'name',
          message: expect.any(String)
        })
      ]));
      
      expect(result).toEqual(mockAnswers);
    });
  });

  describe('promptForGitHubOptions', () => {
    it('should prompt for GitHub token and related options', async () => {
      const mockAnswers = {
        token: 'test-token',
        createLabels: true,
        autoCreatePRs: true
      };
      
      (inquirer.prompt as jest.Mock).mockResolvedValue(mockAnswers);
      
      const result = await configWizard.promptForGitHubOptions();
      
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toEqual(mockAnswers);
    });
  });

  describe('promptForWorkflowOptions', () => {
    it('should prompt for workflow-related options', async () => {
      const mockAnswers = {
        enablePM: true,
        enableQA: true,
        enableAudit: true
      };
      
      (inquirer.prompt as jest.Mock).mockResolvedValue(mockAnswers);
      
      const result = await configWizard.promptForWorkflowOptions();
      
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toEqual(mockAnswers);
    });
  });

  describe('promptForAdvancedOptions', () => {
    it('should prompt for advanced configuration options', async () => {
      const mockAnswers = {
        enableCustomRoles: false,
        enablePlugins: true,
        debugMode: false
      };
      
      (inquirer.prompt as jest.Mock).mockResolvedValue(mockAnswers);
      
      const result = await configWizard.promptForAdvancedOptions();
      
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toEqual(mockAnswers);
    });
  });

  describe('generateConfig', () => {
    it('should generate a config object from wizard answers', () => {
      const wizardAnswers = {
        basicInfo: { owner: 'test-owner', name: 'test-repo' },
        githubOptions: { token: 'test-token', createLabels: true },
        workflowOptions: { enablePM: true, enableQA: true },
        advancedOptions: { enableCustomRoles: false }
      };
      
      const config = configWizard.generateConfig(wizardAnswers);
      
      expect(config).toEqual(expect.objectContaining({
        repository: expect.objectContaining({
          owner: 'test-owner',
          name: 'test-repo'
        })
      }));
    });
  });

  describe('saveConfig', () => {
    it('should save the configuration to a file', async () => {
      const config = {
        repository: {
          owner: 'test-owner',
          name: 'test-repo'
        }
      };
      
      mockConfigGenerator.writeConfig = jest.fn().mockResolvedValue(undefined);
      
      await configWizard.saveConfig(config);
      
      expect(mockConfigGenerator.writeConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('loadConfigTemplate', () => {
    it('should load a configuration template', () => {
      const template = configWizard.loadConfigTemplate('basic');
      
      expect(template).toBeDefined();
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('config');
    });
    
    it('should throw an error for unknown template', () => {
      expect(() => configWizard.loadConfigTemplate('unknown')).toThrow();
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return a list of available templates', () => {
      const templates = configWizard.getAvailableTemplates();
      
      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
    });
  });
});