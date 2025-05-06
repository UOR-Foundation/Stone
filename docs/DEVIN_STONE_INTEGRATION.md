# Devin-Stone Integration: Comprehensive User Guide

This guide provides detailed instructions for integrating Devin.ai with Stone, allowing users to operate Stone through the Devin interface.

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Core Workflows](#core-workflows)
5. [Advanced Usage](#advanced-usage)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [Reference](#reference)

## Introduction

### What is Stone?

Stone is a structured system for orchestrating GitHub-based development using Claude AI. It provides a role-based development system with specialized AI roles (PM, QA, Feature Developer, Auditor, GitHub Actions Runner) working together to develop features in a standardized workflow.

### What is Devin?

Devin.ai is an AI software engineer that can help with code implementation. It provides a natural language interface for software development tasks and can integrate with various development tools and workflows.

### Benefits of Integration

The Devin-Stone integration combines the strengths of both systems:

- **Structured Workflow**: Stone provides a structured, role-based workflow for GitHub-based development
- **Natural Language Interface**: Devin provides a natural language interface for interacting with Stone
- **End-to-End Development**: Together, they enable end-to-end development from specification to implementation
- **Seamless Collaboration**: The integration allows for seamless collaboration between different AI roles
- **Automated Workflows**: Automate complex development workflows with simple commands

## Installation

### Prerequisites

Before you begin, ensure you have:

1. A GitHub account with access to your target repository
2. A GitHub token with appropriate permissions
3. A Claude API key
4. Node.js installed (version 16 or higher)

### Installing the Devin-Stone Bridge

```bash
npm install -g @uor-foundation/devin-stone-bridge
```

### Verifying the Installation

```bash
devin-stone --version
```

## Configuration

### Setting Up GitHub Authentication

The Devin-Stone bridge requires GitHub authentication to interact with your repository. Set the `GITHUB_TOKEN` environment variable:

```bash
export GITHUB_TOKEN=your-github-token
```

### Configuring Stone

Create or update your `stone.config.json` file in your repository:

```json
{
  "repository": {
    "owner": "YourOrg",
    "name": "YourRepo"
  },
  "claudeApiKey": "your-claude-api-key",
  "packages": [
    {
      "name": "your-package",
      "path": ".",
      "team": "your-team"
    }
  ],
  "workflow": {
    "issueTemplate": "stone-feature.md",
    "stoneLabel": "stone-process",
    "useWebhooks": true,
    "testCommand": "npm test",
    "timeoutMinutes": 30
  },
  "github": {
    "actionsDirectory": ".github/workflows",
    "issueTemplateDirectory": ".github/ISSUE_TEMPLATE",
    "stoneDirectory": ".github/stone"
  },
  "roles": {
    "pm": {
      "enabled": true,
      "claudeFile": "PM.CLAUDE.md"
    },
    "qa": {
      "enabled": true,
      "claudeFile": "QA.CLAUDE.md"
    },
    "feature": {
      "enabled": true,
      "claudeFile": "FEATURE.CLAUDE.md"
    },
    "auditor": {
      "enabled": true,
      "claudeFile": "AUDITOR.CLAUDE.md"
    },
    "actions": {
      "enabled": true,
      "claudeFile": "ACTIONS.CLAUDE.md"
    }
  }
}
```

### Setting Up Role Files

Stone requires role files for each enabled role. Create these files in the `.github/stone` directory:

```bash
mkdir -p .github/stone
```

#### PM.CLAUDE.md

```markdown
# Project Manager Role

You are a Project Manager responsible for creating detailed specifications for features.

## Responsibilities

- Analyze feature requests
- Create detailed specifications
- Define acceptance criteria
- Coordinate with other roles
```

#### QA.CLAUDE.md

```markdown
# Quality Assurance Role

You are a Quality Assurance engineer responsible for creating test plans and verifying features.

## Responsibilities

- Create test plans
- Define test cases
- Verify feature implementations
- Report issues
```

#### FEATURE.CLAUDE.md

```markdown
# Feature Developer Role

You are a Feature Developer responsible for implementing features according to specifications.

## Responsibilities

- Implement features
- Write clean, maintainable code
- Follow best practices
- Address feedback
```

#### AUDITOR.CLAUDE.md

```markdown
# Code Auditor Role

You are a Code Auditor responsible for reviewing code and ensuring quality.

## Responsibilities

- Review code
- Identify issues
- Suggest improvements
- Ensure code quality
```

#### ACTIONS.CLAUDE.md

```markdown
# GitHub Actions Role

You are responsible for setting up CI/CD workflows for the repository.

## Responsibilities

- Create GitHub Actions workflows
- Configure CI/CD pipelines
- Automate testing and deployment
- Monitor workflow execution
```

### Setting Up Issue Templates

Create an issue template for Stone in the `.github/ISSUE_TEMPLATE` directory:

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

#### stone-feature.md

```markdown
---
name: Stone Feature
about: Feature request to be processed by Stone
title: '[FEATURE] '
labels: stone-process
assignees: ''
---

# Feature Request

## Description

Detailed description of the feature.

## Requirements

- Requirement 1
- Requirement 2
- Requirement 3

## Acceptance Criteria

- Criterion 1
- Criterion 2
- Criterion 3
```

## Core Workflows

### 1. Creating and Processing Issues

#### Via Devin Interface

```javascript
// In your Devin.ai session
const { DevinStoneInterface } = require('@uor-foundation/devin-stone-bridge');

// Create a Devin interface instance
const devinInterface = new DevinStoneInterface({
  repositoryPath: '/path/to/your/repo'
});

// Process an issue
const result = await devinInterface.processIssue(123);
console.log('Issue processing result:', result);
```

#### Via Command Line

```bash
# Process an issue
devin-stone process --issue 123
```

### 2. Running Stone Workflows

Stone has several role-based workflows:

- **PM**: Project management and specification generation
- **QA**: Quality assurance and test generation
- **Feature**: Feature implementation
- **Auditor**: Code review and security auditing
- **Actions**: CI/CD workflow generation

#### Via Devin Interface

```javascript
// Run the PM workflow
const pmResult = await devinInterface.runWorkflow('pm', 123);

// Run the QA workflow
const qaResult = await devinInterface.runWorkflow('qa', 123);

// Run the feature workflow
const featureResult = await devinInterface.runWorkflow('feature', 123);

// Run the auditor workflow
const auditorResult = await devinInterface.runWorkflow('auditor', 123);

// Run the actions workflow
const actionsResult = await devinInterface.runWorkflow('actions', 123);
```

#### Via Command Line

```bash
# Run the PM workflow
devin-stone run --workflow pm --issue 123

# Run the QA workflow
devin-stone run --workflow qa --issue 123

# Run the feature workflow
devin-stone run --workflow feature --issue 123

# Run the auditor workflow
devin-stone run --workflow auditor --issue 123

# Run the actions workflow
devin-stone run --workflow actions --issue 123
```

### 3. Monitoring Status

#### Via Devin Interface

```javascript
// Show status of all Stone issues
const statusResult = await devinInterface.showStatus();
console.log('Status:', statusResult);
```

#### Via Command Line

```bash
# Show status
devin-stone status
```

### 4. Generating GitHub Actions

#### Via Devin Interface

```javascript
// Generate GitHub Actions workflows
const actionsResult = await devinInterface.generateActions();
console.log('Actions:', actionsResult);
```

#### Via Command Line

```bash
# Generate GitHub Actions workflows
devin-stone actions
```

### 5. Auto-Rebasing Pull Requests

#### Via Devin Interface

```javascript
// Auto-rebase a pull request
const rebaseResult = await devinInterface.autoRebase(456);
console.log('Rebase:', rebaseResult);
```

#### Via Command Line

```bash
# Auto-rebase a pull request
devin-stone auto-rebase --pr 456
```

## Advanced Usage

### 1. API Bridge

The Devin-Stone bridge includes an API server that allows for remote communication between Devin and Stone.

#### Starting the API Server

```bash
devin-stone-server --port 3000 --api-key your-api-key
```

#### Using the API

```javascript
const { DevinStoneInterface } = require('@uor-foundation/devin-stone-bridge');

// Create a Devin interface with API configuration
const devinInterface = new DevinStoneInterface({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Process an issue
const result = await devinInterface.processIssue(123);
console.log(result);
```

### 2. Plugin Integration

The Devin-Stone bridge includes a plugin for Stone's plugin system.

#### Registering the Plugin

```javascript
const { DevinPlugin } = require('@uor-foundation/devin-stone-bridge/plugins');
const { PluginSystem } = require('stone');

// Register the plugin with Stone
const pluginSystem = new PluginSystem();
pluginSystem.registerPlugin(new DevinPlugin());
```

#### Using the Plugin

```javascript
// The plugin provides hooks for Stone's workflow
pluginSystem.executeHook('process-issue', 123);
pluginSystem.executeHook('run-workflow', 'feature', 123);
pluginSystem.executeHook('show-status');
pluginSystem.executeHook('generate-actions');
pluginSystem.executeHook('auto-rebase', 456);
```

### 3. Custom Environment Variables

```javascript
const result = await devinInterface.processIssue(123, {
  env: {
    GITHUB_TOKEN: 'custom-token',
    CLAUDE_API_KEY: 'custom-api-key'
  }
});
```

### 4. Custom Timeout

```javascript
const result = await devinInterface.processIssue(123, {
  timeout: 60000 // 60 seconds
});
```

### 5. Custom Stone Executable

```javascript
const { StoneCLI } = require('@uor-foundation/devin-stone-bridge');

// Specify a custom Stone executable path
const stoneCLI = new StoneCLI('/path/to/stone');

// Use the custom CLI
const result = await stoneCLI.processIssue(123, {
  cwd: '/path/to/repo'
});
```

## End-to-End Workflow Example

Here's a complete workflow example for developing a new feature:

### 1. Create a GitHub Issue

Create a new issue in your GitHub repository with the `stone-process` label.

### 2. Process the Issue with Stone

```javascript
// Process the issue
const processResult = await devinInterface.processIssue(123);
```

### 3. Generate Specifications with PM

```javascript
// Run the PM workflow
const pmResult = await devinInterface.runWorkflow('pm', 123);
```

### 4. Generate Tests with QA

```javascript
// Run the QA workflow
const qaResult = await devinInterface.runWorkflow('qa', 123);
```

### 5. Implement the Feature

```javascript
// Run the feature workflow
const featureResult = await devinInterface.runWorkflow('feature', 123);
```

### 6. Review the Code with Auditor

```javascript
// Run the auditor workflow
const auditorResult = await devinInterface.runWorkflow('auditor', 123);
```

### 7. Set Up CI/CD with Actions

```javascript
// Run the actions workflow
const actionsResult = await devinInterface.runWorkflow('actions', 123);
```

### 8. Auto-Rebase the Pull Request

```javascript
// Auto-rebase the pull request
const rebaseResult = await devinInterface.autoRebase(456);
```

## Troubleshooting

### Common Issues

#### GitHub Authentication Issues

If you encounter GitHub authentication issues:

1. **Symptom**: Error messages about authentication failures
2. **Cause**: Invalid or expired GitHub token
3. **Solution**: 
   - Ensure the `GITHUB_TOKEN` environment variable is set
   - Verify the token has the necessary permissions
   - Check that the token is valid and not expired

#### Stone CLI Not Found

If the Stone CLI is not found:

1. **Symptom**: "Command not found" or similar errors
2. **Cause**: Stone is not installed or not in PATH
3. **Solution**:
   - Ensure Stone is installed globally: `npm install -g @uor-foundation/stone`
   - Verify the Stone executable is in your PATH
   - Check that you have the correct permissions

#### Claude API Key Issues

If you encounter Claude API key issues:

1. **Symptom**: Error messages about API key validation
2. **Cause**: Invalid or expired Claude API key
3. **Solution**:
   - Verify the `claudeApiKey` field is correctly set in your `stone.config.json`
   - Ensure the API key is valid and not expired
   - Check that the API key has the necessary permissions

#### Connection Issues

If you encounter connection issues:

1. **Symptom**: Timeout or connection refused errors
2. **Cause**: Network connectivity issues
3. **Solution**:
   - Check your internet connection
   - Verify firewall settings
   - Check proxy configuration

### Debugging

#### Enable Debug Logging

```bash
DEBUG=devin-stone:* devin-stone process --issue 123
```

#### Check Logs

```bash
cat /var/log/devin-stone-bridge/devin-stone.log
```

#### Health Checks

```bash
curl http://localhost:3000/health
```

## Best Practices

### 1. Use Environment Variables

Store sensitive information like API keys and tokens in environment variables:

```bash
export GITHUB_TOKEN=your-github-token
export CLAUDE_API_KEY=your-claude-api-key
```

### 2. Follow the Stone Workflow

Adhere to the Stone workflow stages for consistent results:

1. Process issue
2. Run PM workflow
3. Run QA workflow
4. Run feature workflow
5. Run auditor workflow
6. Run actions workflow

### 3. Monitor Status

Regularly check the status of Stone issues to track progress:

```bash
devin-stone status
```

### 4. Handle Errors

Implement proper error handling to recover from failures:

```javascript
const result = await devinInterface.processIssue(123);

if (result.success) {
  console.log('Success:', result.output);
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### 5. Use the Dashboard

Utilize the Stone dashboard for visual monitoring of workflows:

```bash
devin-stone dashboard
```

## Reference

### DevinStoneInterface API

#### Constructor

```javascript
const devinInterface = new DevinStoneInterface({
  repositoryPath: '/path/to/repo', // Local repository path
  apiUrl: 'http://localhost:3000', // API server URL (optional)
  apiKey: 'your-api-key' // API key for authentication (optional)
});
```

#### Methods

- `processIssue(issueNumber, options)`: Process a GitHub issue
- `runWorkflow(workflow, issueNumber, options)`: Run a specific workflow
- `showStatus(options)`: Show status of Stone issues
- `generateActions(options)`: Generate GitHub Actions workflows
- `autoRebase(prNumber, options)`: Auto-rebase a pull request
- `startDashboard(options)`: Start the Stone dashboard

### StoneCLI API

#### Constructor

```javascript
const stoneCLI = new StoneCLI('/path/to/stone');
```

#### Methods

- `runCommand(args, options)`: Run a Stone CLI command
- `processIssue(issueNumber, options)`: Process a GitHub issue
- `runWorkflow(workflow, issueNumber, options)`: Run a specific workflow
- `showStatus(options)`: Show status of Stone issues
- `generateActions(options)`: Generate GitHub Actions workflows
- `startDashboard(options)`: Start the Stone dashboard
- `autoRebase(prNumber, options)`: Auto-rebase a pull request

### Command Line Interface

#### Global Options

- `--help`: Show help
- `--version`: Show version

#### Commands

- `process`: Process a GitHub issue
- `run`: Run a specific workflow
- `status`: Show status of Stone issues
- `actions`: Generate GitHub Actions workflows
- `dashboard`: Start the Stone dashboard
- `auto-rebase`: Auto-rebase a pull request
- `serve`: Start the API server

### API Endpoints

- `POST /api/process`: Process a GitHub issue
- `POST /api/run`: Run a specific workflow
- `GET /api/status`: Show status of Stone issues
- `POST /api/actions`: Generate GitHub Actions workflows
- `POST /api/auto-rebase`: Auto-rebase a pull request
- `GET /health`: Health check endpoint
- `GET /metrics`: Metrics endpoint

## Resources

- [Devin.ai Documentation](https://docs.devin.ai)
- [Stone Documentation](https://github.com/UOR-Foundation/Stone)
- [Devin-Stone Bridge Repository](https://github.com/UOR-Foundation/devin-stone-bridge)
