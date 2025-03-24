import fs from 'fs';
import path from 'path';

export class RepositoryAnalyzer {
  private repositoryPath: string;

  constructor(repositoryPath?: string) {
    this.repositoryPath = repositoryPath || process.cwd();
  }

  /**
   * Analyze repository structure to detect packages
   */
  public async analyzePackages(): Promise<Array<{ name: string; path: string; team: string }>> {
    const packages: Array<{ name: string; path: string; team: string }> = [];
    
    // Check for packages directory
    const packagesDir = path.join(this.repositoryPath, 'packages');
    if (fs.existsSync(packagesDir) && fs.statSync(packagesDir).isDirectory()) {
      // Read package directories
      const packageDirs = fs.readdirSync(packagesDir);
      
      for (const pkgDir of packageDirs) {
        const pkgPath = path.join(packagesDir, pkgDir);
        
        if (fs.statSync(pkgPath).isDirectory()) {
          // Check if it has a package.json
          const packageJsonPath = path.join(pkgPath, 'package.json');
          
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              const packageName = packageJson.name || pkgDir;
              
              packages.push({
                name: packageName,
                path: `packages/${pkgDir}`,
                team: `team-${pkgDir}`,
              });
            } catch (error) {
              // If package.json can't be parsed, use directory name
              packages.push({
                name: pkgDir,
                path: `packages/${pkgDir}`,
                team: `team-${pkgDir}`,
              });
            }
          } else {
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
      // No packages directory found, use repository root as a single package
      const rootPackageJson = path.join(this.repositoryPath, 'package.json');
      
      if (fs.existsSync(rootPackageJson)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
          const packageName = packageJson.name || path.basename(this.repositoryPath);
          
          packages.push({
            name: packageName,
            path: '.',
            team: 'core-team',
          });
        } catch (error) {
          // If package.json can't be parsed, use directory name
          packages.push({
            name: path.basename(this.repositoryPath),
            path: '.',
            team: 'core-team',
          });
        }
      } else {
        // No package.json, use repository directory name
        packages.push({
          name: path.basename(this.repositoryPath),
          path: '.',
          team: 'core-team',
        });
      }
    }
    
    return packages;
  }

  /**
   * Detect test framework used in the repository
   */
  public async detectTestFramework(): Promise<string> {
    const packageJsonPath = path.join(this.repositoryPath, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const devDependencies = packageJson.devDependencies || {};
        const dependencies = packageJson.dependencies || {};
        
        // Check for common test frameworks
        if (devDependencies.jest || dependencies.jest) {
          return 'jest';
        } else if (devDependencies.mocha || dependencies.mocha) {
          return 'mocha';
        } else if (devDependencies.ava || dependencies.ava) {
          return 'ava';
        } else if (devDependencies.jasmine || dependencies.jasmine) {
          return 'jasmine';
        }
      } catch (error) {
        // Ignore errors reading package.json
      }
    }
    
    // Default to jest if no framework detected
    return 'jest';
  }
}