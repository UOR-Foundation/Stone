import { InteractiveCLI, PromptQuestion, CommandOption } from '../../../src/usability/interactive-cli';
import { ConfigLoader } from '../../../src/config/loader';
import { ConfigGenerator } from '../../../src/config/generator';

jest.mock('../../../src/config/loader');
jest.mock('../../../src/config/generator');

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));
import inquirer from 'inquirer';

describe('Interactive CLI', () => {
  let interactiveCLI: InteractiveCLI;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;
  let mockConfigGenerator: jest.Mocked<ConfigGenerator>;

  beforeEach(() => {
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>;
    mockConfigGenerator = new ConfigGenerator() as jest.Mocked<ConfigGenerator>;
    
    interactiveCLI = new InteractiveCLI(mockConfigLoader, mockConfigGenerator);
    
    // Reset inquirer mock
    (inquirer.prompt as jest.Mock).mockReset();
  });

  describe('promptForCommand', () => {
    it('should prompt for a command and return the selected option', async () => {
      const commands = [
        { name: 'init', description: 'Initialize Stone in a repository' },
        { name: 'status', description: 'Check the status of Stone' }
      ];
      
      (inquirer.prompt as jest.Mock).mockResolvedValue({ command: 'init' });
      
      const result = await interactiveCLI.promptForCommand(commands);
      
      expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          type: 'list',
          name: 'command',
          message: expect.any(String),
          choices: expect.arrayContaining([
            expect.objectContaining({ name: expect.stringContaining('init') }),
            expect.objectContaining({ name: expect.stringContaining('status') })
          ])
        })
      ]));
      
      expect(result).toBe('init');
    });
  });

  describe('promptForConfig', () => {
    it('should prompt for configuration options and return the config object', async () => {
      const mockAnswers = {
        owner: 'test-owner',
        name: 'test-repo',
        token: 'test-token'
      };
      
      (inquirer.prompt as jest.Mock).mockResolvedValue(mockAnswers);
      
      const config = await interactiveCLI.promptForConfig();
      
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(config).toEqual(expect.objectContaining({
        repository: {
          owner: 'test-owner',
          name: 'test-repo'
        },
        github: {
          token: 'test-token'
        }
      }));
    });
  });

  describe('promptForConfirmation', () => {
    it('should prompt for confirmation and return the result', async () => {
      (inquirer.prompt as jest.Mock).mockResolvedValue({ confirmed: true });
      
      const confirmed = await interactiveCLI.promptForConfirmation(
        'Are you sure?', 
        'This action cannot be undone'
      );
      
      expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure?'
        })
      ]));
      
      expect(confirmed).toBe(true);
    });
  });

  describe('interactiveInit', () => {
    it('should run the interactive initialization process', async () => {
      // Mock the prompts
      const mockConfig = {
        repository: {
          owner: 'test-owner',
          name: 'test-repo'
        },
        github: {
          token: 'test-token',
          createLabels: false
        },
        workflow: {
          enabled: true
        }
      };
      
      interactiveCLI.promptForConfig = jest.fn().mockResolvedValue(mockConfig);
      interactiveCLI.promptForConfirmation = jest.fn().mockResolvedValue(true);
      
      // Mock the config generation
      mockConfigGenerator.generate = jest.fn().mockResolvedValue(mockConfig);
      mockConfigGenerator.createDirectories = jest.fn().mockResolvedValue(undefined);
      mockConfigGenerator.writeConfig = jest.fn().mockResolvedValue(undefined);
      
      await interactiveCLI.interactiveInit();
      
      expect(interactiveCLI.promptForConfig).toHaveBeenCalled();
      expect(interactiveCLI.promptForConfirmation).toHaveBeenCalled();
      expect(mockConfigGenerator.generate).toHaveBeenCalled();
      expect(mockConfigGenerator.createDirectories).toHaveBeenCalled();
      expect(mockConfigGenerator.writeConfig).toHaveBeenCalled();
    });
  });

  describe('interactiveRunWorkflow', () => {
    it('should run a workflow interactively', async () => {
      // Mock workflow options
      const workflowOptions = [
        { name: 'issue', description: 'Process an issue' },
        { name: 'pr', description: 'Process a pull request' }
      ];
      
      interactiveCLI.getWorkflowOptions = jest.fn().mockReturnValue(workflowOptions);
      interactiveCLI.promptForCommand = jest.fn().mockResolvedValue('issue');
      
      (inquirer.prompt as jest.Mock)
        .mockResolvedValueOnce({ issueNumber: '123' }) // Issue number prompt
        .mockResolvedValueOnce({ confirmed: true }); // Confirmation prompt
      
      // Mock run workflow function
      const mockRunWorkflow = jest.fn().mockResolvedValue(undefined);
      
      await interactiveCLI.interactiveRunWorkflow(mockRunWorkflow);
      
      expect(interactiveCLI.promptForCommand).toHaveBeenCalled();
      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
      expect(mockRunWorkflow).toHaveBeenCalledWith('issue', '123');
    });
  });

  describe('getCommandOptions', () => {
    it('should return the available command options', () => {
      const options = interactiveCLI.getCommandOptions();
      
      expect(options).toBeInstanceOf(Array);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveProperty('name');
      expect(options[0]).toHaveProperty('description');
    });
  });

  describe('interactiveStatus', () => {
    it('should display status interactively', async () => {
      // Mock status data
      const statusData = {
        repository: 'test-owner/test-repo',
        branch: 'main',
        stoneVersion: '1.0.0',
        issues: { open: 5, total: 10 },
        pullRequests: { open: 2, total: 5 }
      };
      
      // Mock the status function
      const mockGetStatus = jest.fn().mockResolvedValue(statusData);
      
      // Mock the prompt for additional options
      interactiveCLI.promptForCommand = jest.fn().mockResolvedValue('detailed');
      
      await interactiveCLI.interactiveStatus(mockGetStatus);
      
      expect(mockGetStatus).toHaveBeenCalled();
      expect(interactiveCLI.promptForCommand).toHaveBeenCalled();
    });
  });
});