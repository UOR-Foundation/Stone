/**
 * Interface defining a workflow extension point
 */
export interface WorkflowExtensionPoint {
  id: string;
  description: string;
  priority: number;
}

/**
 * Interface defining a custom workflow step
 */
export interface CustomWorkflowStep {
  id: string;
  extensionPointId: string;
  priority: number;
  execute: (context: any) => Promise<any>;
}

/**
 * Class for managing workflow customization
 */
export class WorkflowCustomizer {
  private extensionPoints: Map<string, WorkflowExtensionPoint> = new Map();
  private customSteps: Map<string, CustomWorkflowStep> = new Map();
  private stepsByExtensionPoint: Map<string, Set<string>> = new Map();

  /**
   * Registers a workflow extension point
   */
  registerExtensionPoint(extensionPoint: WorkflowExtensionPoint): void {
    if (this.extensionPoints.has(extensionPoint.id)) {
      throw new Error(`Extension point with ID "${extensionPoint.id}" is already registered`);
    }

    this.extensionPoints.set(extensionPoint.id, extensionPoint);
    this.stepsByExtensionPoint.set(extensionPoint.id, new Set());
  }

  /**
   * Gets an extension point by ID
   */
  getExtensionPoint(id: string): WorkflowExtensionPoint | undefined {
    return this.extensionPoints.get(id);
  }

  /**
   * Registers a custom workflow step at an extension point
   */
  registerCustomStep(step: CustomWorkflowStep): void {
    if (!this.extensionPoints.has(step.extensionPointId)) {
      throw new Error(`Extension point "${step.extensionPointId}" does not exist`);
    }

    if (this.customSteps.has(step.id)) {
      throw new Error(`Custom step with ID "${step.id}" is already registered`);
    }

    this.customSteps.set(step.id, step);
    this.stepsByExtensionPoint.get(step.extensionPointId)?.add(step.id);
  }

  /**
   * Gets a custom step by ID
   */
  getCustomStep(id: string): CustomWorkflowStep | undefined {
    return this.customSteps.get(id);
  }

  /**
   * Removes a custom step by ID
   */
  removeCustomStep(id: string): boolean {
    const step = this.customSteps.get(id);
    if (step) {
      this.stepsByExtensionPoint.get(step.extensionPointId)?.delete(id);
      return this.customSteps.delete(id);
    }
    return false;
  }

  /**
   * Gets all custom steps for an extension point
   */
  getStepsForExtensionPoint(extensionPointId: string): CustomWorkflowStep[] {
    const stepIds = this.stepsByExtensionPoint.get(extensionPointId) || new Set();
    const steps: CustomWorkflowStep[] = [];
    
    for (const id of stepIds) {
      const step = this.customSteps.get(id);
      if (step) {
        steps.push(step);
      }
    }
    
    // Sort by priority (higher number = higher priority)
    return steps.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Executes all custom steps for an extension point
   */
  async executeExtensionPoint(extensionPointId: string, context: any): Promise<any> {
    if (!this.extensionPoints.has(extensionPointId)) {
      return context; // Extension point doesn't exist, return unmodified context
    }

    const steps = this.getStepsForExtensionPoint(extensionPointId);
    let currentContext = { ...context };

    // Need to make sure the latest context is passed correctly to next steps
    for (const step of steps) {
      try {
        // Save the original input context for this step
        const inputContext = { ...currentContext };
        // Execute step with the input context, not the original context
        currentContext = await step.execute(inputContext);
      } catch (error) {
        console.error(`Error executing step "${step.id}" at extension point "${extensionPointId}": ${error.message}`);
      }
    }

    return currentContext;
  }

  /**
   * Gets all registered extension points
   */
  getAllExtensionPoints(): WorkflowExtensionPoint[] {
    return Array.from(this.extensionPoints.values());
  }
}

/**
 * Export necessary components
 */
export default {
  WorkflowCustomizer
};