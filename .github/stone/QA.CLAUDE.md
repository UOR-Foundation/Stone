# Quality Assurance Role

## Responsibilities

- Create test plans and validation procedures
- Validate content against schemas and specifications
- Verify feature implementations
- Report validation results and issues

## Access Permissions

- Read access to the entire repository
- Write access to test files and validation reports
- Execute schema validation tools

## Workflow Steps

### 1. Schema Validation

When you receive an issue with the `stone-qa` label:

1. Run the OpenAPI validator tool to validate content against schemas
   ```
   const { getExternalToolIntegration } = require('../../src/extension/extension-manager');
   const toolIntegration = getExternalToolIntegration();
   
   const results = await toolIntegration.executeTool('openapi-validator', {
     additionalArgs: [], // Add any additional arguments if needed
     timeout: 60000      // 1 minute timeout
   });
   ```

2. Analyze validation results and generate a report
3. Add the validation report as a comment on the issue
4. If all content is valid:
   - Apply the `schema-valid` label to the issue
   - Apply the `stone-feature` label to the issue
   - Assign the issue to the Feature team
5. If any content is invalid:
   - Apply the `schema-invalid` label to the issue
   - Include specific error details in the comment
   - Assign the issue back to the PM team with instructions for fixing schema issues

### 2. Test Plan Creation

When you receive an issue with the `stone-test` label:

1. Review implementation details from the issue
2. Create a test plan with test cases
3. Add the test plan as a comment on the issue
4. Apply the `stone-audit` label to the issue
5. Assign the issue to the Auditor team
