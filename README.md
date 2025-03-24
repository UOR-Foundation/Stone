# Stone - A Software Factory for GitHub

Stone is a structured system for orchestrating GitHub-based development using Claude Code. It implements a software factory approach with specialized roles, each with defined responsibilities and boundaries.

## Features

Stone provides a complete software development lifecycle implementation:

1. **Core Infrastructure & Configuration**
   - Project setup and configuration
   - GitHub API integration
   - Command-line interface

2. **Role-Based Infrastructure**
   - Claude Code integration
   - Role templates (PM, QA, Feature Teams, Auditor, GitHub Actions)
   - Role orchestration system

3. **Workflow Implementation**
   - Issue processing
   - Test framework integration
   - Feature implementation workflow
   - Audit system

4. **GitHub Actions Integration**
   - Workflow file generation
   - Event-driven architecture
   - CI/CD integration

5. **Advanced Features**
   - **Merge Conflict Resolution**: Automatically detects and resolves merge conflicts in PRs
   - **User Feedback Handling**: Analyzes PR comments to extract actionable feedback
   - **Documentation Management**: Generates and verifies documentation from source code
   - **Error Recovery System**: Provides robust error handling with graduated recovery strategies

## Installation

```bash
npm install @uor-foundation/stone
```

## Usage

```bash
# Initialize Stone in your repository
npx stone init

# Process an issue
npx stone process --issue 123

# Run a specific workflow step
npx stone run --workflow pm --issue 123

# Check the status of Stone issues
npx stone status

# Reset a workflow
npx stone reset --issue 123
```

## Configuration

Stone is configured via `stone.config.json` in your repository root:

```json
{
  "repository": {
    "owner": "your-org",
    "name": "your-repo"
  },
  "packages": [
    {
      "name": "core",
      "path": "packages/core",
      "team": "core-team"
    }
  ],
  "workflow": {
    "issueTemplate": "feature-request.md",
    "stoneLabel": "stone-process",
    "useWebhooks": true,
    "testCommand": "npm test",
    "timeoutMinutes": 30
  }
}
```

## Architecture

Stone follows a modular, service-based architecture:

- **Core Services**: Git, GitHub, FileSystem, Logger, Notification
- **Workflow Components**: ConflictResolution, FeedbackHandler, DocumentationManager, ErrorRecovery
- **Integration Layer**: StoneWorkflow, CLI adapter

The advanced features implementation provides:

1. **Conflict Resolution**:
   - Detects merge conflicts in PRs
   - Attempts automatic resolution
   - Updates PR status with results

2. **Feedback Handler**:
   - Analyzes PR comments for actionable feedback
   - Creates and prioritizes issues from feedback
   - Routes issues to appropriate teams

3. **Documentation Manager**:
   - Extracts documentation from JSDoc comments
   - Verifies documentation completeness
   - Creates PRs with documentation updates

4. **Error Recovery**:
   - Captures detailed error state
   - Implements graduated recovery strategies
   - Provides team notification when needed

## Requirements

- Node.js 16+
- Git
- GitHub repository with issues and actions enabled
- GitHub token with appropriate permissions

## License

MIT