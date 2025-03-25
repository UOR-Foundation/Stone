import { LoggerService } from '../services/logger-service';
import { ParallelExecutor, TaskResult } from '../performance/parallel-executor';

/**
 * A workflow step to be executed
 */
export interface WorkflowStep {
  id: string;
  name: string;
  execute: () => Promise<any>;
  dependencies?: string[];
  priority?: number;
  timeout?: number;
}

/**
 * Configuration for workflow distribution
 */
export interface WorkflowDistributorConfig {
  maxConcurrent: number;
  failFast?: boolean;
  defaultTimeout?: number;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  success: boolean;
  steps: Record<string, {
    success: boolean;
    duration: number;
    result?: any;
    error?: Error;
  }>;
  duration: number;
}

/**
 * Distributes workflow execution across available resources
 */
export class WorkflowDistributor {
  private executor: ParallelExecutor;
  private config: Required<WorkflowDistributorConfig>;

  constructor(
    private logger: LoggerService,
    config?: Partial<WorkflowDistributorConfig>
  ) {
    // Default configuration
    this.config = {
      maxConcurrent: 3,
      failFast: true,
      defaultTimeout: 300000, // 5 minutes
      ...config
    };

    // Create executor
    this.executor = new ParallelExecutor(logger, {
      maxConcurrent: this.config.maxConcurrent,
      timeoutMs: this.config.defaultTimeout
    });
  }

  /**
   * Execute a workflow with multiple steps
   * @param steps Array of workflow steps
   * @returns Result of the workflow execution
   */
  public async executeWorkflow(steps: WorkflowStep[]): Promise<WorkflowResult> {
    const startTime = Date.now();
    this.logger.info(`Starting workflow execution with ${steps.length} steps`);

    // Clone steps to avoid modifying the input
    const workflowSteps = [...steps];

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(workflowSteps);

    // Validate dependency graph (check for cycles)
    this.validateDependencyGraph(dependencyGraph);

    // Initialize results
    const results: Record<string, {
      success: boolean;
      duration: number;
      result?: any;
      error?: Error;
    }> = {};

    // Set of completed steps
    const completedSteps = new Set<string>();

    // Set of failed steps
    const failedSteps = new Set<string>();

    // Execute workflow until all steps are completed or a critical failure occurs
    while (completedSteps.size < workflowSteps.length) {
      // Find steps that are ready to execute (all dependencies satisfied)
      const readySteps = workflowSteps.filter(step => 
        !completedSteps.has(step.id) && // Not already completed
        this.areDependenciesSatisfied(step, completedSteps, failedSteps)
      );

      // If no steps are ready and we haven't completed all steps, there's a problem
      if (readySteps.length === 0 && completedSteps.size < workflowSteps.length) {
        // Some steps are blocked by failed dependencies
        const remainingSteps = workflowSteps.filter(step => !completedSteps.has(step.id));
        
        this.logger.error('Workflow execution blocked', {
          completed: completedSteps.size,
          total: workflowSteps.length,
          failed: failedSteps.size,
          remaining: remainingSteps.map(s => s.id)
        });
        
        // Mark all remaining steps as failed due to dependencies
        for (const step of remainingSteps) {
          results[step.id] = {
            success: false,
            duration: 0,
            error: new Error('Step blocked due to failed dependencies')
          };
        }
        
        break;
      }

      // Execute ready steps in parallel
      const stepResults: TaskResult<any>[] = await this.executor.scheduleAll(
        readySteps.map(step => [
          step.id,
          async () => {
            this.logger.info(`Executing step: ${step.name} (${step.id})`);
            return await step.execute();
          },
          step.priority || 0
        ])
      );

      // Process results
      for (const result of stepResults) {
        completedSteps.add(result.id);
        
        results[result.id] = {
          success: result.success,
          duration: result.duration,
          result: result.result,
          error: result.error
        };
        
        if (!result.success) {
          failedSteps.add(result.id);
          this.logger.error(`Step failed: ${result.id}`, { error: result.error?.message });
          
          // If fail-fast is enabled and a step failed, abort workflow
          if (this.config.failFast) {
            this.logger.warn('Fail-fast enabled, aborting workflow');
            
            // Mark all remaining steps as skipped
            const remainingSteps = workflowSteps.filter(step => 
              !completedSteps.has(step.id)
            );
            
            for (const step of remainingSteps) {
              results[step.id] = {
                success: false,
                duration: 0,
                error: new Error('Step skipped due to previous failure (fail-fast enabled)')
              };
              completedSteps.add(step.id);
            }
            
            break;
          }
        } else {
          this.logger.info(`Step completed successfully: ${result.id}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    const success = failedSteps.size === 0;
    
    this.logger.info(`Workflow execution completed in ${duration}ms`, {
      success,
      completedSteps: completedSteps.size,
      failedSteps: failedSteps.size
    });
    
    return {
      success,
      steps: results,
      duration
    };
  }

  /**
   * Get the current status of the executor
   * @returns Executor status
   */
  public getStatus() {
    return this.executor.getStatus();
  }

  /**
   * Shut down the workflow distributor
   * @param waitForActive Whether to wait for active tasks to complete
   */
  public async shutdown(waitForActive: boolean = true): Promise<void> {
    await this.executor.shutdown(waitForActive);
  }

  /**
   * Build a dependency graph from workflow steps
   * @param steps Workflow steps
   * @returns Dependency graph (map of step ID to array of dependency IDs)
   */
  private buildDependencyGraph(steps: WorkflowStep[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // Map all steps and their dependencies
    for (const step of steps) {
      graph.set(step.id, step.dependencies || []);
    }
    
    return graph;
  }

  /**
   * Validate the dependency graph (check for cycles)
   * @param graph Dependency graph
   * @throws Error if a cycle is detected
   */
  private validateDependencyGraph(graph: Map<string, string[]>): void {
    // Set of visited steps
    const visited = new Set<string>();
    
    // Set of steps in the current recursion stack
    const recursionStack = new Set<string>();
    
    // DFS to detect cycles
    const detectCycle = (stepId: string): boolean => {
      // Already visited and not in recursion stack
      if (visited.has(stepId) && !recursionStack.has(stepId)) {
        return false;
      }
      
      // Already in recursion stack (cycle detected)
      if (recursionStack.has(stepId)) {
        return true;
      }
      
      // Add to visited and recursion stack
      visited.add(stepId);
      recursionStack.add(stepId);
      
      // Check dependencies
      const dependencies = graph.get(stepId) || [];
      for (const depId of dependencies) {
        if (detectCycle(depId)) {
          return true;
        }
      }
      
      // Remove from recursion stack
      recursionStack.delete(stepId);
      return false;
    };
    
    // Check each step
    for (const stepId of graph.keys()) {
      if (detectCycle(stepId)) {
        throw new Error(`Cycle detected in workflow dependencies involving step: ${stepId}`);
      }
    }
  }

  /**
   * Check if all dependencies for a step are satisfied
   * @param step The workflow step
   * @param completedSteps Set of completed step IDs
   * @param failedSteps Set of failed step IDs
   * @returns Whether all dependencies are satisfied
   */
  private areDependenciesSatisfied(
    step: WorkflowStep,
    completedSteps: Set<string>,
    failedSteps: Set<string>
  ): boolean {
    // No dependencies, always satisfied
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }
    
    // Check each dependency
    for (const depId of step.dependencies) {
      // If dependency failed, step can never be satisfied
      if (failedSteps.has(depId)) {
        return false;
      }
      
      // If dependency not completed, step not ready
      if (!completedSteps.has(depId)) {
        return false;
      }
    }
    
    // All dependencies satisfied
    return true;
  }
}