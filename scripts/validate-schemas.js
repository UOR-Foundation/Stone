#!/usr/bin/env node

/**
 * Script to directly run schema validation on UOR content
 * This script uses the OpenAPI validator from the UOR Content repository
 * to validate content against schemas without requiring GitHub issues
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const contentDir = path.resolve(process.env.HOME + '/repos/uorcontent/converted');
const templateDir = path.resolve(process.env.HOME + '/repos/uorcontent/templates');
const specPath = path.resolve(process.env.HOME + '/repos/uorcontent/converted/openapi-spec.json');
const validatorPath = path.resolve(process.env.HOME + '/repos/uorcontent/utils/validate-openapi.js');

console.log('Running schema validation on UOR content...');
console.log(`Content directory: ${contentDir}`);
console.log(`Template directory: ${templateDir}`);
console.log(`Schema specification: ${specPath}`);
console.log(`Validator: ${validatorPath}`);

try {
  console.log('\nRunning OpenAPI validator...');
  const validatorCommand = `node ${validatorPath} --spec ${specPath} --content ${contentDir} --verbose`;
  
  const result = execSync(validatorCommand, { encoding: 'utf8' });
  console.log('\nValidation Results:');
  console.log(result);
  
  const totalMatch = result.match(/Total items: (\d+)/);
  const validMatch = result.match(/Valid: (\d+)/);
  const invalidMatch = result.match(/Invalid: (\d+)/);
  
  if (totalMatch && validMatch && invalidMatch) {
    const totalValidated = parseInt(totalMatch[1], 10);
    const valid = parseInt(validMatch[1], 10);
    const invalid = parseInt(invalidMatch[1], 10);
    
    console.log('\nSummary:');
    console.log(`Total validated: ${totalValidated}`);
    console.log(`Valid: ${valid}`);
    console.log(`Invalid: ${invalid}`);
    
    if (invalid === 0) {
      console.log('\nValidation successful! All content conforms to schemas.');
      process.exit(0);
    } else {
      console.error('\nValidation failed! Some content does not conform to schemas.');
      process.exit(1);
    }
  } else {
    if (result.includes('All items validate against the OpenAPI specification!')) {
      console.log('\nValidation successful! All content conforms to schemas.');
      process.exit(0);
    } else if (result.includes('Validation FAILED')) {
      console.error('\nValidation failed! Some content does not conform to schemas.');
      process.exit(1);
    } else {
      console.error('Could not parse validation results.');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('Error running validation:', error.message);
  process.exit(1);
}
