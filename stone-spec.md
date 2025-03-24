# Stone - A Software Factory for GitHub

## Overview

Stone is an npm module that implements a software factory approach to GitHub-based development. It uses Claude Code to orchestrate the software development process through specialized roles, each with defined responsibilities and boundaries. This structured approach helps manage large codebases by breaking down feature implementation into discrete steps with clear ownership.

## Core Principles

- **Role-Based Development**: Different Claude Code instances handle specific roles in the development process
- **Defined Workflow**: Standardized sequence of steps for feature implementation
- **Bounded Context**: Each role operates within appropriate context boundaries
- **GitHub Native**: Uses GitHub issues, PRs, comments, and actions for all workflows
- **Lean Communication**: Terse, effective communication between teams through GitHub mechanisms

## Implementation Requirements

### Repository Structure
Stone requires a GitHub repository with the following characteristics:
- Monorepo structure with packages in a `/packages` directory or equivalent
- Source code for each package in a `/src` directory within the package
- Tests organized in `/test` directories (unit, integration, e2e)
- Package.json at the repository root

### GitHub Environment
Stone requires the following GitHub features to be enabled:
- GitHub Issues
- GitHub Actions
- GitHub Pull Requests
- Branch protection rules for the main branch (optional but recommended)

### Authentication
Stone must be configured with a GitHub token that has the following permissions:
- `repo` (full repo access)
- `workflow` (for creating and updating GitHub Actions)

## Roles and Responsibilities

### Product Manager (PM)

**Responsibilities:**
- Translates user-filed GitHub issues into Gherkin specifications
- Manages repository-wide documentation
- Handles rebasing and merge conflicts
- Performs final verification before PR submission

**Access Permissions:**
- Read access to the entire repository
- Write access to documentation files (`*.md`, excluding `CLAUDE.md` files)
- Write access to GitHub issues and PRs
- Write access to the main branch for rebasing

**Input Format:**
- GitHub issue with `stone-feature` label
- Issue body must follow the Stone feature template

**Output Format:**
- Gherkin specification in the first comment of the GitHub issue
- Documentation updates as commits to the feature branch
- Rebase commits when resolving merge conflicts

**Communication Protocol:**
- Assigns issues to QA team with `stone-qa` label when Gherkin is complete
- Comments on issues when passing to the next role
- Responds to user PR comments by creating new issues with `stone-feedback` label

### QA Team

**Responsibilities:**
- Creates and maintains test suites for features
- Ensures test coverage meets requirements
- Maintains benchmark systems
- Manages repository test utilities

**Access Permissions:**
- Read access to the entire repository
- Write access to:
  - `/test` directories
  - `/benchmarks` directory
  - Test utilities in `/utils/test` or equivalent
  - Package.json files (for test dependencies only)

**Input Format:**
- GitHub issue with Gherkin specification and `stone-qa` label

**Output Format:**
- Test files in appropriate directories:
  - Unit tests: `/packages/[package]/test/unit`
  - Integration tests: `/packages/[package]/test/integration`
  - End-to-end tests: `/test/e2e`
- Benchmark definition files in `/benchmarks`
- Test utility code in `/utils/test`

**Communication Protocol:**
- Comments on issue with test file locations and test command
- Assigns issue to GitHub Actions team with `stone-actions` label
- During test failures, assigns issue to appropriate feature team with:
  - `stone-feature-fix` label
  - Comment specifying failing test and error message
  - Assign to feature team responsible for package where test is failing

### Feature Teams

**Responsibilities:**
- Implement features according to Gherkin specifications
- Refactor code to avoid technical debt
- Fix failing tests in their assigned packages

**Access Permissions:**
- Read access to the entire repository
- Write access only to their assigned package source code:
  - `/packages/[their-package]/src`
  - `/packages/[their-package]/package.json`

**Input Format:**
- GitHub issue with:
  - `stone-feature-implement` label (for new features)
  - `stone-feature-fix` label (for test failures)
  - Assigned to their team

**Output Format:**
- Source code changes in their package directory only
- Comments explaining implementation decisions

