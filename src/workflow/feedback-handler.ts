import { GithubService } from '../services/github-service';
import { LoggerService } from '../services/logger-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analysis result of PR feedback
 */
export interface FeedbackAnalysisResult {
  /**
   * List of actionable feedback items
   */
  actionItems: FeedbackItem[];
  
  /**
   * Summary of the feedback analysis
   */
  summary: string;
}

/**
 * A single feedback item
 */
export interface FeedbackItem {
  /**
   * Unique identifier for the feedback item
   */
  id: string;
  
  /**
   * Description of the feedback
   */
  description: string;
  
  /**
   * Severity level of the feedback
   */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Author of the feedback
   */
  author: string;
  
  /**
   * Area of code affected by the feedback
   */
  affectedArea: string;
  
  /**
   * ID of the source comment
   */
  sourceComment: number;
}

/**
 * Result of creating issues from feedback
 */
export interface FeedbackIssueCreationResult {
  /**
   * List of created issues
   */
  createdIssues: Array<{
    /**
     * Issue number
     */
    issueNumber: number;
    
    /**
     * Feedback item that generated the issue
     */
    feedbackItem: FeedbackItem;
  }>;
  
  /**
   * Summary of the issue creation
   */
  summary: string;
}

/**
 * Result of routing feedback to teams
 */
export interface FeedbackRoutingResult {
  /**
   * List of routed issues
   */
  routedIssues: Array<{
    /**
     * Issue number
     */
    issueNumber: number;
    
    /**
     * Team assigned to the issue
     */
    team: string;
    
    /**
     * Feedback item that generated the issue
     */
    feedbackItem: FeedbackItem;
  }>;
  
  /**
   * Summary of the routing
   */
  summary: string;
}

/**
 * Result of prioritizing feedback
 */
export interface FeedbackPrioritizationResult {
  /**
   * List of prioritized issues
   */
  prioritizedIssues: Array<{
    /**
     * Issue number
     */
    issueNumber: number;
    
    /**
     * Priority level assigned
     */
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    
    /**
     * Feedback item that generated the issue
     */
    feedbackItem: FeedbackItem;
  }>;
  
  /**
   * Summary of the prioritization
   */
  summary: string;
}

/**
 * Handles user feedback from PR comments
 */
export class FeedbackHandler {
  /**
   * Creates an instance of FeedbackHandler
   * @param githubService Service for GitHub API operations
   * @param logger Service for logging
   */
  constructor(
    private githubService: GithubService,
    private logger: LoggerService
  ) {}

  /**
   * Analyzes comments on a PR to extract actionable feedback
   * @param prNumber PR number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @returns Feedback analysis result
   */
  async analyzeFeedback(
    prNumber: number, 
    repoOwner: string, 
    repoName: string
  ): Promise<FeedbackAnalysisResult> {
    try {
      this.logger.info(`Analyzing feedback for PR #${prNumber}`, { 
        prNumber, 
        repoOwner, 
        repoName 
      });

      // Get PR comments
      const comments = await this.githubService.getPullRequestComments(
        prNumber, 
        repoOwner, 
        repoName
      );
      
      if (!comments || comments.length === 0) {
        this.logger.info(`No comments found on PR #${prNumber}`, { prNumber });
        return {
          actionItems: [],
          summary: `No comments found on PR #${prNumber}`
        };
      }
      
      this.logger.info(`Found ${comments.length} comments on PR #${prNumber}`, { 
        prNumber, 
        commentCount: comments.length 
      });
      
      // Extract actionable feedback from comments
      const actionItems: FeedbackItem[] = [];
      
      for (const comment of comments) {
        // Skip system comments or approvals without actionable feedback
        if (this.isNonActionableComment(comment.body)) {
          continue;
        }
        
        // Determine if comment contains actionable feedback
        const feedbackItem = this.extractFeedbackFromComment(
          comment.body, 
          comment.user.login, 
          comment.id
        );
        
        if (feedbackItem) {
          actionItems.push(feedbackItem);
        }
      }
      
      let summary = '';
      if (actionItems.length > 0) {
        summary = `Found ${actionItems.length} actionable feedback items from PR #${prNumber} comments`;
        this.logger.info(summary, { prNumber, actionItemCount: actionItems.length });
      } else {
        summary = `No actionable feedback found in PR #${prNumber} comments`;
        this.logger.info(summary, { prNumber });
      }
      
      return {
        actionItems,
        summary
      };
    } catch (error: any) {
      this.logger.error(
        `Error analyzing feedback for PR #${prNumber}`, 
        error,
        { prNumber, repoOwner, repoName }
      );
      throw new Error(`Failed to analyze feedback: ${error.message}`);
    }
  }

