# Stone

Stone is a structured system for orchestrating GitHub-based development using Claude Code. It emphasizes role-based development with defined responsibilities and boundaries.

[![Tests](https://github.com/uor-foundation/stone/actions/workflows/test.yml/badge.svg)](https://github.com/uor-foundation/stone/actions/workflows/test.yml)
[![PR Checks](https://github.com/uor-foundation/stone/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/uor-foundation/stone/actions/workflows/pr-checks.yml)
[![Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen.svg)](https://github.com/uor-foundation/stone/actions/workflows/ci.yml)

![Stone Quick Start](https://github.com/UOR-Foundation/Stone/assets/quick-start.gif)

## Features

* **Role-Based Development**: Specialized roles (PM, QA, Feature Developer, Auditor, GitHub Actions Runner) with defined responsibilities.
* **Structured Workflow**: Standardized workflow for feature development.
* **GitHub Integration**: Seamless integration with GitHub issues, pull requests, and actions.
* **Claude AI Integration**: Leverages Claude AI for each role's tasks.
* **Security Features**: Role-based access control (RBAC) and automatic secret redaction.
* **Performance Dashboard**: Real-time metrics visualization for rate limits and batch processing.
* **Conflict Resolution**: Automatic PR rebasing to resolve merge conflicts.
* **Multi-Repository Support**: Orchestrate Stone across multiple repositories.

## Installation

```bash
# Install globally
npm install -g @uor-foundation/stone

# Or install as a project dependency
npm install --save-dev @uor-foundation/stone
```

## Usage

### Initialize Stone

```bash
# Initialize Stone in your repository
npx stone init
```

This will create a `stone.config.json` file in your repository with default settings.

### Process an Issue

```bash
# Process an issue with Stone
npx stone process --issue 123
```

This will process the issue with the appropriate role based on its labels.

### Run a Specific Workflow

```bash
# Run a specific workflow
npx stone run --workflow pm --issue 123
```

This will run the PM workflow for the specified issue.

### Show Status

```bash
# Show status of Stone issues
npx stone status
```

This will show the status of all Stone issues in the repository.

### Generate GitHub Actions Workflows

```bash
# Generate GitHub Actions workflows
npx stone actions
```

This will generate GitHub Actions workflows for Stone.

### Start Dashboard

```bash
# Start the Stone dashboard
npx stone dashboard
```

This will start a web dashboard for Stone that displays performance metrics, rate limits, and issue status.

### RBAC Management

```bash
# Check RBAC permissions for files
npx stone rbac check --role developer --files src/index.ts

# List available roles
npx stone rbac list
```

### Auto-Rebase

```bash
# Auto-rebase a pull request
npx stone auto-rebase --pr 123
```

### Multi-Repository Controller

```bash
# Start the multi-repository controller
npx stone controller --config mono.stone.json
```

## Documentation

For detailed documentation, see:
- [stone-spec.md](stone-spec.md) - Core specification
- [docs/implementation-plan.md](docs/implementation-plan.md) - Implementation details
- [docs/dashboard.md](docs/dashboard.md) - Dashboard documentation
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

All pull requests will undergo automatic tests and code quality checks.

## License

MIT