**Communication Protocol:**
- Comments on issue when implementation is complete
- Assigns issue to Auditor with `stone-audit` label
- If needing changes in another package, comments with:
  - `@team-[other-package]` mention
  - Specific change request
  - `stone-dependency` label

### Auditor

**Responsibilities:**
- Verifies feature implementation matches Gherkin specification
- Ensures no placeholder code, TODOs, or incomplete implementations
- Validates test coverage adequacy
- Ensures code quality standards are met

**Access Permissions:**
- Read access to the entire repository
- No write access to code
- Write access to issue comments and labels

**Input Format:**
- GitHub issue with `stone-audit` label

**Output Format:**
- Comments with audit findings
- Issue labels:
  - `stone-audit-pass` when implementation meets requirements
  - `stone-audit-fail` when implementation has issues

**Communication Protocol:**
- Comments with specific issues when audit fails
- Reassigns to appropriate feature team with `stone-feature-fix` label when issues found
- Assigns to PM with `stone-ready-for-tests` label when audit passes

### GitHub Actions Team

**Responsibilities:**
- Maintains CI/CD workflows for the repository
- Creates GitHub Actions for automated testing
- Configures GitHub settings for Stone integration

**Access Permissions:**
- Read access to the entire repository
- Write access to:
  - `.github/workflows` directory
  - `.github/actions` directory
  - GitHub repository settings via API

**Input Format:**
- GitHub issue with `stone-actions` label

**Output Format:**
- GitHub Actions workflow files
- GitHub repository setting changes

**Communication Protocol:**
- Comments on issue when workflow changes are complete
- Assigns issue to Feature Teams with `stone-feature-implement` label

## Workflow Implementation

### 1. Initialization

1. User runs `npx @uor-foundation/stone init` in repository root
2. Stone performs the following actions:
   - Analyzes repository structure to identify packages
   - Creates `stone.config.json` with detected structure
   - Creates CLAUDE.md files for each role in `.github/stone` directory
   - Sets up GitHub issue templates in `.github/ISSUE_TEMPLATE`
   - Creates initial GitHub Actions workflows in `.github/workflows`

### 2. Feature Request Processing

When a user creates an issue with the Stone feature template:

1. User adds `stone-process` label to issue
2. Stone GitHub Action triggers on issue labeled event
3. GitHub Action checks if label is `stone-process`
4. If yes, Action invokes Claude Code PM role with issue context
5. PM analyzes issue and adds Gherkin specification as comment
6. PM adds `stone-qa` label and assigns to QA team

### 3. Test Creation

When an issue receives the `stone-qa` label:

1. Stone GitHub Action triggers on issue labeled event
2. Action checks if label is `stone-qa`
3. If yes, Action invokes Claude Code QA role with issue context
4. QA creates test files for:
   - Unit tests (in package test directories)
   - Integration tests (in package test directories)
   - End-to-end tests (in repository test directory)
5. QA adds comment with test locations and commands
6. QA adds `stone-actions` label and assigns to GitHub Actions team

### 4. GitHub Actions Setup

When an issue receives the `stone-actions` label:

1. Stone GitHub Action triggers on issue labeled event
2. Action checks if label is `stone-actions`
3. If yes, Action invokes Claude Code GitHub Actions role with issue context
4. GitHub Actions team updates CI workflows as needed
5. Adds `stone-feature-implement` label and assigns to Feature team based on package mapping in config

### 5. Feature Implementation

When an issue receives the `stone-feature-implement` label:

1. Stone GitHub Action triggers on issue labeled event
2. Action checks if label is `stone-feature-implement`
3. If yes, Action invokes Claude Code Feature role with issue context
4. Feature team implements code changes in their assigned package
5. Adds `stone-audit` label when complete and assigns to Auditor

### 6. Feature Audit

When an issue receives the `stone-audit` label:

1. Stone GitHub Action triggers on issue labeled event
2. Action checks if label is `stone-audit`
3. If yes, Action invokes Claude Code Auditor role with issue context
4. Auditor verifies implementation
5. If issues found:
   - Adds `stone-audit-fail` label
   - Comments with specific issues
   - Reassigns to Feature team with `stone-feature-fix` label
