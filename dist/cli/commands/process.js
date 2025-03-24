"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCommand = processCommand;
const config_1 = require("../../config");
const github_1 = require("../../github");
const logger_1 = require("../../utils/logger");
// Logger instance
const logger = new logger_1.Logger();
function processCommand(program) {
    program
        .command('process')
        .description('Process a Stone issue')
        .requiredOption('-i, --issue <number>', 'Issue number to process')
        .action(async (options) => {
        try {
            const issueNumber = parseInt(options.issue, 10);
            if (isNaN(issueNumber) || issueNumber <= 0) {
                throw new Error('Invalid issue number');
            }
            logger.info(`Processing issue #${issueNumber}...`);
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
            // Process the issue
            const stage = await issueManager.processIssue(issueNumber);
            logger.success(`Issue #${issueNumber} processed successfully!`);
            logger.info(`Current stage: ${stage}`);
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to process issue: ${error.message}`);
                process.exit(1);
            }
        }
    });
}
