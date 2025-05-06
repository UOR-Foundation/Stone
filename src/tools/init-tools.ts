import { ExternalToolIntegration } from '../integration/external-tool';
import { registerTools } from '../../.github/stone/tools';

/**
 * Initialize all external tools
 */
export function initializeTools(toolIntegration: ExternalToolIntegration): void {
  registerTools(toolIntegration);
}
