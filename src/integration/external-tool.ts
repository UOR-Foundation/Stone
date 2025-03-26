import { spawn } from 'child_process';

/**
 * Interface defining an external tool
 */
export interface ExternalTool {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  parseOutput: (output: string) => any;
}

/**
 * Interface for tool execution context
 */
export interface ToolExecutionContext {
  workingDirectory?: string;
  additionalArgs?: string[];
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Class for integrating with external tools
 */
export class ExternalToolIntegration {
  private tools: Map<string, ExternalTool> = new Map();

  /**
   * Registers an external tool
   */
  registerTool(tool: ExternalTool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with ID "${tool.id}" is already registered`);
    }

    this.tools.set(tool.id, tool);
  }

  /**
   * Gets a tool by ID
   */
  getTool(id: string): ExternalTool | undefined {
    return this.tools.get(id);
  }

  /**
   * Unregisters a tool by ID
   */
  unregisterTool(id: string): boolean {
    return this.tools.delete(id);
  }

  /**
   * Executes an external tool
   */
  async executeTool(toolId: string, context: ToolExecutionContext): Promise<any> {
    const tool = this.getTool(toolId);
    if (!tool) {
      throw new Error(`Tool "${toolId}" not found`);
    }

    return new Promise((resolve, reject) => {
      // Prepare command arguments
      const args = [...tool.args];
      if (context.additionalArgs) {
        args.push(...context.additionalArgs);
      }

      // Get current Node.js process environment
      const currentEnv = typeof process !== 'undefined' ? process.env : {};
      const currentCwd = typeof process !== 'undefined' ? process.cwd() : '.';

      // Prepare execution options
      const options: any = {
        cwd: context.workingDirectory || currentCwd,
        env: { ...currentEnv, ...(context.env || {}) }
      };

      if (context.timeout) {
        options.timeout = context.timeout;
      }

      // Spawn child process
      const childProcess = spawn(tool.command, args, options);
      
      let stdout = '';
      let stderr = '';

      // Collect stdout
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = tool.parseOutput(stdout);
            resolve(result);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            reject(new Error(`Failed to parse tool output: ${errorMessage}`));
          }
        } else {
          reject(new Error(`Tool execution failed with code ${code}: ${stderr}`));
        }
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        reject(new Error(`Failed to execute tool: ${error.message}`));
      });
    });
  }

  /**
   * Gets all registered tools
   */
  getAllTools(): ExternalTool[] {
    return Array.from(this.tools.values());
  }
}

/**
 * Export necessary components
 */
export default {
  ExternalToolIntegration
};