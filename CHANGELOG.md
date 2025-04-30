# Changelog

All notable changes to Stone will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0-beta] - 2025-04-30

### Added

- Performance dashboard with real-time metrics visualization
  - Rate limit monitoring
  - Batch processing statistics
  - System resource usage tracking
- Role-Based Access Control (RBAC) system
  - File-based permission management
  - Role definition and enforcement
  - Pattern-based access control
- Secret redaction for sensitive information
  - Automatic detection and redaction of secrets
  - Support for custom pattern definitions
  - High-entropy string detection
- Automatic PR rebasing for conflict resolution
  - GitHub Actions integration
  - Manual trigger via CLI
  - Conflict detection and resolution
- Multi-repository controller
  - Parallel repository processing
  - Resource usage optimization
  - Centralized management
- Comprehensive test suite
  - Unit tests for all components
  - End-to-end workflow tests
  - Test fixtures for security testing

### Changed

- Improved CI workflow with pnpm caching
- Enhanced error handling and recovery
- Optimized GitHub API usage with rate limiting
- Refactored role orchestration for better performance
- Updated documentation with new features

### Fixed

- Issue processing race conditions
- GitHub API rate limit handling
- Configuration validation errors
- Role context boundary enforcement
- Workflow state management issues

## [0.1.0] - 2025-03-15

### Added

- Initial release with basic functionality
- Role-based development system
  - PM role for feature specification
  - QA role for test generation
  - Feature role for implementation
  - Auditor role for code review
  - Actions role for CI/CD integration
- GitHub integration
  - Issue and PR management
  - Label-based workflow progression
  - Comment generation
- Configuration system
  - Repository settings
  - Workflow configuration
  - Role definitions
- CLI commands
  - init - Initialize Stone in a repository
  - process - Process issues with appropriate roles
  - status - Show status of Stone issues
  - run - Run specific workflows
  - reset - Reset workflow state
