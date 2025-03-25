import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { LoggerService } from '../services/logger-service';

/**
 * Interface representing a feedback item
 */
export interface FeedbackItem {
  type: string;
  content: string;
  author: string;
  priority: string;
  source?: {
    type: 'pr' | 'issue';
    number: number;
  };
}

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
   * Analyze PR comments to identify feedback
   * @param prNumber PR number to analyze
   * @returns Array of feedback items
   */
  public async analyzePRComments(prNumber: number): Promise<FeedbackItem[]> {
    try {
      this.logger.info(`Analyzing PR #${prNumber} comments for feedback`);
      
      // Get PR comments
      const commentsResult = await this.client.octokit.rest.pulls.listComments({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        pull_number: prNumber,
      });
      
      // Parse comments for feedback
      const feedbackItems: FeedbackItem[] = [];
      
      for (const comment of commentsResult.data) {
        const feedbackType = this.classifyFeedbackType(comment.body);
        
        if (feedbackType) {
          feedbackItems.push({
            type: feedbackType,
            content: this.extractFeedbackContent(comment.body),
            author: comment.user?.login || 'unknown',
            priority: 'unset',
            source: {
              type: 'pr',
              number: prNumber
            }
          });
        }
      }
      
      this.logger.info(`Found ${feedbackItems.length} feedback items in PR #${prNumber}`);
      return feedbackItems;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to analyze PR comments for PR #${prNumber}`, { error: errorMessage });
      throw new Error(`PR comment analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Classify feedback type from comment content
   * @param commentBody Comment content
   * @returns Feedback type or null if not feedback
   */
  private classifyFeedbackType(commentBody: string): string | null {
    // Simple classification based on keywords
    const lowerContent = commentBody.toLowerCase();
    
    if (lowerContent.includes('bug') || 
        lowerContent.includes('doesn\'t work') || 
        lowerContent.includes('broken') ||
        lowerContent.includes('fix') ||
        lowerContent.includes('error')) {
      return 'bug';
    }
    
    if (lowerContent.includes('feature request') || 
        lowerContent.includes('would be nice') || 
        lowerContent.includes('should add') ||
        lowerContent.includes('enhancement')) {
      return 'enhancement';
    }
    
    if (lowerContent.includes('question') || 
        lowerContent.includes('how do') || 
        lowerContent.includes('why does') ||
        lowerContent.includes('clarify')) {
      return 'question';
    }
    
    if (lowerContent.includes('documentation') || 
        lowerContent.includes('docs') || 
        lowerContent.includes('example') ||
        lowerContent.includes('comment')) {
      return 'documentation';
    }
    
    // Check if it contains feedback but didn't match any specific category
    if (lowerContent.includes('feedback') || 
        lowerContent.includes('suggest') || 
        lowerContent.includes('improve') ||
        lowerContent.includes('should')) {
      return 'general';
    }
    
    return null;
  }

  /**
   * Extract relevant content from a comment
   * @param commentBody Comment content
   * @returns Cleaned content
   */
  private extractFeedbackContent(commentBody: string): string {
    // Simple extraction - in a more sophisticated implementation,
    // this would use NLP or better context parsing
    return commentBody.split('\n')
      .filter(line => !line.trim().startsWith('>')) // Remove quoted content
      .join('\n')
      .trim();
  }

  /**
   * Generate an issue from feedback items
   * @param feedback Feedback items to include
   * @param sourceNumber Source PR or issue number
   * @returns New issue number
   */
  public async generateFeedbackIssue(feedback: FeedbackItem[], sourceNumber: number): Promise<number> {
    try {
      // Skip if no feedback
      if (feedback.length === 0) {
        this.logger.info('No feedback to generate issue for');
        return 0;
      }
      
      this.logger.info(`Generating feedback issue for ${feedback.length} items`);
      
      // Determine main feedback type
      const types = feedback.map(f => f.type);
      const mainType = this.getMostFrequent(types);
      
      // Determine priority
      const highestPriority = feedback
        .map(f => f.priority)
        .sort((a, b) => this.priorityToRank(a) - this.priorityToRank(b))[0];
      
      // Create issue title
      const title = `Feedback: ${mainType} from PR #${sourceNumber}`;
      
      // Create issue body
      let body = `# Feedback from PR #${sourceNumber}\n\n`;
      body += `Priority: ${highestPriority}\n\n`;
      
      // Group feedback by type
      const feedbackByType: Record<string, FeedbackItem[]> = {};
      
      for (const item of feedback) {
        if (!feedbackByType[item.type]) {
          feedbackByType[item.type] = [];
        }
        feedbackByType[item.type].push(item);
      }
      
      // Add feedback to body
      for (const type in feedbackByType) {
        body += `## ${type.charAt(0).toUpperCase() + type.slice(1)}\n\n`;
        
        for (const item of feedbackByType[type]) {
          body += `### From @${item.author}\n\n`;
          body += `${item.content}\n\n`;
          body += `Priority: ${item.priority}\n\n`;
          body += `---\n\n`;
        }
      }
      
      // Add source information
      body += `Generated from feedback in PR #${sourceNumber} - ${this.getRepoUrl()}/pull/${sourceNumber}`;
      
      // Create the issue
      const result = await this.client.octokit.rest.issues.create({
        owner: this.config.repository.owner,
        repo: this.config.repository.name,
        title,
        body,
        labels: ['feedback', `priority-${highestPriority}`, mainType]
      });
      
      this.logger.info(`Created feedback issue #${result.data.number}`);
      return result.data.number;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to generate feedback issue', { error: errorMessage });
      throw new Error(`Feedback issue generation failed: ${errorMessage}`);
    }
  }

  /**
   * Get repository URL
   * @returns Repository URL
   */
  private getRepoUrl(): string {
    return `https://github.com/${this.config.repository.owner}/${this.config.repository.name}`;
  }

  /**
   * Get most frequent item in an array
   * @param arr Array of items
   * @returns Most frequent item
   */
  private getMostFrequent<T>(arr: T[]): T {
    const counts = arr.reduce((acc, val) => {
      acc[String(val)] = (acc[String(val)] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let maxCount = 0;
    let maxItem: string = arr[0] as unknown as string;
    
    for (const item in counts) {
      if (counts[item] > maxCount) {
        maxCount = counts[item];
        maxItem = item;
      }
    }
    
    return maxItem as unknown as T;
  }

  /**
   * Convert priority string to numeric rank (lower is higher priority)
   * @param priority Priority string
   * @returns Numeric rank
   */
  private priorityToRank(priority: string): number {
    const ranks: Record<string, number> = {
      'high': 0,
      'medium': 1,
      'low': 2,
      'unset': 3
    };
    
    return ranks[priority] ?? 3;
  }

  /**
   * Route feedback to appropriate teams
   * @param feedbackIssueNumber Feedback issue number
   * @param feedback Feedback items
   */
  public async routeFeedback(feedbackIssueNumber: number, feedback: FeedbackItem[]): Promise<void> {
    try {
      // Skip if no feedback
      if (feedback.length === 0) {
        this.logger.info('No feedback to route');
        return;
      }
      
      this.logger.info(`Routing feedback for issue #${feedbackIssueNumber}`);
      
      // Check if teams are defined in config
      if (!this.config.teams || this.config.teams.length === 0) {
        this.logger.info('No teams defined in config, skipping routing');
        return;
      }
      
      // Combine all feedback content for analysis
      const combinedContent = feedback
        .map(item => item.content)
        .join(' ')
        .toLowerCase();
      
      // Match content against team areas
      const matchedTeams = new Set<string>();
      
      for (const team of this.config.teams) {
        if (team.areas && team.areas.length > 0) {
          for (const area of team.areas) {
            if (combinedContent.includes(area.toLowerCase())) {
              matchedTeams.add(team.name);
              break;
            }
          }
        }
      }
      
      // Add comment with routing information
      if (matchedTeams.size > 0) {
        const routingComment = `## Feedback Routing\n\nThis feedback has been routed to the following teams:\n\n${
          Array.from(matchedTeams).map(team => `- ${team}`).join('\n')
        }`;
        
        await this.client.createIssueComment(feedbackIssueNumber, routingComment);
        
        // Add team labels if they exist
        const teamLabels = Array.from(matchedTeams).map(team => `team-${team.toLowerCase().replace(/\s+/g, '-')}`);
        if (teamLabels.length > 0) {
          await this.client.addLabelsToIssue(feedbackIssueNumber, teamLabels);
        }
      } else {
        await this.client.createIssueComment(
          feedbackIssueNumber,
          '## Feedback Routing\n\nNo specific teams could be identified for this feedback. General team should review.'
        );
        
        // Add general label
        await this.client.addLabelsToIssue(feedbackIssueNumber, ['team-general']);
      }
      
      this.logger.info(`Feedback routed for issue #${feedbackIssueNumber}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to route feedback for issue #${feedbackIssueNumber}`, { error: errorMessage });
      throw new Error(`Feedback routing failed: ${errorMessage}`);
    }
  }

  /**
   * Prioritize feedback based on content and source
   * @param feedback Feedback items to prioritize
   * @returns Prioritized feedback items
   */
  public prioritizeFeedback(feedback: FeedbackItem[]): FeedbackItem[] {
    // Skip if no feedback
    if (feedback.length === 0) {
      return [];
    }
    
    this.logger.info(`Prioritizing ${feedback.length} feedback items`);
    
    // Priority keywords
    const highPriorityKeywords = ['critical', 'urgent', 'blocker', 'security', 'crash', 'broken'];
    const mediumPriorityKeywords = ['important', 'should', 'needed', 'bug', 'error'];
    const lowPriorityKeywords = ['minor', 'typo', 'cosmetic', 'nice to have', 'would be nice'];
    
    // Prioritize each feedback item
    return feedback.map(item => {
      const content = item.content.toLowerCase();
      let priority = 'low';
      
      // Check for high priority keywords
      if (highPriorityKeywords.some(keyword => content.includes(keyword))) {
        priority = 'high';
      }
      // Check for medium priority keywords
      else if (mediumPriorityKeywords.some(keyword => content.includes(keyword))) {
        priority = 'medium';
      }
      // Check for low priority keywords
      else if (lowPriorityKeywords.some(keyword => content.includes(keyword))) {
        priority = 'low';
      }
      
      // If feedback is from a recognized high-priority source, increase priority
      // In a real implementation, this would check against a list of key stakeholders
      
      // Return updated item
      return {
        ...item,
        priority
      };
    });
  }

  /**
   * Process feedback for an issue
   * @param issueNumber Issue number
   */
  public async processFeedback(issueNumber: number): Promise<void> {
    try {
      this.logger.info(`Processing feedback for issue #${issueNumber}`);
      
      // Get issue details
      const issueData = await this.client.getIssue(issueNumber);
      
      // Find related PRs
      const searchResult = await this.client.octokit.rest.search.issuesAndPullRequests({
        q: `repo:${this.config.repository.owner}/${this.config.repository.name} is:pr issue:${issueNumber}`,
      });
      
      // Get feedback from all PRs
      let allFeedback: FeedbackItem[] = [];
      
      for (const item of searchResult.data.items) {
        if (item.pull_request) {
          const prNumber = item.number;
          const prFeedback = await this.analyzePRComments(prNumber);
          allFeedback = [...allFeedback, ...prFeedback];
        }
      }
      
      // Skip if no feedback
      if (allFeedback.length === 0) {
        await this.client.createIssueComment(
          issueNumber,
          `## Feedback Processing\n\nNo feedback found for issue #${issueNumber}.`
        );
        return;
      }
      
      // Prioritize feedback
      const prioritizedFeedback = this.prioritizeFeedback(allFeedback);
      
      // Generate feedback issue
      const feedbackIssueNumber = await this.generateFeedbackIssue(prioritizedFeedback, issueNumber);
      
      // Route feedback to teams
      if (feedbackIssueNumber > 0) {
        await this.routeFeedback(feedbackIssueNumber, prioritizedFeedback);
      
        // Add comment to original issue
        await this.client.createIssueComment(
          issueNumber,
          `## Feedback Processing\n\nFeedback processing complete for issue #${issueNumber}.\n\nFeedback has been collected and organized in issue #${feedbackIssueNumber}: ${this.getRepoUrl()}/issues/${feedbackIssueNumber}`
        );
        
        // Add label to indicate feedback was processed
        await this.client.addLabelsToIssue(issueNumber, ['stone-feedback-processed']);
      } else {
        await this.client.createIssueComment(
          issueNumber,
          `## Feedback Processing\n\nFeedback processing complete for issue #${issueNumber}, but no feedback issue was created because no feedback was found.`
        );
      }
      
      this.logger.info(`Feedback processing completed for issue #${issueNumber}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process feedback for issue #${issueNumber}`, { error: errorMessage });
      throw new Error(`Feedback processing failed: ${errorMessage}`);
    }
  }
}