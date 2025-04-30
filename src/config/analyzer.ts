import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

/**
 * Package information interface
 */
export interface PackageInfo {
  name: string;
  path: string;
  team: string;
  dependencies?: string[];
}

/**
 * Analyzes repository structure for configuration generation
 */
export class RepositoryAnalyzer {
  private repositoryPath: string;
  private logger: Logger;

  /**
   * Create a new repository analyzer
   * @param repositoryPath Path to the repository (defaults to current directory)
   */
  constructor(repositoryPath?: string) {
    this.repositoryPath = repositoryPath || process.cwd();
    this.logger = new Logger();
  }

  /**
   * Analyze repository structure to detect packages
   * @returns Array of package information
   */
  public async analyzePackages(): Promise<PackageInfo[]> {
    try {
      this.logger.info(`Analyzing packages in repository: ${this.repositoryPath}`);
      const packages: PackageInfo[] = [];
      
      // Check for packages directory (monorepo structure)
      const packagesDir = path.join(this.repositoryPath, 'packages');
      if (fs.existsSync(packagesDir) && fs.statSync(packagesDir).isDirectory()) {
        this.logger.info('Found packages directory, analyzing monorepo structure');
        
        // Read package directories
        const packageDirs = fs.readdirSync(packagesDir);
        this.logger.info(`Found ${packageDirs.length} potential packages in packages directory`);
        
        for (const pkgDir of packageDirs) {
          const pkgPath = path.join(packagesDir, pkgDir);
          
          if (fs.statSync(pkgPath).isDirectory()) {
            // Check if it has a package.json
            const packageJsonPath = path.join(pkgPath, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
              try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const packageName = packageJson.name || pkgDir;
                
                this.extractDependencies(packageJson);
                
                packages.push({
                  name: packageName,
                  path: `packages/${pkgDir}`,
                  team: `team-${pkgDir}`,
                });
                
                this.logger.info(`Added package: ${packageName} at packages/${pkgDir}`);
              } catch (error) {
                this.logger.warning(`Error parsing package.json for ${pkgDir}: ${error instanceof Error ? error.message : String(error)}`);
                
                // If package.json can't be parsed, use directory name
                packages.push({
                  name: pkgDir,
                  path: `packages/${pkgDir}`,
                  team: `team-${pkgDir}`,
                });
                
                this.logger.info(`Added package with fallback name: ${pkgDir} at packages/${pkgDir}`);
              }
            } else {
              this.logger.info(`No package.json found for ${pkgDir}, using directory name`);
              
              // No package.json, use directory name
              packages.push({
                name: pkgDir,
                path: `packages/${pkgDir}`,
                team: `team-${pkgDir}`,
              });
            }
          }
        }
      } else {
        this.logger.info('No packages directory found, analyzing single package structure');
        
        // No packages directory found, use repository root as a single package
        const rootPackageJson = path.join(this.repositoryPath, 'package.json');
        
        if (fs.existsSync(rootPackageJson)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
            const packageName = packageJson.name || path.basename(this.repositoryPath);
            
            this.extractDependencies(packageJson);
            
            packages.push({
              name: packageName,
              path: '.',
              team: 'core-team',
            });
            
            this.logger.info(`Added root package: ${packageName}`);
          } catch (error) {
            this.logger.warning(`Error parsing root package.json: ${error instanceof Error ? error.message : String(error)}`);
            
            // If package.json can't be parsed, use directory name
            packages.push({
              name: path.basename(this.repositoryPath),
              path: '.',
              team: 'core-team',
            });
            
            this.logger.info(`Added root package with fallback name: ${path.basename(this.repositoryPath)}`);
          }
        } else {
          this.logger.info('No package.json found in repository root, using directory name');
          
          // No package.json, use repository directory name
          packages.push({
            name: path.basename(this.repositoryPath),
            path: '.',
            team: 'core-team',
          });
        }
      }
      
