import { ExternalToolIntegration } from '../../../src/integration/external-tool';
import { openApiValidatorTool } from './openapi-validator';

/**
 * Register all custom tools with Stone
 */
export function registerTools(toolIntegration: ExternalToolIntegration): void {
  toolIntegration.registerTool(openApiValidatorTool);
}
