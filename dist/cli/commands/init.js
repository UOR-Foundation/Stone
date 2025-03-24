"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const config_1 = require("../../config");
const github_1 = require("../../github");
const claude_1 = require("../../claude");
const logger_1 = require("../../utils/logger");
const templates_1 = require("../../github/templates");
const labels_1 = require("../../github/labels");
const client_1 = require("../../github/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Logger instance
const logger = new logger_1.Logger();
function initCommand(program) {
    program
        .command('init')
        .description('Initialize Stone in the current repository')
        .option('-o, --owner <owner>', 'GitHub repository owner')
        .option('-n, --name <name>', 'GitHub repository name')
        .option('-t, --token <token>', 'GitHub token with repo and workflow permissions')
        .action(async (options) => {
        try {
            logger.info('Initializing Stone...');
            // Get GitHub owner and repo name
            let owner = options.owner;
            let name = options.name;
            // Try to get owner and name from git remote if not provided
            if (!owner || !name) {
                try {
                    const gitRemote = require('child_process')
                        .execSync('git remote get-url origin')
                        .toString()
                        .trim();
                    // Parse GitHub URL
                    const match = gitRemote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
                    if (match) {
                        owner = owner || match[1];
                        name = name || match[2];
                    }
                }
                catch (error) {
                    // Ignore if git command fails
                }
            }
            // Prompt for values if still not set
            if (!owner) {
                throw new Error('GitHub repository owner is required. Use --owner option.');
            }
            if (!name) {
                throw new Error('GitHub repository name is required. Use --name option.');
            }
            logger.info(`Repository: ${owner}/${name}`);
            // Set up GitHub authentication
            const auth = new github_1.GitHubAuth();
            // Get token from options, env, or stored credentials
            let token = options.token || await auth.getToken();
            if (!token) {
                throw new Error('GitHub token is required. Use --token option or set STONE_GITHUB_TOKEN environment variable.');
            }
            // Validate token
            const isValid = await auth.validateToken(token);
            if (!isValid) {
                throw new Error('Invalid GitHub token or insufficient permissions. Token needs repo and workflow scopes.');
            }
            // Save token for future use
            await auth.saveToken(token);
            // Generate configuration
            const generator = new config_1.ConfigGenerator();
            const config = await generator.generate(owner, name);
            // Create necessary directories
            await generator.createDirectories(config);
            // Create GitHub client
            const client = new client_1.GitHubClient(token, config);
            // Create labels
            const labelManager = new labels_1.LabelManager(client, config);
            await labelManager.createLabels();
            logger.info('Created Stone labels in the repository');
            // Create issue templates
            const templateGenerator = new templates_1.IssueTemplateGenerator(client, config);
            await templateGenerator.createIssueTemplates();
            logger.info('Created issue templates in the repository');
            // Create Claude files for each role
            const claudeGenerator = new claude_1.ClaudeFileGenerator(config);
            await claudeGenerator.generateClaudeFiles();
            logger.info('Created Claude files for each role');
            // Create README file
            const readmePath = path.join(process.cwd(), '.github', 'stone', 'README.md');
            const readmeContent = `# Stone Configuration

This directory contains the configuration files for the Stone software factory.

## Files

- \`stone.config.json\`: Main configuration file
- \`PM.CLAUDE.md\`: Claude Code instructions for the PM role
- \`QA.CLAUDE.md\`: Claude Code instructions for the QA role
- \`FEATURE.CLAUDE.md\`: Claude Code instructions for Feature teams
- \`AUDITOR.CLAUDE.md\`: Claude Code instructions for the Auditor role
- \`ACTIONS.CLAUDE.md\`: Claude Code instructions for the GitHub Actions team

## Usage

Stone processes GitHub issues with the \`${config.workflow.stoneLabel}\` label.
`;
            fs.writeFileSync(readmePath, readmeContent, 'utf8');
            logger.success('Stone initialized successfully!');
            logger.info('You can now create issues with the stone-feature template and add the stone-process label to start the workflow.');
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error(`Initialization failed: ${error.message}`);
                process.exit(1);
            }
        }
    });
}