6. If implementation passes:
   - Adds `stone-ready-for-tests` label
   - Assigns to PM

### 7. Test Execution

When an issue receives the `stone-ready-for-tests` label:

1. Stone GitHub Action triggers on issue labeled event
2. Action checks if label is `stone-ready-for-tests`
3. If yes, Action runs tests in sequence:
   - Unit tests first
   - Integration tests if unit tests pass
   - End-to-end tests if integration tests pass
4. If any tests fail:
   - Action identifies failing test and affected package
   - Adds `stone-test-failure` label
   - Assigns to QA team
   - QA team verifies test configuration
   - QA team assigns to appropriate Feature team with `stone-feature-fix` label
5. If all tests pass:
   - Action adds `stone-docs` label
   - Assigns to PM

### 8. Documentation Update

When an issue receives the `stone-docs` label:

1. Stone GitHub Action triggers on issue labeled event
2. Action checks if label is `stone-docs`
3. If yes, Action invokes Claude Code PM role with issue context and docs task
4. PM updates documentation
5. Adds `stone-pr` label

### 9. Pull Request Creation

When an issue receives the `stone-pr` label:

1. Stone GitHub Action triggers on issue labeled event
2. Action checks if label is `stone-pr`
3. If yes, Action invokes Claude Code PM role with issue context and PR task
4. PM creates pull request from feature branch to main branch
5. PR references the original issue
6. Adds `stone-complete` label to issue

### 10. Merge Conflict Resolution

If PR has merge conflicts:

1. Stone GitHub Action triggers on pull request status check failure
2. Action identifies merge conflict
3. Action invokes Claude Code PM role with PR context and rebase task
4. PM performs rebase and resolves conflicts
5. PM pushes updated branch

### 11. User Feedback Handling

When user comments on PR:

1. Stone GitHub Action triggers on PR comment
2. Action analyzes if comment requires changes
3. If yes, Action invokes Claude Code PM role with PR context and feedback task
4. PM creates new issue with `stone-feedback` label
5. Workflow restarts for feedback issue

## Technical Architecture

### Components

#### 1. Core Engine

**Purpose:** Coordinates workflow between roles and manages GitHub API interactions

**Implementation Requirements:**
- Node.js module with TypeScript
- GitHub API client using Octokit
- Configuration loader
- Role orchestration system

**Public API:**
```typescript
// Initialize Stone in repository
async function init(options?: InitOptions): Promise<void>;

// Process GitHub webhook event
async function processEvent(event: WebhookEvent): Promise<void>;

// Run specific workflow manually
async function runWorkflow(
  workflowType: WorkflowType,
  issueOrPrNumber: number,
  options?: WorkflowOptions
): Promise<void>;
```

#### 2. Role-Specific Claude Code Files

**Purpose:** Provide specialized instructions for each Claude Code role

**Implementation Requirements:**
- Each role has dedicated CLAUDE.md file in `.github/stone` directory
- Files include:
  - Role description
  - Access permissions
  - Workflow steps
  - Context boundaries
  - Response formats

**File Locations:**
- `.github/stone/PM.CLAUDE.md`
- `.github/stone/QA.CLAUDE.md`
- `.github/stone/FEATURE.CLAUDE.md`
- `.github/stone/AUDITOR.CLAUDE.md`
- `.github/stone/ACTIONS.CLAUDE.md`

#### 3. Configuration System

**Purpose:** Store repository-specific settings for Stone

**Implementation Requirements:**
- JSON configuration file at repository root
- Package mapping for feature teams
- Workflow customization options
- GitHub integration settings

**Schema:**
```typescript
interface StoneConfig {
  repository: {
    owner: string;
    name: string;
  };
  packages: Array<{
    name: string;
    path: string;
    team: string;
  }>;
  workflow: {
    issueTemplate: string;
    stoneLabel: string;
    useWebhooks: boolean;
    testCommand: string;
    timeoutMinutes: number;
  };
  github: {
    actionsDirectory: string;
    issueTemplateDirectory: string;
    stoneDirectory: string;
  };
  roles: {
    pm: {
      enabled: boolean;
      claudeFile: string;
    };
    qa: {
      enabled: boolean;
      claudeFile: string;
    };
    feature: {
      enabled: boolean;
      claudeFile: string;
    };
    auditor: {
      enabled: boolean;
      claudeFile: string;
    };
    actions: {
      enabled: boolean;
      claudeFile: string;
    };
  };
}
```