  /**
   * Creates issues from feedback action items
   * @param actionItems List of feedback items
   * @param prNumber PR number
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @returns Issue creation result
   */
  async createFeedbackIssues(
    actionItems: FeedbackItem[],
    prNumber: number,
    repoOwner: string,
    repoName: string
  ): Promise<FeedbackIssueCreationResult> {
    try {
      this.logger.info(`Creating issues from feedback for PR #${prNumber}`, { 
        prNumber, 
        actionItemCount: actionItems.length 
      });

      if (!actionItems || actionItems.length === 0) {
        this.logger.info(`No feedback items to create issues for PR #${prNumber}`, { prNumber });
        return {
          createdIssues: [],
          summary: 'No feedback items to create issues'
        };
      }
      
      const createdIssues: Array<{
        issueNumber: number;
        feedbackItem: FeedbackItem;
      }> = [];
      
      for (const item of actionItems) {
        // Create issue title and body
        const title = this.createIssueTitleFromFeedback(item);
        const body = this.createIssueBodyFromFeedback(item, prNumber);
        
        // Create the issue
        const issue = await this.githubService.createIssue(
          repoOwner,
          repoName,
          title,
          body
        );
        
        // Add labels based on severity and feedback source
        await this.githubService.addLabelToIssue(
          issue.number,
          repoOwner,
          repoName,
          'stone-feedback'
        );
        
        await this.githubService.addLabelToIssue(
          issue.number,
          repoOwner,
          repoName,
          `severity-${item.severity}`
        );
        
        createdIssues.push({
          issueNumber: issue.number,
          feedbackItem: item
        });
        
        this.logger.info(`Created issue #${issue.number} from feedback`, { 
          issueNumber: issue.number, 
          feedbackId: item.id 
        });
      }
      
      const summary = `Created ${createdIssues.length} issues from feedback for PR #${prNumber}`;
      this.logger.info(summary, { prNumber, issueCount: createdIssues.length });
      
      return {
        createdIssues,
        summary
      };
    } catch (error: any) {
      this.logger.error(
        `Error creating issues from feedback for PR #${prNumber}`, 
        error,
        { prNumber, repoOwner, repoName }
      );
      throw new Error(`Failed to create feedback issues: ${error.message}`);
    }
  }

  /**
   * Routes feedback issues to appropriate teams
   * @param actionItems List of feedback items
   * @param issueNumbers List of created issue numbers
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @param teamMappings Mapping of affected areas to teams
   * @returns Feedback routing result
   */
  async routeFeedbackToTeams(
    actionItems: FeedbackItem[],
    issueNumbers: number[],
    repoOwner: string,
    repoName: string,
    teamMappings: Record<string, string>
  ): Promise<FeedbackRoutingResult> {
    try {
      this.logger.info(`Routing feedback issues to teams`, { 
        issueCount: issueNumbers.length,
        repoOwner,
        repoName 
      });

      if (!actionItems || actionItems.length === 0 || !issueNumbers || issueNumbers.length === 0) {
        this.logger.info(`No feedback issues to route`, { repoOwner, repoName });
        return {
          routedIssues: [],
          summary: 'No feedback issues to route'
        };
      }
      
      const routedIssues: Array<{
        issueNumber: number;
        team: string;
        feedbackItem: FeedbackItem;
      }> = [];
      
      for (let i = 0; i < Math.min(actionItems.length, issueNumbers.length); i++) {
        const item = actionItems[i];
        const issueNumber = issueNumbers[i];
        
        // Determine which team should handle this issue
        let team = teamMappings[item.affectedArea];
        if (!team) {
          team = teamMappings.default || 'core-team';
        }
        
        // Assign issue to team
        await this.githubService.assignIssueToTeam(
          issueNumber,
          repoOwner,
          repoName,
          team
        );
        
        // Add team label
        await this.githubService.addLabelToIssue(
          issueNumber,
          repoOwner,
          repoName,
          `team-${team}`
        );
        
        routedIssues.push({
          issueNumber,
          team,
          feedbackItem: item
        });
        
        this.logger.info(`Routed issue #${issueNumber} to team ${team}`, { 
          issueNumber, 
          team, 
          affectedArea: item.affectedArea 
        });
      }
      
      const summary = `Routed ${routedIssues.length} feedback issues to appropriate teams`;
      this.logger.info(summary, { issueCount: routedIssues.length });
      
      return {
        routedIssues,
        summary
      };
    } catch (error: any) {
      this.logger.error(
        `Error routing feedback issues to teams`, 
        error,
        { issueCount: issueNumbers.length, repoOwner, repoName }
      );
      throw new Error(`Failed to route feedback issues: ${error.message}`);
    }
  }

