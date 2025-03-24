import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config/schema';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Handles GitHub Actions workflow file generation
 */
export class WorkflowGenerator {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
  }

  /**
   * Create the main Stone workflow file
   */
  public async createStoneWorkflow(): Promise<void> {
    const workflowDir = path.join(
      process.cwd(),
      this.config.github.actionsDirectory
    );

    this.ensureDirectoryExists(workflowDir);

    const workflowPath = path.join(workflowDir, 'stone-workflow.yml');

    // Define the main workflow that handles Stone process
    const workflowDefinition = {
      name: 'Stone Software Factory',
      on: {
        issues: {
          types: ['labeled', 'unlabeled', 'edited'],
        },
        workflow_dispatch: {
          inputs: {
            issue_number: {
              description: 'GitHub issue number to process',
              required: true,
              type: 'number',
            },
          },
        },
      },
      jobs: {
        stone_process: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {
              name: 'Checkout repository',
              uses: 'actions/checkout@v4',
            },
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v4',
              with: {
                'node-version': '20',
                cache: 'npm',
              },
            },
            {
              name: 'Install dependencies',
              run: 'npm ci',
            },
            {
              name: 'Process Stone issue',
              run: this.generateProcessCommand(),
              env: {
                GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
              },
            },
          ],
        },
      },
    };

    // Write the workflow file
    fs.writeFileSync(
      workflowPath,
      yaml.dump(workflowDefinition, { lineWidth: -1 })
    );

    this.logger.info(`Created Stone workflow at ${workflowPath}`);
  }

  /**
   * Create the test workflow file
   */
  public async createTestWorkflow(): Promise<void> {
    const workflowDir = path.join(
      process.cwd(),
      this.config.github.actionsDirectory
    );

    this.ensureDirectoryExists(workflowDir);

    const workflowPath = path.join(workflowDir, 'stone-test.yml');

    // Define the test workflow
    const workflowDefinition = {
      name: 'Stone Test Runner',
      on: {
        issues: {
          types: ['labeled'],
        },
        workflow_dispatch: {
          inputs: {
            issue_number: {
              description: 'GitHub issue number to test',
              required: true,
              type: 'number',
            },
          },
        },
      },
      jobs: {
        run_tests: {
          'runs-on': 'ubuntu-latest',
          if: "github.event.label.name == 'stone-ready-for-tests' || github.event_name == 'workflow_dispatch'",
          steps: [
            {
              name: 'Checkout repository',
              uses: 'actions/checkout@v4',
            },
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v4',
              with: {
                'node-version': '20',
                cache: 'npm',
              },
            },
            {
              name: 'Install dependencies',
              run: 'npm ci',
            },
            {
              name: 'Run tests',
              run: this.generateTestCommand(),
              env: {
                GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
              },
            },
          ],
        },
      },
    };

    // Write the workflow file
    fs.writeFileSync(
      workflowPath,
      yaml.dump(workflowDefinition, { lineWidth: -1 })
    );

    this.logger.info(`Created test workflow at ${workflowPath}`);
  }

  /**
   * Create the webhook handler workflow
   */
  public async createWebhookWorkflow(): Promise<void> {
    const workflowDir = path.join(
      process.cwd(),
      this.config.github.actionsDirectory
    );

    this.ensureDirectoryExists(workflowDir);

    const workflowPath = path.join(workflowDir, 'stone-webhook.yml');

    // Define the webhook workflow
    const workflowDefinition = {
      name: 'Stone Webhook Handler',
      on: {
        repository_dispatch: {
          types: ['stone-webhook'],
        },
      },
      jobs: {
        process_webhook: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {
              name: 'Checkout repository',
              uses: 'actions/checkout@v4',
            },
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v4',
              with: {
                'node-version': '20',
                cache: 'npm',
              },
            },
            {
              name: 'Install dependencies',
              run: 'npm ci',
            },
            {
              name: 'Process webhook',
              run: 'npx stone webhook --event-type="${{ github.event.client_payload.event_type }}" --payload-file=webhook-payload.json',
              env: {
                GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
              },
            },
          ],
        },
      },
    };

    // Write the workflow file
    fs.writeFileSync(
      workflowPath,
      yaml.dump(workflowDefinition, { lineWidth: -1 })
    );

    this.logger.info(`Created webhook workflow at ${workflowPath}`);
  }

  /**
   * Update an existing workflow file
   */
  public async updateWorkflow(
    workflowName: string,
    definition: any
  ): Promise<void> {
    const workflowDir = path.join(
      process.cwd(),
      this.config.github.actionsDirectory
    );

    const workflowPath = path.join(workflowDir, workflowName);

    // Check if the file exists
    if (fs.existsSync(workflowPath)) {
      // Write the updated workflow
      fs.writeFileSync(workflowPath, yaml.dump(definition, { lineWidth: -1 }));
      this.logger.info(`Updated workflow at ${workflowPath}`);
    } else {
      throw new Error(`Workflow file ${workflowPath} does not exist`);
    }
  }

  /**
   * Process an issue with the 'stone-actions' label
   */
  public async processIssueWithActionsLabel(issueNumber: number): Promise<void> {
    // Get the issue details
    const { data: issue } = await this.client.getIssue(issueNumber);

    // Check if the issue has the 'stone-actions' label
    const hasActionsLabel = issue.labels.some((label: any) => {
      return typeof label === 'string'
        ? label === 'stone-actions'
        : label.name === 'stone-actions';
    });

    if (!hasActionsLabel) {
      this.logger.info(
        `Issue #${issueNumber} does not have the 'stone-actions' label`
      );
      return;
    }

    this.logger.info(`Processing GitHub Actions for issue #${issueNumber}`);

    // Analyze the issue to determine what workflows to create or update
    // This is where we would examine comments and test files from the QA role
    // For now, we'll simply create and update the standard workflows

    try {
      // Create or update the main workflow files
      await this.createStoneWorkflow();
      await this.createTestWorkflow();
      if (this.config.workflow.useWebhooks) {
        await this.createWebhookWorkflow();
      }

      // Add a comment to the issue
      await this.client.createIssueComment(
        issueNumber,
        `## GitHub Actions Updated\n\nThe following workflow files have been created/updated:\n\n` +
          `- \`.github/workflows/stone-workflow.yml\`\n` +
          `- \`.github/workflows/stone-test.yml\`${
            this.config.workflow.useWebhooks
              ? '\n- `.github/workflows/stone-webhook.yml`'
              : ''
          }\n\n` +
          `These workflows will automatically process Stone issues based on their labels.`
      );

      // Update the issue labels
      await this.client.addLabelsToIssue(issueNumber, [
        'stone-feature-implement',
      ]);
      await this.client.removeLabelFromIssue(issueNumber, 'stone-actions');

      this.logger.success(`Completed GitHub Actions for issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(
        `Error processing GitHub Actions for issue #${issueNumber}: ${error}`
      );
      await this.client.createIssueComment(
        issueNumber,
        `## Error Processing GitHub Actions\n\nAn error occurred while processing GitHub Actions for this issue:\n\n\`\`\`\n${error}\n\`\`\``
      );
    }
  }

  /**
   * Generate the process command for the workflow
   */
  private generateProcessCommand(): string {
    let command = '';

    // Handle both automated and manual trigger cases
    command += 'if [ "${{ github.event_name }}" = "issues" ]; then\\\n' +
               '  ISSUE_NUMBER="${{ github.event.issue.number }}"\\\n' +
               'else\\\n' +
               '  ISSUE_NUMBER="${{ github.event.inputs.issue_number }}"\\\n' +
               'fi\n\n';

    // Add the actual Stone command
    command += `npx stone process --issue $ISSUE_NUMBER`;

    return command;
  }

  /**
   * Generate the test command for the workflow
   */
  private generateTestCommand(): string {
    let command = '';

    // Handle both automated and manual trigger cases
    command += 'if [ "${{ github.event_name }}" = "issues" ]; then\\\n' +
               '  ISSUE_NUMBER="${{ github.event.issue.number }}"\\\n' +
               'else\\\n' +
               '  ISSUE_NUMBER="${{ github.event.inputs.issue_number }}"\\\n' +
               'fi\n\n';

    // Add the actual Stone command
    command += `npx stone run --workflow test --issue $ISSUE_NUMBER`;

    return command;
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}