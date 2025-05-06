#!/usr/bin/env node

/**
 * Script to trigger schema validation using Stone
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const contentDir = path.resolve(process.env.HOME + '/repos/uorcontent/converted');
const templateDir = path.resolve(process.env.HOME + '/repos/uorcontent/templates');
const specPath = path.resolve(process.env.HOME + '/repos/uorcontent/converted/openapi-spec.json');

console.log('Creating a GitHub issue for schema validation...');

const issueBodyPath = path.resolve('/tmp/SCHEMA_VALIDATION_ISSUE.md');

const issueBody = `
## Validation Request

- Content directory: ${contentDir}
- Template directory: ${templateDir}
- Schema specification: ${specPath}

## Additional Instructions

- Validate all content files against the OpenAPI specification
- Check for Schema.org compliance
- Generate a detailed validation report

## Expected Results

- All content should conform to the Schema.org templates
- No validation errors or warnings should be reported
`;

fs.writeFileSync(issueBodyPath, issueBody);

try {
  const issueCommand = `gh issue create --repo UOR-Foundation/uorcontent --title "[VALIDATE] Schema Validation for UOR Content" --body-file ${issueBodyPath} --label "stone-process,schema-validation"`;
  const result = execSync(issueCommand, { encoding: 'utf8' });
  console.log('Issue created successfully:', result);
  
  const issueNumber = result.match(/\/issues\/(\d+)/);
  
  if (issueNumber && issueNumber[1]) {
    console.log(`Processing issue #${issueNumber[1]} with Stone...`);
    const stoneCommand = `npx stone process --issue ${issueNumber[1]}`;
    execSync(stoneCommand, { encoding: 'utf8', stdio: 'inherit' });
  } else {
    console.error('Could not extract issue number from result:', result);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
