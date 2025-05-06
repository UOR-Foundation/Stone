import { ExternalTool } from '../../../src/integration/external-tool';

/**
 * OpenAPI Validator Tool for UOR Content
 * Uses the existing OpenAPI validator from the uorcontent repository
 */
export const openApiValidatorTool: ExternalTool = {
  id: 'openapi-validator',
  name: 'OpenAPI Schema Validator',
  description: 'Validates UOR content against OpenAPI specifications and Schema.org templates',
  command: 'node',
  args: [
    '~/repos/uorcontent/utils/validate-openapi.js',
    '--spec', '~/repos/uorcontent/converted/openapi-spec.json',
    '--content', '~/repos/uorcontent/converted',
    '--verbose',
    '--summary'
  ],
  parseOutput: (output: string) => {
    const summary: {
      totalValidated: number;
      valid: number;
      invalid: number;
      errors: string[];
      warnings: string[];
    } = {
      totalValidated: 0,
      valid: 0,
      invalid: 0,
      errors: [],
      warnings: []
    };
    
    const summaryMatch = output.match(/Validated (\d+) items, (\d+) valid, (\d+) invalid/);
    if (summaryMatch) {
      summary.totalValidated = parseInt(summaryMatch[1], 10);
      summary.valid = parseInt(summaryMatch[2], 10);
      summary.invalid = parseInt(summaryMatch[3], 10);
    }
    
    const errorLines = output.match(/ERROR:.+/g) || [];
    summary.errors = errorLines.map(line => line.replace('ERROR: ', ''));
    
    const warningLines = output.match(/WARNING:.+/g) || [];
    summary.warnings = warningLines.map(line => line.replace('WARNING: ', ''));
    
    return summary;
  }
};