#### 4. GitHub Integration

**Purpose:** Connect with GitHub API and handle events

**Implementation Requirements:**
- Webhook handler for event-driven workflow
- GitHub API client for issue/PR management
- Authentication via GitHub tokens

**Event Handling:**
- Issue events: `labeled`, `assigned`, `edited`
- PR events: `created`, `comment_created`, `status_changed`

### Data Flow

```
User Feature Request
       │
       ▼
 ┌───────────┐    ┌───────────┐
 │    PM     │───►│    QA     │
 └───────────┘    └───────────┘
                        │
                        ▼
                  ┌───────────┐
                  │  Actions  │
                  └───────────┘
                        │
                        ▼
 ┌───────────┐    ┌───────────┐
 │  Auditor  │◄───│  Feature  │
 └───────────┘    └───────────┘
       │
       ▼
┌─────────────┐
│ Test Runner │
└─────────────┘
       │
       ▼
   ┌───────┐
   │   PM  │──► Pull Request ──► User Review
   └───────┘
```

## Deployment and Usage

### Installation

```bash
npm install --save-dev @uor-foundation/stone
```

### Initialization

```bash
npx stone init
```

### Configuration

After initialization, modify `stone.config.json` for repository-specific settings.

### GitHub Integration

1. Create GitHub Actions token with required permissions
2. Add token to repository secrets as `STONE_GITHUB_TOKEN`
3. Enable GitHub Actions in repository settings

### Usage

#### Processing a Feature Request

1. Create issue using Stone feature template
2. Add `stone-process` label

#### Running Stone Manually

```bash
# Process a specific issue
npx stone process --issue 123

# Run a specific workflow step
npx stone run --workflow audit --issue 123

# View status of all Stone issues
npx stone status
```

#### Using GitHub Actions UI

1. Navigate to Actions tab in repository
2. Select "Stone Software Factory" workflow
3. Click "Run workflow"
4. Enter issue number to process

## Error Handling

### Communication Failures

If communication between roles fails:
1. Error is logged to issue comment
2. Issue labeled with `stone-error`
3. User notified to resolve or restart

### Test Failures

If tests fail:
1. Test output logged to issue comment
2. Issue assigned to QA team with `stone-test-failure` label
3. QA verifies test configuration before assigning to feature team

### API Rate Limiting

If GitHub API rate limits are hit:
1. Workflow pauses and logs warning
2. Retries with exponential backoff
3. Resumes when rate limits reset

## Debugging

### Logs

Logs are written to:
- Issue comments (high-level status)
- `.github/stone/logs` directory (detailed logs)

### Manual Intervention

If workflow gets stuck or encounters unrecoverable error:
1. Run reset command:
   ```bash
   npx stone reset --issue 123
   ```
2. This resets the workflow state and allows manual restart

## Security Considerations

- GitHub token must be stored securely in Actions secrets
- Role permissions strictly limited to required access
- No sensitive data should be stored in issue comments
- Claude Code execution permissions limited to `.github/stone` directory

## Extensions and Customization

### Custom Roles

To add custom role:
1. Create new CLAUDE.md file in `.github/stone` directory
2. Add role configuration to `stone.config.json`
3. Update workflow to include new role

### Custom Workflow Steps

To add custom workflow step:
1. Create new GitHub Action in `.github/workflows` directory
2. Add step configuration to `stone.config.json`
3. Integrate with existing workflow through labels and assignments

## Conclusion

The Stone software factory provides a structured, efficient approach to collaborative software development using GitHub and Claude Code. By defining clear roles, responsibilities, and workflows, it helps manage complexity in large codebases while maintaining high quality standards.

By following this specification, implementors can create a robust, unambiguous software factory that automates the development process through well-defined roles and workflows.