  /**
   * Prioritizes feedback issues based on severity
   * @param actionItems List of feedback items
   * @param issueNumbers List of created issue numbers
   * @param repoOwner Repository owner
   * @param repoName Repository name
   * @returns Feedback prioritization result
   */
  async prioritizeFeedback(
    actionItems: FeedbackItem[],
    issueNumbers: number[],
    repoOwner: string,
    repoName: string
  ): Promise<FeedbackPrioritizationResult> {
    try {
      this.logger.info(`Prioritizing feedback issues`, { 
        issueCount: issueNumbers.length,
        repoOwner,
        repoName 
      });

      if (!actionItems || actionItems.length === 0 || !issueNumbers || issueNumbers.length === 0) {
        this.logger.info(`No feedback issues to prioritize`, { repoOwner, repoName });
        return {
          prioritizedIssues: [],
          summary: 'No feedback issues to prioritize'
        };
      }
      
      // Pair items with issue numbers and sort by severity
      const pairs = actionItems.map((item, index) => ({
        item,
        issueNumber: issueNumbers[index]
      }));
      
      // Sort by severity (critical -> high -> medium -> low)
      const sortedPairs = this.sortFeedbackBySeverity(pairs);
      
      const prioritizedIssues: Array<{
        issueNumber: number;
        priority: 'P0' | 'P1' | 'P2' | 'P3';
        feedbackItem: FeedbackItem;
      }> = [];
      
      for (let i = 0; i < sortedPairs.length; i++) {
        const { item, issueNumber } = sortedPairs[i];
        
        // Determine priority level based on severity
        let priority: 'P0' | 'P1' | 'P2' | 'P3';
        switch (item.severity) {
          case 'critical':
            priority = 'P0';
            break;
          case 'high':
            priority = 'P1';
            break;
          case 'medium':
            priority = 'P2';
            break;
          default:
            priority = 'P3';
            break;
        }
        
        // Add priority label to issue
        await this.githubService.addLabelToIssue(
          issueNumber,
          repoOwner,
          repoName,
          `priority-${priority}`
        );
        
        prioritizedIssues.push({
          issueNumber,
          priority,
          feedbackItem: item
        });
        
        this.logger.info(`Set priority ${priority} for issue #${issueNumber}`, { 
          issueNumber, 
          priority, 
          severity: item.severity 
        });
      }
      
      const summary = `Prioritized ${prioritizedIssues.length} feedback issues`;
      this.logger.info(summary, { issueCount: prioritizedIssues.length });
      
      return {
        prioritizedIssues,
        summary
      };
    } catch (error: any) {
      this.logger.error(
        `Error prioritizing feedback issues`, 
        error,
        { issueCount: issueNumbers.length, repoOwner, repoName }
      );
      throw new Error(`Failed to prioritize feedback issues: ${error.message}`);
    }
  }

  /**
   * Checks if a comment is non-actionable (e.g., approvals, LGTMs)
   * @param commentBody The comment text
   * @returns Whether the comment is non-actionable
   */
  private isNonActionableComment(commentBody: string): boolean {
    const nonActionablePatterns = [
      /^LGTM\.?$/i,
      /^(Looks good( to me)?!)\.?$/i,
      /^(Approved|👍|\\+1)\.?$/i,
      /^Just a few (nits|nitpicks|small comments)\.?$/i
    ];
    
    return nonActionablePatterns.some(pattern => pattern.test(commentBody.trim()));
  }

