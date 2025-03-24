"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusCommand = statusCommand;
const config_1 = require("../../config");
const github_1 = require("../../github");
const logger_1 = require("../../utils/logger");
const chalk_1 = __importDefault(require("chalk"));
// Logger instance
const logger = new logger_1.Logger();
function statusCommand(program) {
    program
        .command('status')
        .description('Show status of Stone issues')
        .option('-a, --all', 'Show all issues, not just open ones')
        .action(async (options) => {
        try {
            // Load configuration
            const configLoader = new config_1.ConfigLoader();
            const config = await configLoader.load();
            // Set up GitHub authentication
            const auth = new github_1.GitHubAuth();
            const token = await auth.getToken();
            if (!token) {
                throw new Error('GitHub token is required. Use stone init to set up authentication.');
            }
            // Create GitHub client
            const client = new github_1.GitHubClient(token, config);
            const issueManager = new github_1.IssueManager(client, config);
            // Get Stone issues
            const stoneIssues = await issueManager.getStoneIssues();
            if (stoneIssues.data.length === 0) {
                logger.info('No Stone issues found.');
                return;
            }
            // Display issues
            logger.info(`Found ${stoneIssues.data.length} Stone issues:`);
            console.log('');
            for (const issue of stoneIssues.data) {
                // Get labels
                const labels = issue.labels.map((label) => {
                    return typeof label === 'string' ? label : label.name;
                }).filter(Boolean);
                // Determine current stage
                let stage = 'Unknown';
                let color = chalk_1.default.white;
                if (labels.includes(config.workflow.stoneLabel)) {
                    stage = 'Initial';
                    color = chalk_1.default.blue;
                }
                else if (labels.includes('stone-qa')) {
                    stage = 'QA';
                    color = chalk_1.default.red;
                }
                else if (labels.includes('stone-actions')) {
                    stage = 'Actions';
                    color = chalk_1.default.magenta;
                }
                else if (labels.includes('stone-feature-implement')) {
                    stage = 'Feature';
                    color = chalk_1.default.green;
                }
                else if (labels.includes('stone-audit')) {
                    stage = 'Audit';
                    color = chalk_1.default.yellow;
                }
                else if (labels.includes('stone-ready-for-tests')) {
                    stage = 'Testing';
                    color = chalk_1.default.cyan;
                }
                else if (labels.includes('stone-docs')) {
                    stage = 'Docs';
                    color = chalk_1.default.blue;
                }
                else if (labels.includes('stone-pr')) {
                    stage = 'PR';
                    color = chalk_1.default.magenta;
                }
                else if (labels.includes('stone-complete')) {
                    stage = 'Complete';
                    color = chalk_1.default.green;
                }
                else if (labels.includes('stone-error')) {
                    stage = 'Error';
                    color = chalk_1.default.red;
                }
                // Display issue
                console.log(`${color(`[${stage}]`)} #${issue.number}: ${issue.title}`);
                console.log(`  URL: ${issue.html_url}`);
                console.log(`  Labels: ${labels.join(', ')}`);
                console.log('');
            }
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to get status: ${error.message}`);
                process.exit(1);
            }
        }
    });
}
