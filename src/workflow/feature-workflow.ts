import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { Logger } from '../utils/logger';

/**
 * Interface for implementation status tracking
 */
export interface ImplementationStatus {
  started: boolean;
  completed: boolean;
  progress: number; // 0-100
  tasks: Array<{
    description: string;
    completed: boolean;
  }>;
}

/**
 * Interface for package information
 */
export interface PackageInfo {
  name: string;
  path: string;
  team: string;
  dependencies?: string[];
}

/**
 * Handles feature implementation workflow
 */
export class FeatureWorkflow {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
  }

  /**
   * Map a feature to the appropriate package
   */
  public async mapPackageForFeature(issueNumber: number): Promise<PackageInfo> {
    this.logger.info(`Mapping package for issue: #${issueNumber}`);
    
    // Get the issue details
    const { data: issue } = await this.client.getIssue(issueNumber);
    
    // Extract keywords from the issue title and body
    const title = issue.title.toLowerCase();
    const body = (issue.body || '').toLowerCase();
    const allText = `${title} ${body}`;
    
    // Find the most relevant package based on keywords
    let relevantPackage = null;
    let highestMatchScore = 0;
    
    for (const pkg of this.config.packages) {
      let matchScore = 0;
      
      // Check for package name in title or body
      if (title.includes(pkg.name.toLowerCase())) matchScore += 5;
      if (body.includes(pkg.name.toLowerCase())) matchScore += 3;
      
      // Check for mentions of package-related terms
      const packageTerms = [pkg.name.toLowerCase()];
      if (pkg.path) {
        const pathParts = pkg.path.split('/');
        packageTerms.push(...pathParts.map(part => part.toLowerCase()));
      }
      
      for (const term of packageTerms) {
        if (term.length > 2 && allText.includes(term)) {
          matchScore += 1;
        }
      }
      
      // Update if this is the best match so far
      if (matchScore > highestMatchScore) {
        highestMatchScore = matchScore;
        relevantPackage = pkg;
      }
    }
    
    // If no specific package found, use the first one or a default
    if (!relevantPackage && this.config.packages.length > 0) {
      relevantPackage = this.config.packages[0];
    } else if (!relevantPackage) {
      relevantPackage = {
        name: 'core',
        path: 'src/core',
        team: 'core-team'
      };
    }
    
    return relevantPackage;
  }

  /**
   * Process a feature implementation request
   */
  public async processImplementationRequest(issueNumber: number): Promise<void> {
    this.logger.info(`Processing implementation request for issue: #${issueNumber}`);
    
    // Get the issue details
    const { data: issue } = await this.client.getIssue(issueNumber);
    
    // Map the feature to a package
    const packageInfo = await this.mapPackageForFeature(issueNumber);
    
    // Get the comments to find the test file and requirements
    const { data: comments } = await this.client.octokit.rest.issues.listComments({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber
    });

    // Find the test file
    const testFileComment = comments.find((comment: { body?: string }) => 
      comment.body && comment.body.includes('## Test File Generated')
    );

    // Find the Gherkin specification
    const gherkinComment = comments.find((comment: { body?: string }) => 
      comment.body && comment.body.includes('## Gherkin Specification')
    );

    // Create an implementation plan
    await this.client.createIssueComment(
      issueNumber,
      `## Implementation Plan
      
### Package Information
- **Package**: ${packageInfo.name}
- **Path**: ${packageInfo.path}
- **Team**: ${packageInfo.team}

### Dependencies
${this.formatDependencies(packageInfo)}

### Implementation Tasks
${this.createImplementationTasks(issue.title, gherkinComment?.body)}

Please follow the implementation tasks and update progress regularly.
`
    );
    
    // Initialize implementation status
    const initialStatus = this.createInitialStatus(issue.title, gherkinComment?.body);
    await this.trackImplementationStatus(issueNumber, initialStatus);
  }

  /**
   * Track dependencies between packages
   */
  public trackDependencies(packageInfo: PackageInfo): string[] {
    const dependencies = packageInfo.dependencies || [];
    
    // Return the list of dependencies
    return dependencies;
  }

  /**
   * Track implementation status for a feature
   */
  public async trackImplementationStatus(issueNumber: number, status: ImplementationStatus): Promise<void> {
    // Calculate progress percentage
    const completedTasks = status.tasks.filter(task => task.completed).length;
    const totalTasks = status.tasks.length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Update the status
    status.progress = progressPercentage;
    status.completed = progressPercentage === 100;
    
    // Format tasks as a checklist
    const tasksChecklist = status.tasks.map(task => 
      `- [${task.completed ? 'x' : ' '}] ${task.description}`
    ).join('\n');
    
    // Create a status comment
    await this.client.createIssueComment(
      issueNumber,
      `## Implementation Status

Progress: ${status.progress}% complete

### Tasks
${tasksChecklist}

${status.completed ? '✅ Implementation complete. Ready for audit.' : '🔄 Implementation in progress.'}
`
    );
    
    // Add appropriate labels based on status
    if (status.completed) {
      await this.client.addLabelsToIssue(issueNumber, ['stone-audit']);
      await this.client.removeLabelFromIssue(issueNumber, 'stone-feature-implement');
    }
  }

  /**
   * Format dependencies for display
   */
  private formatDependencies(packageInfo: PackageInfo): string {
    const dependencies = this.trackDependencies(packageInfo);
    
    if (dependencies.length === 0) {
      return 'No dependencies';
    }
    
    return dependencies.map(dep => `- ${dep}`).join('\n');
  }

  /**
   * Create implementation tasks based on feature title and Gherkin spec
   */
  private createImplementationTasks(title: string, gherkinSpec?: string): string {
    const tasks: string[] = [];
    
    // Add default tasks
    tasks.push('1. Review requirements and test file');
    tasks.push('2. Setup necessary files and structures');
    
    // Extract scenarios from Gherkin if available
    if (gherkinSpec) {
      const scenarioMatches = gherkinSpec.matchAll(/Scenario:\s+(.+?)(?=\n)/g);
      let taskIndex = 3;
      
      for (const match of scenarioMatches) {
        tasks.push(`${taskIndex}. Implement scenario: ${match[1].trim()}`);
        taskIndex++;
      }
    } else {
      // Generic implementation tasks if no Gherkin provided
      tasks.push('3. Implement core functionality');
      tasks.push('4. Add error handling');
      tasks.push('5. Integrate with existing system');
    }
    
    // Add final tasks
    tasks.push(`${tasks.length + 1}. Ensure tests pass`);
    tasks.push(`${tasks.length + 2}. Document the implementation`);
    
    return tasks.join('\n');
  }

  /**
   * Create initial implementation status
   */
  private createInitialStatus(title: string, gherkinSpec?: string): ImplementationStatus {
    const tasks: Array<{ description: string; completed: boolean }> = [];
    
    // Add default tasks
    tasks.push({ description: 'Review requirements and test file', completed: false });
    tasks.push({ description: 'Setup necessary files and structures', completed: false });
    
    // Extract scenarios from Gherkin if available
    if (gherkinSpec) {
      const scenarioMatches = gherkinSpec.matchAll(/Scenario:\s+(.+?)(?=\n)/g);
      
      for (const match of scenarioMatches) {
        tasks.push({ description: `Implement scenario: ${match[1].trim()}`, completed: false });
      }
    } else {
      // Generic implementation tasks if no Gherkin provided
      tasks.push({ description: 'Implement core functionality', completed: false });
      tasks.push({ description: 'Add error handling', completed: false });
      tasks.push({ description: 'Integrate with existing system', completed: false });
    }
    
    // Add final tasks
    tasks.push({ description: 'Ensure tests pass', completed: false });
    tasks.push({ description: 'Document the implementation', completed: false });
    
    return {
      started: true,
      completed: false,
      progress: 0,
      tasks
    };
  }
}