# Stone Dashboard

The Stone Dashboard provides a visual interface for monitoring and managing Stone workflows across your repositories.

## Accessing the Dashboard

The Stone Dashboard is available at: `https://uor-foundation.github.io/stone/`

## Features

### Workflow Visualization

The dashboard provides a visual representation of your Stone workflows:

- **Workflow States**: Track the progress of issues through various workflow states
- **Role Assignments**: Visualize which roles are currently handling specific issues
- **Timeline View**: See the history of actions taken on each issue

### Repository Status

Get a high-level overview of Stone across all connected repositories:

- **Active Issues**: Count of issues currently being processed
- **Completed Issues**: Count and success rate of completed tasks
- **Role Distribution**: Analysis of work distribution across different Claude roles

### Performance Analytics

Track performance metrics to optimize your development process:

- **API Rate Limits**: Monitor GitHub API rate limit usage and remaining quota
- **Batch Processing**: Track batch queue size and processing throughput
- **System Resources**: Monitor CPU, memory, and network usage
- **Response Times**: Track API response times and identify slow operations
- **Cycle Time**: Time from issue creation to completion
- **Role Performance**: Time spent by each role on tasks

### User Management

Features for managing user access and repository connections:

- **Authentication**: Login with GitHub credentials
- **Repository Integration**: Connect and disconnect repositories
- **Role Management**: Configure which repositories have which roles enabled

## Dashboard Sections

### Overview

The main dashboard showing the current status across all repositories:

- Active issues and their states
- Recent activity
- Performance summary

### Repository View

Detailed view of a specific repository:

- Issues categorized by workflow state
- Issue details and history
- Repository-specific performance metrics

### Analytics

In-depth performance analysis:

- Graphical representations of performance metrics
- Trend analysis over time
- Export capabilities for reporting

### Settings

Configuration options:

- Repository management
- User preferences
- Notification settings
- Role configuration

## Technical Information

The Stone Dashboard is built as a static site hosted on GitHub Pages, using:

- React for the user interface
- Vite for building and bundling
- GitHub API for data retrieval
- Chart.js for data visualization
- GitHub authentication for access control
- WebSocket for real-time updates

### Metrics API

The dashboard includes a metrics API that provides:

- Current rate limit status: `/api/metrics/rate-limits`
- Batch processing stats: `/api/metrics/batch`
- System resource usage: `/api/metrics/resources`
- Historical metrics data: `/api/metrics/history`

All metrics endpoints return JSON data that can be consumed by other applications.

## Self-Hosting

You can self-host the Stone Dashboard by:

1. Forking the Stone repository
2. Enabling GitHub Pages in your fork
3. Building and deploying the dashboard using the provided GitHub Action workflow

## API Integration

The dashboard communicates with the GitHub API to retrieve information about your repositories, issues, and Stone configurations. It requires the following permissions:

- Read access to repositories
- Read access to issues
- Read access to metadata

No write permissions are required for basic dashboard functionality.
