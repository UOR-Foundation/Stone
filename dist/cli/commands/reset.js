"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCommand = resetCommand;
const config_1 = require("../../config");
const github_1 = require("../../github");
const logger_1 = require("../../utils/logger");
// Logger instance
const logger = new logger_1.Logger();
function resetCommand(program) {
    program
        .command('reset')
        .description('Reset a Stone issue to start over')
        .requiredOption('-i, --issue <number>', 'Issue number to reset')
        .action(async (options) => {
        try {
            const issueNumber = parseInt(options.issue, 10);
            if (isNaN(issueNumber) || issueNumber <= 0) {
                throw new Error('Invalid issue number');
            }
            logger.info(`Resetting issue #${issueNumber}...`);
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
            // Get all current labels
            const { data: issue } = await client.getIssue(issueNumber);
            // Remove all Stone labels
            const stoneLabels = issue.labels
                .map((label) => typeof label === 'string' ? label : label.name)
                .filter(Boolean)
                .filter((name) => name === null || name === void 0 ? void 0 : name.startsWith('stone-'));
            for (const label of stoneLabels) {
                if (label) {
                    try {
                        await client.removeLabelFromIssue(issueNumber, label);
                    }
                    catch (error) {
                        // Ignore if label doesn't exist
                    }
                }
            }
            // Add stone-process label to start over
            await client.addLabelsToIssue(issueNumber, [config.workflow.stoneLabel]);
            // Add comment about reset
            await client.createIssueComment(issueNumber, 'Issue has been reset to the initial state by the Stone CLI. The workflow will start from the beginning.');
            logger.success(`Issue #${issueNumber} has been reset successfully!`);
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to reset issue: ${error.message}`);
                process.exit(1);
            }
        }
    });
}
