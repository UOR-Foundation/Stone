"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.processEvent = processEvent;
exports.runWorkflow = runWorkflow;
const config_1 = require("./config");
const github_1 = require("./github");
const workflow_1 = require("./workflow");
const claude_1 = require("./claude");
const logger_1 = require("./utils/logger");
/**
 * Initialize Stone in a repository
 */
async function init(options) {
    const logger = new logger_1.Logger();
    try {
        // Get repository information
        const owner = options === null || options === void 0 ? void 0 : options.owner;
        const name = options === null || options === void 0 ? void 0 : options.name;
        if (!owner || !name) {
            throw new Error('Repository owner and name are required');
        }
        // Get GitHub token
        const auth = new github_1.GitHubAuth();
        const token = (options === null || options === void 0 ? void 0 : options.token) || await auth.getToken();
        if (!token) {
            throw new Error('GitHub token is required');
        }
        // Generate configuration
        const generator = new config_1.ConfigGenerator();
        const config = await generator.generate(owner, name);
        // Create directories
        await generator.createDirectories(config);
        // Create GitHub client
        const client = new github_1.GitHubClient(token, config);
        // Create labels
        const labelManager = new github_1.LabelManager(client, config);
        await labelManager.createLabels();
        // Create Claude files
        const claudeGenerator = new claude_1.ClaudeFileGenerator(config);
        await claudeGenerator.generateClaudeFiles();
        logger.success('Stone initialized successfully!');
    }
    catch (error) {
        if (error instanceof Error) {
            logger.error(`Initialization failed: ${error.message}`);
            throw error;
        }
    }
}
/**
 * Process a GitHub webhook event
 */
async function processEvent(event) {
    const logger = new logger_1.Logger();
    try {
        // Load configuration
        const configLoader = new config_1.ConfigLoader();
        const config = await configLoader.load();
        // Get GitHub token
        const auth = new github_1.GitHubAuth();
        const token = await auth.getToken();
        if (!token) {
            throw new Error('GitHub token is required');
        }
        // Create GitHub client
        const client = new github_1.GitHubClient(token, config);
        // Process based on event type
        if (event.action === 'labeled' && event.issue) {
            const label = event.label.name;
            const issueNumber = event.issue.number;
            // Handle different labels
            if (label === config.workflow.stoneLabel) {
                // Process new Stone issue
                const issueManager = new github_1.IssueManager(client, config);
                await issueManager.processIssue(issueNumber);
            }
            else if (label.startsWith('stone-')) {
                // Process issue with Stone label
                const workflow = new workflow_1.StoneWorkflow(client, config);
                const workflowType = label.replace('stone-', '');
                await workflow.runWorkflow(workflowType, issueNumber);
            }
        }
        logger.success('Event processed successfully!');
    }
    catch (error) {
        if (error instanceof Error) {
            logger.error(`Event processing failed: ${error.message}`);
            throw error;
        }
    }
}
/**
 * Run a specific workflow manually
 */
async function runWorkflow(workflowType, issueNumber, options) {
    const logger = new logger_1.Logger();
    try {
        // Load configuration
        const configLoader = new config_1.ConfigLoader();
        const config = await configLoader.load();
        // Get GitHub token
        const auth = new github_1.GitHubAuth();
        const token = (options === null || options === void 0 ? void 0 : options.token) || await auth.getToken();
        if (!token) {
            throw new Error('GitHub token is required');
        }
        // Create GitHub client
        const client = new github_1.GitHubClient(token, config);
        // Run workflow
        const workflow = new workflow_1.StoneWorkflow(client, config);
        await workflow.runWorkflow(workflowType, issueNumber);
        logger.success(`Workflow ${workflowType} completed for issue #${issueNumber}!`);
    }
    catch (error) {
        if (error instanceof Error) {
            logger.error(`Workflow execution failed: ${error.message}`);
            throw error;
        }
    }
}