  /**
   * Extracts actionable feedback from a comment
   * @param commentBody The comment text
   * @param author The comment author
   * @param commentId The comment ID
   * @returns Feedback item if actionable, null otherwise
   */
  private extractFeedbackFromComment(
    commentBody: string,
    author: string,
    commentId: number
  ): FeedbackItem | null {
    // Skip very short comments as they're unlikely to be actionable
    if (commentBody.length < 10) {
      return null;
    }
    
    // Check for severity indicators in the comment
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (/\b(critical|urgent|severe|security issue|vulnerability)\b/i.test(commentBody)) {
      severity = 'critical';
    } else if (/\b(high|important|bug|error|broken|crash)\b/i.test(commentBody)) {
      severity = 'high';
    } else if (/\b(minor|typo|small|cosmetic|nitpick)\b/i.test(commentBody)) {
      severity = 'low';
    }
    
    // Determine affected area based on content
    let affectedArea = 'unknown';
    if (/\b(performance|speed|slow|optimization|memory)\b/i.test(commentBody)) {
      affectedArea = 'performance';
    } else if (/\b(security|auth|authentication|authorization|vulnerability)\b/i.test(commentBody)) {
      affectedArea = 'security';
    } else if (/\b(ui|ux|design|look|feel|usability)\b/i.test(commentBody)) {
      affectedArea = 'ui';
    } else if (/\b(docs|documentation|comment|readme)\b/i.test(commentBody)) {
      affectedArea = 'docs';
    } else if (/\b(test|testing|coverage|spec|assertion)\b/i.test(commentBody)) {
      affectedArea = 'testing';
    } else if (/\b(api|endpoint|route|interface)\b/i.test(commentBody)) {
      affectedArea = 'api';
    }
    
    // Create feedback item
    return {
      id: uuidv4(),
      description: this.summarizeFeedback(commentBody),
      severity,
      author,
      affectedArea,
      sourceComment: commentId
    };
  }

  /**
   * Creates an issue title from a feedback item
   * @param item The feedback item
   * @returns Issue title
   */
  private createIssueTitleFromFeedback(item: FeedbackItem): string {
    // Start with severity prefix
    let prefix = '';
    switch (item.severity) {
      case 'critical':
        prefix = '[CRITICAL]';
        break;
      case 'high':
        prefix = '[HIGH]';
        break;
      case 'medium':
        prefix = '[MEDIUM]';
        break;
      case 'low':
        prefix = '[LOW]';
        break;
    }
    
    // Take the first 60 chars of description for the title
    let title = item.description;
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return `${prefix} ${title}`;
  }

  /**
   * Creates an issue body from a feedback item
   * @param item The feedback item
   * @param prNumber The PR number
   * @returns Issue body
   */
  private createIssueBodyFromFeedback(item: FeedbackItem, prNumber: number): string {
    return `## Feedback From PR Review

**Source:** PR #${prNumber}, comment by @${item.author}

**Severity:** ${item.severity}

**Affected Area:** ${item.affectedArea}

**Description:**
${item.description}

---

This issue was automatically created from feedback in a pull request review.
Comment ID: ${item.sourceComment}
Feedback ID: ${item.id}`;
  }

  /**
   * Summarizes feedback from a comment
   * @param commentBody The comment text
   * @returns Summarized feedback
   */
  private summarizeFeedback(commentBody: string): string {
    // Remove quoted text (often from the PR)
    let cleanedComment = commentBody.replace(/^>\s.*$/gm, '').trim();
    
    // Split into sentences and take the most relevant ones (up to 3)
    const sentences = cleanedComment.match(/[^.!?]+[.!?]+/g) || [cleanedComment];
    
    if (sentences.length <= 3) {
      return cleanedComment;
    }
    
    // Score sentences by relevant keywords
    const scoredSentences = sentences.map(sentence => {
      let score = 0;
      
      // Keywords that indicate actionable feedback
      const keywords = [
        'should', 'need', 'must', 'fix', 'issue', 'bug', 'error',
        'improve', 'optimize', 'performance', 'security', 'change',
        'update', 'add', 'remove', 'refactor', 'missing', 'incorrect'
      ];
      
      keywords.forEach(keyword => {
        if (sentence.toLowerCase().includes(keyword)) {
          score += 1;
        }
      });
      
      return { sentence, score };
    });
    
    // Sort by score and take top 3
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.sentence)
      .join(' ');
    
    return topSentences;
  }

  /**
   * Sorts feedback by severity
   * @param pairs Pairs of feedback items and issue numbers
   * @returns Sorted pairs
   */
  private sortFeedbackBySeverity(
    pairs: Array<{ item: FeedbackItem; issueNumber: number }>
  ): Array<{ item: FeedbackItem; issueNumber: number }> {
    const severityOrder = {
      'critical': 0,
      'high': 1,
      'medium': 2,
      'low': 3
    };
    
    return [...pairs].sort((a, b) => {
      return severityOrder[a.item.severity] - severityOrder[b.item.severity];
    });
  }
}