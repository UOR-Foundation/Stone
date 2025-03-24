# Stone - A Software Factory for GitHub

Stone is a structured system for orchestrating GitHub-based development using Claude Code. It manages the software development process through specialized roles, each with defined responsibilities and boundaries.

## Overview

Stone helps manage large codebases by breaking down feature implementation into discrete steps with clear ownership:

- **Role-Based Development**: Different Claude Code instances handle specific roles in the development process
- **Defined Workflow**: Standardized sequence of steps for feature implementation
- **Bounded Context**: Each role operates within appropriate context boundaries
- **GitHub Native**: Uses GitHub issues, PRs, comments, and actions for all workflows

## Installation

```bash
npm install --save-dev @uor-foundation/stone
```

## Usage

Initialize Stone in your repository:

```bash
npx stone init
```

Process a specific issue:

```bash
npx stone process --issue 123
```

View status of all Stone issues:

```bash
npx stone status
```

## Documentation

See [stone-spec.md](stone-spec.md) for detailed documentation.

## License

MIT