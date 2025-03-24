import { GitHubClient } from './client';
import { StoneConfig } from '../config';

interface LabelDefinition {
  name: string;
  color: string;
  description: string;
}

export class LabelManager {
  private client: GitHubClient;
  private config: StoneConfig;

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Create all required Stone labels in the repository
   */
  public async createLabels(): Promise<void> {
    const labels: LabelDefinition[] = [
      {
        name: this.config.workflow.stoneLabel,
        color: '0075ca',
        description: 'Process this issue with the Stone software factory',
      },
      {
        name: 'stone-qa',
        color: 'd93f0b',
        description: 'Ready for test creation by QA team',
      },
      {
        name: 'stone-actions',
        color: '5319e7',
        description: 'Ready for GitHub Actions workflow setup',
      },
      {
        name: 'stone-feature-implement',
        color: '0e8a16',
        description: 'Ready for feature implementation',
      },
      {
        name: 'stone-feature-fix',
        color: 'fbca04',
        description: 'Needs fixes from feature team',
      },
      {
        name: 'stone-audit',
        color: 'b60205',
        description: 'Ready for implementation audit',
      },
      {
        name: 'stone-audit-pass',
        color: '0e8a16',
        description: 'Implementation passed audit',
      },
      {
        name: 'stone-audit-fail',
        color: 'b60205',
        description: 'Implementation failed audit',
      },
      {
        name: 'stone-ready-for-tests',
        color: '1d76db',
        description: 'Ready for test execution',
      },
      {
        name: 'stone-test-failure',
        color: 'e99695',
        description: 'Tests are failing',
      },
      {
        name: 'stone-docs',
        color: '0075ca',
        description: 'Ready for documentation updates',
      },
      {
        name: 'stone-pr',
        color: '6f42c1',
        description: 'Ready for pull request creation',
      },
      {
        name: 'stone-complete',
        color: '0e8a16',
        description: 'Stone process completed successfully',
      },
      {
        name: 'stone-feedback',
        color: 'd4c5f9',
        description: 'Feedback from PR review',
      },
      {
        name: 'stone-dependency',
        color: 'c2e0c6',
        description: 'Depends on changes in another package',
      },
      {
        name: 'stone-error',
        color: 'b60205',
        description: 'An error occurred in the Stone process',
      },
    ];

    // Create each label if it doesn't exist
    for (const label of labels) {
      try {
        await this.createLabel(label);
      } catch (error) {
        // If label already exists, update it
        if (error instanceof Error && error.message.includes('already_exists')) {
          await this.updateLabel(label);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Create a single label
   */
  private async createLabel(label: LabelDefinition): Promise<void> {
    await this.client.octokit.rest.issues.createLabel({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      name: label.name,
      color: label.color,
      description: label.description,
    });
  }

  /**
   * Update an existing label
   */
  private async updateLabel(label: LabelDefinition): Promise<void> {
    await this.client.octokit.rest.issues.updateLabel({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      name: label.name,
      color: label.color,
      description: label.description,
    });
  }
}