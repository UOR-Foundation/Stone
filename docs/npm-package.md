# Stone npm Package

## Installation

Stone is available as an npm package hosted on GitHub Packages.

```bash
# Add to your .npmrc file
@uor-foundation:registry=https://npm.pkg.github.com

# Install as a dev dependency
npm install --save-dev @uor-foundation/stone
```

## Usage

Once installed, you can use Stone in your repository:

### Initialize Stone

```bash
npx stone init
```

This will:
- Create necessary configuration files
- Set up GitHub labels
- Generate Claude role files

### Process an Issue

```bash
npx stone process --issue 123
```

Processes the issue using the Stone workflow system with different Claude roles.

### Check Status

```bash
npx stone status
```

Displays the status of all Stone-managed issues in your repository.

## API Usage

You can also use Stone programmatically:

```typescript
import { init, runWorkflow, StoneConfig } from '@uor-foundation/stone';

// Initialize Stone in a repository
await init({
  owner: 'your-org',
  name: 'your-repo',
  token: 'github-token'
});

// Run a specific workflow
await runWorkflow('feature', 123, { token: 'github-token' });
```

## Configuration

Stone can be configured using a `stone.config.json` file at the root of your repository:

```json
{
  "repository": {
    "owner": "your-org",
    "name": "your-repo"
  },
  "github": {
    "labels": {
      "prefix": "stone",
      "colors": {
        "pm": "0366d6",
        "feature": "d73a4a",
        "qa": "fbca04",
        "security": "5319e7",
        "actions": "006b75"
      }
    }
  },
  "claude": {
    "roles": ["pm", "feature", "qa", "security", "actions"]
  },
  "workflow": {
    "enabled": true,
    "defaultBranch": "main"
  }
}
```

## Available Exports

Stone exports several components that you can use in your own code:

```typescript
import {
  // Core components
  ClaudeClient,
  RoleManager,
  RoleOrchestrator,
  
  // GitHub components
  GitHubActionsIntegration,
  WorkflowGenerator,
  
  // Security components
  TokenManager,
  AccessControlManager,
  
  // Performance components
  RateLimiter,
  ParallelExecutor
} from '@uor-foundation/stone';
```

## CLI Commands

Stone provides several CLI commands:

- `stone init`: Initialize Stone in a repository
- `stone process --issue <number>`: Process a specific issue
- `stone status`: Display status of all Stone issues
- `stone reset`: Reset Stone configuration and state
- `stone run --workflow <type> --issue <number>`: Run a specific workflow type
- `stone actions --generate`: Generate GitHub Action workflows