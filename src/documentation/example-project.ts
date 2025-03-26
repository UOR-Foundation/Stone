import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for an example file
 */
export interface ExampleFile {
  path: string;
  content: string;
}

/**
 * Interface for an example project
 */
export interface ExampleProject {
  name: string;
  description: string;
  files: ExampleFile[];
}

/**
 * Class for generating example projects
 */
export class ExampleProjectGenerator {
  private configLoader: ConfigLoader;
  private logger: Logger;

  constructor(configLoader: ConfigLoader) {
    this.configLoader = configLoader;
    this.logger = new Logger();
  }

  /**
   * Generate a basic example project
   */
  public async generateBasicExample(): Promise<void> {
    this.logger.info('Generating basic example project...');
    
    const project: ExampleProject = {
      name: 'basic-example',
      description: 'A basic Stone example project',
      files: [
        {
          path: 'README.md',
          content: `# Basic Example

This example demonstrates basic usage of Stone.

## Setup

1. Install dependencies: \`npm install\`
2. Configure Stone: Edit \`stone.config.json\`
3. Run Stone: \`npx stone init\`
`
        },
        {
          path: 'stone.config.json',
          content: `{
  "repository": {
    "owner": "example-user",
    "name": "example-repo"
  },
  "github": {
    "token": "YOUR_GITHUB_TOKEN"
  },
  "workflow": {
    "stoneLabel": "stone",
    "enablePM": true,
    "enableQA": true,
    "enableFeature": true,
    "enableAudit": true
  }
}`
        },
        {
          path: 'package.json',
          content: `{
  "name": "stone-basic-example",
  "version": "1.0.0",
  "description": "Basic Stone example",
  "scripts": {
    "start": "stone init"
  },
  "dependencies": {
    "@uor-foundation/stone": "latest"
  }
}`
        }
      ]
    };
    
    await this.createExampleProject(project);
  }

  /**
   * Generate an advanced example project
   */
  public async generateAdvancedExample(): Promise<void> {
    this.logger.info('Generating advanced example project...');
    
    const project: ExampleProject = {
      name: 'advanced-example',
      description: 'An advanced Stone example project with custom features',
      files: [
        {
          path: 'README.md',
          content: `# Advanced Example

This example demonstrates advanced usage of Stone with custom roles and workflow.

## Setup

1. Install dependencies: \`npm install\`
2. Configure Stone: Edit \`stone.config.json\`
3. Run Stone: \`npx stone init\`

## Custom Features

This example includes:

- Custom role definitions
- Custom workflow steps
- Integration with external tools
`
        },
        {
          path: 'stone.config.json',
          content: `{
  "repository": {
    "owner": "example-user",
    "name": "example-repo"
  },
  "github": {
    "token": "YOUR_GITHUB_TOKEN"
  },
  "workflow": {
    "stoneLabel": "stone",
    "enablePM": true,
    "enableQA": true,
    "enableFeature": true,
    "enableAudit": true
  },
  "customization": {
    "enableCustomRoles": true,
    "rolesDir": "./roles",
    "enablePlugins": true,
    "pluginsDir": "./plugins"
  },
  "integrations": {
    "slack": {
      "webhook": "YOUR_SLACK_WEBHOOK",
      "channel": "#stone-notifications"
    }
  }
}`
        },
        {
          path: 'package.json',
          content: `{
  "name": "stone-advanced-example",
  "version": "1.0.0",
  "description": "Advanced Stone example",
  "scripts": {
    "start": "stone init",
    "workflow": "stone run workflow"
  },
  "dependencies": {
    "@uor-foundation/stone": "latest"
  }
}`
        },
        {
          path: 'roles/custom-architect.js',
          content: `module.exports = {
  id: 'architect',
  name: 'Architect',
  description: 'Handles architectural design decisions',
  prompt: 'You are an architect responsible for making high-level design decisions.',
  systemMessages: [
    'Focus on architectural patterns and best practices',
    'Consider scalability in all designs'
  ],
  capabilities: ['design', 'review'],
  initialize: function() {
    console.log('Initializing Architect role');
  }
};`
        },
        {
          path: 'plugins/notification-plugin.js',
          content: `module.exports = {
  name: 'notification-plugin',
  version: '1.0.0',
  description: 'Plugin for additional notifications',
  author: 'Example Author',
  initialize: function() {
    console.log('Initializing notification plugin');
  },
  hooks: {
    'issue.created': {
      name: 'Issue created hook',
      handler: function(issue) {
        console.log('New issue created:', issue.title);
        // Send notifications, etc.
        return issue;
      }
    }
  }
};`
        }
      ]
    };
    
    await this.createExampleProject(project);
  }

