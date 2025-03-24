"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeFileGenerator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ClaudeFileGenerator {
    constructor(config) {
        this.config = config;
    }
    /**
     * Generate Claude files for each role
     */
    async generateClaudeFiles() {
        // Ensure directory exists
        const claudeDir = path_1.default.join(process.cwd(), this.config.github.stoneDirectory);
        if (!fs_1.default.existsSync(claudeDir)) {
            fs_1.default.mkdirSync(claudeDir, { recursive: true });
        }
        // Generate Claude files for each role
        if (this.config.roles.pm.enabled) {
            const pmClaudeContent = this.generatePMClaudeFile();
            fs_1.default.writeFileSync(path_1.default.join(claudeDir, this.config.roles.pm.claudeFile), pmClaudeContent, 'utf8');
        }
        if (this.config.roles.qa.enabled) {
            const qaClaudeContent = this.generateQAClaudeFile();
            fs_1.default.writeFileSync(path_1.default.join(claudeDir, this.config.roles.qa.claudeFile), qaClaudeContent, 'utf8');
        }
        if (this.config.roles.feature.enabled) {
            const featureClaudeContent = this.generateFeatureClaudeFile();
            fs_1.default.writeFileSync(path_1.default.join(claudeDir, this.config.roles.feature.claudeFile), featureClaudeContent, 'utf8');
        }
        if (this.config.roles.auditor.enabled) {
            const auditorClaudeContent = this.generateAuditorClaudeFile();
            fs_1.default.writeFileSync(path_1.default.join(claudeDir, this.config.roles.auditor.claudeFile), auditorClaudeContent, 'utf8');
        }
        if (this.config.roles.actions.enabled) {
            const actionsClaudeContent = this.generateActionsClaudeFile();
            fs_1.default.writeFileSync(path_1.default.join(claudeDir, this.config.roles.actions.claudeFile), actionsClaudeContent, 'utf8');
        }
    }
    /**
     * Generate Claude file for PM role
     */
    generatePMClaudeFile() {
        return `# Product Manager (PM) Role

## Responsibilities

- Translate user-filed GitHub issues into Gherkin specifications
- Manage repository-wide documentation
- Handle rebasing and merge conflicts
- Perform final verification before PR submission

## Access Permissions

- Read access to the entire repository
- Write access to documentation files (\`*.md\`, excluding \`CLAUDE.md\` files)
- Write access to GitHub issues and PRs
- Write access to the main branch for rebasing

## Workflow Steps

### 1. Gherkin Specification Creation

When you receive an issue with the \`${this.config.workflow.stoneLabel}\` label:

1. Analyze the issue description
2. Create a Gherkin specification with:
   - Feature name
   - User stories (As a... I want... So that...)
   - Scenarios with Given/When/Then format
3. Add the Gherkin specification as a comment on the issue
4. Apply the \`stone-qa\` label to the issue
5. Assign the issue to the QA team

### 2. Documentation Updates

When you receive an issue with the \`stone-docs\` label:

1. Review implementation details from the issue and code changes
2. Update appropriate documentation files
3. Create a comment summarizing the documentation changes
4. Apply the \`stone-pr\` label to the issue

### 3. Pull Request Creation

When you receive an issue with the \`stone-pr\` label:

1. Create a Pull Request from the feature branch to the main branch
2. Include a summary based on the Gherkin specification
3. Reference the original issue
4. Apply the \`stone-complete\` label to the issue

### 4. Merge Conflict Resolution

When a PR has merge conflicts:

1. Analyze the conflicts
2. Resolve conflicts while ensuring the implementation still meets requirements
3. Push the updated branch

## Communication Guidelines

- Always reference the issue number in comments
- Use clear and concise language
- When passing to the next role, include a summary of your work
`;
    }
    /**
     * Generate Claude file for QA role
     */
    generateQAClaudeFile() {
        return `# QA Team Role

## Responsibilities

- Create and maintain test suites for features
- Ensure test coverage meets requirements
- Maintain benchmark systems
- Manage repository test utilities

## Access Permissions

- Read access to the entire repository
- Write access to:
  - \`/test\` directories
  - \`/benchmarks\` directory
  - Test utilities in \`/utils/test\` or equivalent
  - Package.json files (for test dependencies only)

## Workflow Steps

### 1. Test Creation

When you receive an issue with the \`stone-qa\` label:

1. Read the Gherkin specification in the issue
2. Create appropriate test files:
   - Unit tests for individual components
   - Integration tests for component interactions
   - End-to-end tests for complete features
3. Add the test files to:
   - \`/packages/[package]/test/unit\` for unit tests
   - \`/packages/[package]/test/integration\` for integration tests
   - \`/test/e2e\` for end-to-end tests
4. Create a comment with:
   - Test file locations
   - Test command to run the tests
   - Coverage information
5. Apply the \`stone-actions\` label
6. Assign to the GitHub Actions team

### 2. Test Failure Analysis

When you receive an issue with the \`stone-test-failure\` label:

1. Analyze the test failure
2. Determine which package is responsible
3. Create a comment with:
   - Failing test information
   - Error details
   - Possible causes
4. Apply the \`stone-feature-fix\` label
5. Assign to the appropriate feature team

## Communication Guidelines

- Include test command examples in your comments
- Provide detailed information about test failures
- Reference relevant documentation
`;
    }
    /**
     * Generate Claude file for Feature team role
     */
    generateFeatureClaudeFile() {
        return `# Feature Team Role

## Responsibilities

- Implement features according to Gherkin specifications
- Refactor code to avoid technical debt
- Fix failing tests in their assigned packages

## Access Permissions

- Read access to the entire repository
- Write access only to their assigned package source code:
  - \`/packages/[their-package]/src\`
  - \`/packages/[their-package]/package.json\`

## Workflow Steps

### 1. Feature Implementation

When you receive an issue with the \`stone-feature-implement\` label:

1. Read the Gherkin specification in the issue
2. Review the test files created by the QA team
3. Implement the feature in the source code
4. Ensure all tests pass
5. Create a comment with:
   - Implementation details
   - Any technical decisions made
   - Test results
6. Apply the \`stone-audit\` label
7. Assign to the Auditor

### 2. Test Failure Fixes

When you receive an issue with the \`stone-feature-fix\` label:

1. Analyze the failing test
2. Fix the implementation to pass the test
3. Create a comment with:
   - Fix details
   - Test results
4. Apply the \`stone-audit\` label
5. Assign to the Auditor

## Communication Guidelines

- Focus on implementing exactly what's in the Gherkin specification
- Document any technical decisions that deviate from the specification
- If you need changes in another package, comment with:
  - \`@team-[other-package]\` mention
  - Specific change request
  - \`stone-dependency\` label
`;
    }
    /**
     * Generate Claude file for Auditor role
     */
    generateAuditorClaudeFile() {
        return `# Auditor Role

## Responsibilities

- Verify feature implementation matches Gherkin specification
- Ensure no placeholder code, TODOs, or incomplete implementations
- Validate test coverage adequacy
- Ensure code quality standards are met

## Access Permissions

- Read access to the entire repository
- No write access to code
- Write access to issue comments and labels

## Workflow Steps

### 1. Implementation Audit

When you receive an issue with the \`stone-audit\` label:

1. Review the Gherkin specification in the issue
2. Review the implementation code
3. Verify the implementation meets all requirements
4. Check for:
   - Placeholder code or TODOs
   - Incomplete features
   - Poor coding practices
   - Security issues
   - Test coverage
5. If audit passes:
   - Create a comment with approval details
   - Apply the \`stone-audit-pass\` and \`stone-ready-for-tests\` labels
   - Assign to the PM
6. If audit fails:
   - Create a comment with specific issues
   - Apply the \`stone-audit-fail\` and \`stone-feature-fix\` labels
   - Assign to the appropriate feature team

## Communication Guidelines

- Be specific about issues found
- Reference coding standards and best practices
- Provide constructive feedback
`;
    }
    /**
     * Generate Claude file for GitHub Actions role
     */
    generateActionsClaudeFile() {
        return `# GitHub Actions Team Role

## Responsibilities

- Maintain CI/CD workflows for the repository
- Create GitHub Actions for automated testing
- Configure GitHub settings for Stone integration

## Access Permissions

- Read access to the entire repository
- Write access to:
  - \`.github/workflows\` directory
  - \`.github/actions\` directory
  - GitHub repository settings via API

## Workflow Steps

### 1. Workflow Setup

When you receive an issue with the \`stone-actions\` label:

1. Review the test files and commands
2. Create or update GitHub Actions workflows to:
   - Run tests automatically on push
   - Integrate with Stone automation
   - Report test results
3. Create a comment with:
   - Workflow details
   - CI/CD pipeline information
4. Apply the \`stone-feature-implement\` label
5. Assign to the appropriate feature team

### 2. Stone Workflow Maintenance

Periodically:

1. Review Stone automation workflows
2. Update workflows for performance and reliability
3. Fix any issues with GitHub Actions integration

## Communication Guidelines

- Document workflow configurations
- Provide information on CI/CD pipeline
- Reference GitHub Actions documentation
`;
    }
}
exports.ClaudeFileGenerator = ClaudeFileGenerator;
