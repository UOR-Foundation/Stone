/**
 * Script to fix the Jest configuration error 
 * "Option: extensionsToTreatAsEsm: ['.ts', '.tsx', '.mjs'] includes '.mjs' which is always treated as an ECMAScript Module."
 */

const fs = require('fs');
const path = require('path');

const jestConfigPath = path.join(__dirname, 'jest.config.js');

// Read the current configuration
let config = fs.readFileSync(jestConfigPath, 'utf8');

// Check if extensionsToTreatAsEsm includes '.mjs'
if (config.includes("extensionsToTreatAsEsm")) {
  console.log('Found extensionsToTreatAsEsm in jest.config.js');
  
  // Remove the entire extensionsToTreatAsEsm line if it includes '.mjs'
  if (config.includes("'.mjs'")) {
    console.log('Found .mjs in extensionsToTreatAsEsm, removing it');
    config = config.replace(/\s*extensionsToTreatAsEsm:.*\],/g, '');
    
    // Save the updated configuration
    fs.writeFileSync(jestConfigPath, config, 'utf8');
    console.log('Successfully updated jest.config.js');
  } else {
    console.log('No .mjs found in extensionsToTreatAsEsm');
  }
} else {
  console.log('No extensionsToTreatAsEsm found in jest.config.js');
}

// Verify the test setup file exists
const setupPath = path.join(__dirname, 'test', 'setup.js');
if (fs.existsSync(setupPath)) {
  console.log('Test setup file exists at ' + setupPath);
} else {
  console.log('Test setup file not found at ' + setupPath);
  // Create a basic setup file if it doesn't exist
  fs.writeFileSync(setupPath, `// Basic Jest testing setup
const sinon = require('sinon');

// Setup global testing objects
global.sinon = sinon;

// Set up test environment variables
process.env.NODE_ENV = 'test';`, 'utf8');
  console.log('Created basic test setup file');
}

console.log('Fix complete!');