const fs = require('fs');
const path = require('path');

// Directories to process
const dirs = [
  './src/security',
  './src/performance',
  './src/scalability',
  './src/services'
];

// Regular expression to find error handlers
const errorPattern = /catch\s*\(\s*error\s*\)\s*\{([^}]*?)error\.message/g;
const fixedPattern = 'catch (error: unknown) {$1error instanceof Error ? error.message : String(error)';

// Function to process files in a directory
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.ts')) {
      fixErrorsInFile(filePath);
    }
  });
}

// Function to fix errors in a file
function fixErrorsInFile(filePath) {
  console.log(`Processing ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace catch (error) with catch (error: unknown) and handle error.message safely
  let newContent = content.replace(errorPattern, fixedPattern);
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log(`  Updated ${filePath}`);
  } else {
    console.log(`  No changes to ${filePath}`);
  }
}

// Process all directories
dirs.forEach(processDirectory);