      this.logger.success(`Successfully analyzed packages: found ${packages.length} packages`);
      return packages;
    } catch (error) {
      this.logger.error(`Error analyzing packages: ${error instanceof Error ? error.message : String(error)}`);
      
      return [{
        name: path.basename(this.repositoryPath),
        path: '.',
        team: 'core-team',
      }];
    }
  }

  /**
   * Detect test framework used in the repository
   * @returns Name of the detected test framework
   */
  public async detectTestFramework(): Promise<string> {
    try {
      this.logger.info('Detecting test framework');
      const packageJsonPath = path.join(this.repositoryPath, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const devDependencies = packageJson.devDependencies || {};
          const dependencies = packageJson.dependencies || {};
          
          // Check for common test frameworks
          if (devDependencies.jest || dependencies.jest) {
            this.logger.info('Detected test framework: jest');
            return 'jest';
          } else if (devDependencies.mocha || dependencies.mocha) {
            this.logger.info('Detected test framework: mocha');
            return 'mocha';
          } else if (devDependencies.ava || dependencies.ava) {
            this.logger.info('Detected test framework: ava');
            return 'ava';
          } else if (devDependencies.jasmine || dependencies.jasmine) {
            this.logger.info('Detected test framework: jasmine');
            return 'jasmine';
          } else if (devDependencies.vitest || dependencies.vitest) {
            this.logger.info('Detected test framework: vitest');
            return 'vitest';
          } else if (devDependencies.tape || dependencies.tape) {
            this.logger.info('Detected test framework: tape');
            return 'tape';
          }
          
          // Check for test scripts in package.json
          if (packageJson.scripts) {
            const testScript = packageJson.scripts.test || '';
            if (testScript.includes('jest')) {
              this.logger.info('Detected test framework from scripts: jest');
              return 'jest';
            } else if (testScript.includes('mocha')) {
              this.logger.info('Detected test framework from scripts: mocha');
              return 'mocha';
            } else if (testScript.includes('ava')) {
              this.logger.info('Detected test framework from scripts: ava');
              return 'ava';
            } else if (testScript.includes('jasmine')) {
              this.logger.info('Detected test framework from scripts: jasmine');
              return 'jasmine';
            } else if (testScript.includes('vitest')) {
              this.logger.info('Detected test framework from scripts: vitest');
              return 'vitest';
            } else if (testScript.includes('tape')) {
              this.logger.info('Detected test framework from scripts: tape');
              return 'tape';
            }
          }
        } catch (error) {
          this.logger.warning(`Error parsing package.json for test framework detection: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Check for config files
      if (fs.existsSync(path.join(this.repositoryPath, 'jest.config.js')) || 
          fs.existsSync(path.join(this.repositoryPath, 'jest.config.ts')) ||
          fs.existsSync(path.join(this.repositoryPath, 'jest.config.json'))) {
        this.logger.info('Detected test framework from config file: jest');
        return 'jest';
      } else if (fs.existsSync(path.join(this.repositoryPath, '.mocharc.js')) ||
                fs.existsSync(path.join(this.repositoryPath, '.mocharc.json')) ||
                fs.existsSync(path.join(this.repositoryPath, 'mocha.opts'))) {
        this.logger.info('Detected test framework from config file: mocha');
        return 'mocha';
      } else if (fs.existsSync(path.join(this.repositoryPath, 'ava.config.js')) ||
                fs.existsSync(path.join(this.repositoryPath, 'ava.config.cjs'))) {
        this.logger.info('Detected test framework from config file: ava');
        return 'ava';
      } else if (fs.existsSync(path.join(this.repositoryPath, 'jasmine.json'))) {
        this.logger.info('Detected test framework from config file: jasmine');
        return 'jasmine';
      } else if (fs.existsSync(path.join(this.repositoryPath, 'vitest.config.js')) ||
                fs.existsSync(path.join(this.repositoryPath, 'vitest.config.ts'))) {
        this.logger.info('Detected test framework from config file: vitest');
        return 'vitest';
      }
      
      this.logger.info('No specific test framework detected, defaulting to jest');
      return 'jest';
    } catch (error) {
      this.logger.error(`Error detecting test framework: ${error instanceof Error ? error.message : String(error)}`);
      return 'jest';
    }
  }
  
  /**
   * Detect linting tools used in the repository
   * @returns Array of detected linting tools
   */
  public async detectLintingTools(): Promise<string[]> {
    try {
      this.logger.info('Detecting linting tools');
      const lintingTools: string[] = [];
      
      // Check for common linting config files
      if (fs.existsSync(path.join(this.repositoryPath, '.eslintrc.js')) || 
          fs.existsSync(path.join(this.repositoryPath, '.eslintrc.json')) ||
          fs.existsSync(path.join(this.repositoryPath, '.eslintrc.yml')) ||
          fs.existsSync(path.join(this.repositoryPath, '.eslintrc'))) {
        lintingTools.push('eslint');
        this.logger.info('Detected linting tool: eslint');
      }
      
      if (fs.existsSync(path.join(this.repositoryPath, '.prettierrc.js')) || 
          fs.existsSync(path.join(this.repositoryPath, '.prettierrc.json')) ||
          fs.existsSync(path.join(this.repositoryPath, '.prettierrc.yml')) ||
          fs.existsSync(path.join(this.repositoryPath, '.prettierrc'))) {
        lintingTools.push('prettier');
        this.logger.info('Detected linting tool: prettier');
      }
      
      if (fs.existsSync(path.join(this.repositoryPath, 'tslint.json'))) {
        lintingTools.push('tslint');
        this.logger.info('Detected linting tool: tslint');
      }
      
      const packageJsonPath = path.join(this.repositoryPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const devDependencies = packageJson.devDependencies || {};
          const dependencies = packageJson.dependencies || {};
          
          if (devDependencies.eslint || dependencies.eslint) {
            if (!lintingTools.includes('eslint')) {
              lintingTools.push('eslint');
              this.logger.info('Detected linting tool from dependencies: eslint');
            }
          }
          
          if (devDependencies.prettier || dependencies.prettier) {
            if (!lintingTools.includes('prettier')) {
              lintingTools.push('prettier');
              this.logger.info('Detected linting tool from dependencies: prettier');
            }
          }
          
          if (devDependencies.tslint || dependencies.tslint) {
            if (!lintingTools.includes('tslint')) {
              lintingTools.push('tslint');
              this.logger.info('Detected linting tool from dependencies: tslint');
            }
          }
          
          if (devDependencies.stylelint || dependencies.stylelint) {
            lintingTools.push('stylelint');
            this.logger.info('Detected linting tool from dependencies: stylelint');
          }
        } catch (error) {
          this.logger.warning(`Error parsing package.json for linting tools detection: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (lintingTools.length === 0) {
        this.logger.info('No linting tools detected');
      } else {
        this.logger.success(`Detected ${lintingTools.length} linting tools: ${lintingTools.join(', ')}`);
      }
      
      return lintingTools;
    } catch (error) {
      this.logger.error(`Error detecting linting tools: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Extract dependencies from package.json
   * @param packageJson Parsed package.json content
   * @returns Array of dependency names
   */
  private extractDependencies(packageJson: any): string[] {
    try {
      const dependencies: string[] = [];
      
      if (packageJson.dependencies) {
        dependencies.push(...Object.keys(packageJson.dependencies));
      }
      
      if (packageJson.devDependencies) {
        dependencies.push(...Object.keys(packageJson.devDependencies));
      }
      
      if (packageJson.peerDependencies) {
        dependencies.push(...Object.keys(packageJson.peerDependencies));
      }
      
      return dependencies;
    } catch (error) {
      this.logger.warning(`Error extracting dependencies: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Detect documentation tools used in the repository
   * @returns Array of detected documentation tools
   */
  public async detectDocumentationTools(): Promise<string[]> {
    try {
      this.logger.info('Detecting documentation tools');
      const docTools: string[] = [];
      
      // Check for common documentation config files
      if (fs.existsSync(path.join(this.repositoryPath, 'typedoc.json')) || 
          fs.existsSync(path.join(this.repositoryPath, 'typedoc.js'))) {
        docTools.push('typedoc');
        this.logger.info('Detected documentation tool: typedoc');
      }
      
      if (fs.existsSync(path.join(this.repositoryPath, 'jsdoc.json')) || 
          fs.existsSync(path.join(this.repositoryPath, 'jsdoc.js')) ||
          fs.existsSync(path.join(this.repositoryPath, '.jsdoc.json'))) {
        docTools.push('jsdoc');
        this.logger.info('Detected documentation tool: jsdoc');
      }
      
      if (fs.existsSync(path.join(this.repositoryPath, 'mkdocs.yml'))) {
        docTools.push('mkdocs');
        this.logger.info('Detected documentation tool: mkdocs');
      }
      
      if (fs.existsSync(path.join(this.repositoryPath, 'docusaurus.config.js'))) {
        docTools.push('docusaurus');
        this.logger.info('Detected documentation tool: docusaurus');
      }
      
      const packageJsonPath = path.join(this.repositoryPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const devDependencies = packageJson.devDependencies || {};
          const dependencies = packageJson.dependencies || {};
          
          if (devDependencies.typedoc || dependencies.typedoc) {
            if (!docTools.includes('typedoc')) {
              docTools.push('typedoc');
              this.logger.info('Detected documentation tool from dependencies: typedoc');
            }
          }
          
          if (devDependencies.jsdoc || dependencies.jsdoc) {
            if (!docTools.includes('jsdoc')) {
              docTools.push('jsdoc');
              this.logger.info('Detected documentation tool from dependencies: jsdoc');
            }
          }
          
          if (devDependencies.docusaurus || dependencies.docusaurus || 
              devDependencies['@docusaurus/core'] || dependencies['@docusaurus/core']) {
            if (!docTools.includes('docusaurus')) {
              docTools.push('docusaurus');
              this.logger.info('Detected documentation tool from dependencies: docusaurus');
            }
          }
        } catch (error) {
          this.logger.warning(`Error parsing package.json for documentation tools detection: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (docTools.length === 0) {
        this.logger.info('No documentation tools detected');
      } else {
        this.logger.success(`Detected ${docTools.length} documentation tools: ${docTools.join(', ')}`);
      }
      
      return docTools;
    } catch (error) {
      this.logger.error(`Error detecting documentation tools: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
