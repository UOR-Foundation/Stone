"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryAnalyzer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class RepositoryAnalyzer {
    constructor(repositoryPath) {
        this.repositoryPath = repositoryPath || process.cwd();
    }
    /**
     * Analyze repository structure to detect packages
     */
    async analyzePackages() {
        const packages = [];
        // Check for packages directory
        const packagesDir = path_1.default.join(this.repositoryPath, 'packages');
        if (fs_1.default.existsSync(packagesDir) && fs_1.default.statSync(packagesDir).isDirectory()) {
            // Read package directories
            const packageDirs = fs_1.default.readdirSync(packagesDir);
            for (const pkgDir of packageDirs) {
                const pkgPath = path_1.default.join(packagesDir, pkgDir);
                if (fs_1.default.statSync(pkgPath).isDirectory()) {
                    // Check if it has a package.json
                    const packageJsonPath = path_1.default.join(pkgPath, 'package.json');
                    if (fs_1.default.existsSync(packageJsonPath)) {
                        try {
                            const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf8'));
                            const packageName = packageJson.name || pkgDir;
                            packages.push({
                                name: packageName,
                                path: `packages/${pkgDir}`,
                                team: `team-${pkgDir}`,
                            });
                        }
                        catch (error) {
                            // If package.json can't be parsed, use directory name
                            packages.push({
                                name: pkgDir,
                                path: `packages/${pkgDir}`,
                                team: `team-${pkgDir}`,
                            });
                        }
                    }
                    else {
                        // No package.json, use directory name
                        packages.push({
                            name: pkgDir,
                            path: `packages/${pkgDir}`,
                            team: `team-${pkgDir}`,
                        });
                    }
                }
            }
        }
        else {
            // No packages directory found, use repository root as a single package
            const rootPackageJson = path_1.default.join(this.repositoryPath, 'package.json');
            if (fs_1.default.existsSync(rootPackageJson)) {
                try {
                    const packageJson = JSON.parse(fs_1.default.readFileSync(rootPackageJson, 'utf8'));
                    const packageName = packageJson.name || path_1.default.basename(this.repositoryPath);
                    packages.push({
                        name: packageName,
                        path: '.',
                        team: 'core-team',
                    });
                }
                catch (error) {
                    // If package.json can't be parsed, use directory name
                    packages.push({
                        name: path_1.default.basename(this.repositoryPath),
                        path: '.',
                        team: 'core-team',
                    });
                }
            }
            else {
                // No package.json, use repository directory name
                packages.push({
                    name: path_1.default.basename(this.repositoryPath),
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
    async detectTestFramework() {
        const packageJsonPath = path_1.default.join(this.repositoryPath, 'package.json');
        if (fs_1.default.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf8'));
                const devDependencies = packageJson.devDependencies || {};
                const dependencies = packageJson.dependencies || {};
                // Check for common test frameworks
                if (devDependencies.jest || dependencies.jest) {
                    return 'jest';
                }
                else if (devDependencies.mocha || dependencies.mocha) {
                    return 'mocha';
                }
                else if (devDependencies.ava || dependencies.ava) {
                    return 'ava';
                }
                else if (devDependencies.jasmine || dependencies.jasmine) {
                    return 'jasmine';
                }
            }
            catch (error) {
                // Ignore errors reading package.json
            }
        }
        // Default to jest if no framework detected
        return 'jest';
    }
}
exports.RepositoryAnalyzer = RepositoryAnalyzer;
