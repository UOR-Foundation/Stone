# Stone - A Software Factory for GitHub

Stone is a structured system for orchestrating GitHub-based development using Claude Code. It manages the software development process through specialized roles, each with defined responsibilities and boundaries.

[![Tests](https://github.com/uor-foundation/stone/actions/workflows/test.yml/badge.svg)](https://github.com/uor-foundation/stone/actions/workflows/test.yml)
[![PR Checks](https://github.com/uor-foundation/stone/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/uor-foundation/stone/actions/workflows/pr-checks.yml)

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

## Contributing

We welcome contributions to Stone! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

All PRs will run automatic tests and code quality checks.

## License

MIT