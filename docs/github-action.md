# Stone GitHub Action

This documentation explains how to use Stone as a GitHub Action in your workflows.

## Setup

Add the Stone GitHub Action to your workflow file:

```yaml
name: Stone Workflow

on:
  issues:
    types: [opened, labeled]

jobs:
  stone:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Stone
        uses: uor-foundation/stone@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          action: process
          issue-number: ${{ github.event.issue.number }}
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| github-token | GitHub token for repository access | Yes | |
| action | Action to perform (init, process, status) | Yes | status |
| issue-number | Issue number to process | No | |
| repository | Repository name in format owner/repo | No | Current repository |

## Actions

### Initialize Stone

```yaml
- name: Initialize Stone
  uses: uor-foundation/stone@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    action: init
```

This will:
- Create necessary configuration files
- Set up GitHub labels
- Generate Claude role files

### Process an Issue

```yaml
- name: Process Issue
  uses: uor-foundation/stone@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    action: process
    issue-number: ${{ github.event.issue.number }}
```

Processes the issue using the Stone workflow system with different Claude roles.

### Check Status

```yaml
- name: Check Status
  uses: uor-foundation/stone@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    action: status
```

Displays the status of all Stone-managed issues in your repository.

## Example Workflows

### Process Issues When Labeled

```yaml
name: Stone Process Issue

on:
  issues:
    types: [labeled]

jobs:
  process-issue:
    runs-on: ubuntu-latest
    if: contains(github.event.label.name, 'stone')
    steps:
      - uses: actions/checkout@v4
      
      - name: Process Issue with Stone
        uses: uor-foundation/stone@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          action: process
          issue-number: ${{ github.event.issue.number }}
```

### Daily Status Report

```yaml
name: Stone Daily Status

on:
  schedule:
    - cron: '0 8 * * 1-5'  # Every weekday at 8am

jobs:
  status-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate Status Report
        uses: uor-foundation/stone@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          action: status
```

## Configuration

The Stone GitHub Action uses the `stone.config.json` file in your repository if it exists. Otherwise, it will create a default configuration during initialization.

## Security Considerations

By default, the GitHub Action uses the `GITHUB_TOKEN` provided by GitHub Actions. This token has limited permissions. If you need additional permissions, you can create a custom token with the necessary scopes and pass it as `github-token`.