  /**
   * Generate a custom role example project
   */
  public async generateCustomRoleExample(): Promise<void> {
    this.logger.info('Generating custom role example project...');
    
    const project: ExampleProject = {
      name: 'custom-role-example',
      description: 'A Stone example project demonstrating custom roles',
      files: [
        {
          path: 'README.md',
          content: `# Custom Role Example

This example demonstrates how to create and use custom roles in Stone.

## Setup

1. Install dependencies: \`npm install\`
2. Configure Stone: Edit \`stone.config.json\`
3. Run Stone: \`npx stone init\`

## Custom Roles

This example includes several custom roles:

- Security Auditor
- Accessibility Tester
- Performance Optimizer
`
        },
        {
          path: 'stone.config.json',
          content: `{
  "repository": {
    "owner": "example-user",
    "name": "example-repo"
  },
  "github": {
    "token": "YOUR_GITHUB_TOKEN"
  },
  "workflow": {
    "stoneLabel": "stone",
    "enableCustomRoles": true,
    "rolesDir": "./roles"
  }
}`
        },
        {
          path: 'roles/security-auditor.js',
          content: `module.exports = {
  id: 'security-auditor',
  name: 'Security Auditor',
  description: 'Handles security review of code',
  prompt: 'You are a security expert reviewing code for vulnerabilities.',
  systemMessages: [
    'Focus on identifying security vulnerabilities',
    'Check for common security issues like injection, XSS, etc.'
  ],
  capabilities: ['security-review', 'code-review'],
  initialize: function() {
    console.log('Initializing Security Auditor role');
  }
};`
        },
        {
          path: 'roles/accessibility-tester.js',
          content: `module.exports = {
  id: 'accessibility-tester',
  name: 'Accessibility Tester',
  description: 'Ensures code meets accessibility standards',
  prompt: 'You are an accessibility expert ensuring code meets WCAG guidelines.',
  systemMessages: [
    'Focus on WCAG compliance',
    'Check for proper semantic markup and ARIA attributes'
  ],
  capabilities: ['accessibility-review', 'code-review'],
  initialize: function() {
    console.log('Initializing Accessibility Tester role');
  }
};`
        }
      ]
    };
    
    await this.createExampleProject(project);
  }

  /**
   * Create an example project from a project definition
   */
  public async createExampleProject(project: ExampleProject): Promise<void> {
    const config = await this.configLoader.getConfig();
    const baseDir = config.documentation?.examplesDir || './examples';
    const projectDir = path.join(baseDir, project.name);
    
    // Create base directory if it doesn't exist
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    
    // Create project directory
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Create each file
    for (const file of project.files) {
      const filePath = path.join(projectDir, file.path);
      const fileDir = path.dirname(filePath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(filePath, file.content, 'utf8');
      this.logger.info(`Created file: ${filePath}`);
    }
    
    this.logger.success(`Example project "${project.name}" created at ${projectDir}`);
  }

  /**
   * Generate an index file for all examples
   */
  public async generateIndex(): Promise<void> {
    const config = await this.configLoader.getConfig();
    const baseDir = config.documentation?.examplesDir || './examples';
    
    if (!fs.existsSync(baseDir)) {
      this.logger.warn(`Examples directory does not exist: ${baseDir}`);
      return;
    }
    
    // Get all example directories
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const examples = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    
    if (examples.length === 0) {
      this.logger.warn('No example projects found');
      return;
    }
    
    // Generate index content
    const lines = [
      '# Stone Examples',
      '',
      'This directory contains example Stone projects:',
      ''
    ];
    
    for (const example of examples) {
      const readmePath = path.join(baseDir, example, 'README.md');
      let description = example;
      
      // Try to extract description from README
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          description = titleMatch[1];
        }
      }
      
      lines.push(`## [${description}](./${example}/)`);
      lines.push('');
    }
    
    // Write index file
    const indexPath = path.join(baseDir, 'index.md');
    fs.writeFileSync(indexPath, lines.join('\n'), 'utf8');
    
    this.logger.info(`Generated examples index at ${indexPath}`);
  }
}