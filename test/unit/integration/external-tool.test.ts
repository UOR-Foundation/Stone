import { ExternalToolIntegration, ExternalTool, ToolExecutionContext } from '../../../src/integration/external-tool';
import { spawn } from 'child_process';

jest.mock('child_process');

describe('External Tool Integration', () => {
  let toolIntegration: ExternalToolIntegration;

  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
    toolIntegration = new ExternalToolIntegration();
  });

  describe('registerTool', () => {
    it('should register an external tool', () => {
      const tool: ExternalTool = {
        id: 'code-analysis',
        name: 'Code Analysis Tool',
        description: 'A tool for analyzing code',
        command: 'analyze',
        args: ['--format=json'],
        parseOutput: jest.fn()
      };

      toolIntegration.registerTool(tool);
      
      expect(toolIntegration.getTool('code-analysis')).toBe(tool);
    });

    it('should throw error when registering a tool with duplicate ID', () => {
      const tool: ExternalTool = {
        id: 'code-analysis',
        name: 'Code Analysis Tool',
        description: 'A tool for analyzing code',
        command: 'analyze',
        args: ['--format=json'],
        parseOutput: jest.fn()
      };

      toolIntegration.registerTool(tool);
      
      expect(() => toolIntegration.registerTool(tool)).toThrow();
    });
  });

  describe('executeTool', () => {
    it('should execute an external tool and parse its output', async () => {
      const mockStdout = `{"result": "success", "issues": []}`;
      const mockProcess = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(mockStdout);
            }
          })
        },
        stderr: {
          on: jest.fn()
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      };
      
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      
      const parseOutput = jest.fn().mockReturnValue({ result: 'success', issues: [] });
      
      const tool: ExternalTool = {
        id: 'code-analysis',
        name: 'Code Analysis Tool',
        description: 'A tool for analyzing code',
        command: 'analyze',
        args: ['--format=json'],
        parseOutput
      };

      toolIntegration.registerTool(tool);
      
      const context: ToolExecutionContext = {
        workingDirectory: '/path/to/project',
        additionalArgs: ['./src']
      };
      
      const result = await toolIntegration.executeTool('code-analysis', context);
      
      expect(spawn).toHaveBeenCalledWith('analyze', ['--format=json', './src'], expect.any(Object));
      expect(parseOutput).toHaveBeenCalledWith(mockStdout);
      expect(result).toEqual({ result: 'success', issues: [] });
    });

    it('should throw error when executing a non-existent tool', async () => {
      await expect(toolIntegration.executeTool('non-existent', {})).rejects.toThrow();
    });

    it('should handle tool execution errors', async () => {
      const mockStderr = 'Command not found';
      const mockProcess = {
        stdout: {
          on: jest.fn()
        },
        stderr: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(mockStderr);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        })
      };
      
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      
      const tool: ExternalTool = {
        id: 'failing-tool',
        name: 'Failing Tool',
        description: 'A tool that fails',
        command: 'fail',
        args: [],
        parseOutput: jest.fn()
      };

      toolIntegration.registerTool(tool);
      
      await expect(toolIntegration.executeTool('failing-tool', {})).rejects.toThrow();
    });
  });

  describe('unregisterTool', () => {
    it('should unregister an external tool by ID', () => {
      const tool: ExternalTool = {
        id: 'code-analysis',
        name: 'Code Analysis Tool',
        description: 'A tool for analyzing code',
        command: 'analyze',
        args: ['--format=json'],
        parseOutput: jest.fn()
      };

      toolIntegration.registerTool(tool);
      expect(toolIntegration.getTool('code-analysis')).toBe(tool);
      
      toolIntegration.unregisterTool('code-analysis');
      expect(toolIntegration.getTool('code-analysis')).toBeUndefined();
    });
  });
});