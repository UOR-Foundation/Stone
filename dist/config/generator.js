"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigGenerator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const loader_1 = require("./loader");
const analyzer_1 = require("./analyzer");
class ConfigGenerator {
    constructor(repositoryPath) {
        this.repositoryPath = repositoryPath || process.cwd();
        this.configLoader = new loader_1.ConfigLoader(path_1.default.join(this.repositoryPath, 'stone.config.json'));
        this.analyzer = new analyzer_1.RepositoryAnalyzer(this.repositoryPath);
    }
    /**
     * Generate a default configuration based on repository analysis
     */
    async generate(owner, name) {
        // Analyze repository structure
        const packages = await this.analyzer.analyzePackages();
        // Create default configuration
        const config = {
            repository: {
                owner,
                name,
            },
            packages,
            workflow: {
                issueTemplate: 'stone-feature.md',
                stoneLabel: 'stone-process',
                useWebhooks: true,
                testCommand: 'npm test',
                timeoutMinutes: 30,
            },
            github: {
                actionsDirectory: '.github/workflows',
                issueTemplateDirectory: '.github/ISSUE_TEMPLATE',
                stoneDirectory: '.github/stone',
            },
            roles: {
                pm: {
                    enabled: true,
                    claudeFile: 'PM.CLAUDE.md',
                },
                qa: {
                    enabled: true,
                    claudeFile: 'QA.CLAUDE.md',
                },
                feature: {
                    enabled: true,
                    claudeFile: 'FEATURE.CLAUDE.md',
                },
                auditor: {
                    enabled: true,
                    claudeFile: 'AUDITOR.CLAUDE.md',
                },
                actions: {
                    enabled: true,
                    claudeFile: 'ACTIONS.CLAUDE.md',
                },
            },
        };
        // Save the configuration
        await this.configLoader.save(config);
        return config;
    }
    /**
     * Create the directory structure for Stone
     */
    async createDirectories(config) {
        const directories = [
            path_1.default.join(this.repositoryPath, config.github.stoneDirectory),
            path_1.default.join(this.repositoryPath, config.github.actionsDirectory),
            path_1.default.join(this.repositoryPath, config.github.issueTemplateDirectory),
        ];
        for (const dir of directories) {
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
        }
    }
}
exports.ConfigGenerator = ConfigGenerator;
