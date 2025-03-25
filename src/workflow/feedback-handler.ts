import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { LoggerService } from '../services/logger-service';

/**
 * Handles user feedback processing
 */
export class FeedbackHandler {
  constructor(
    private client: GitHubClient,
    private config: StoneConfig,
    private logger: LoggerService
  ) {}

  /**
   * Process feedback for an issue
   * @param issueNumber Issue number
   */
  public async processFeedback(issueNumber: number): Promise<void> {
    this.logger.info(`Processing feedback for issue #${issueNumber}`);
    // Implementation will be added in a future PR
  }
}