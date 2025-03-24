import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config/schema';
import { Logger } from '../utils/logger';
import { Bash, BashCommandResult } from '../utils/bash';

/**
 * Interface for test result
 */
export interface TestResult {
  type: string;
  success: boolean;
  output: string;
  duration: number;
}

/**
 * Interface for test pipeline results
 */
export interface TestPipelineResult {
  success: boolean;
  testResults: TestResult[];
}

/**
 * Interface for build result
 */
export interface BuildResult {
  success: boolean;
  output: string;
  duration: number;
}

/**
 * Interface for deployment result
 */
export interface DeploymentResult {
  success: boolean;
  environment: string;
  output: string;
  duration: number;
}

/**
 * Handles CI/CD pipeline operations
 */
export class CIPipeline {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;
  private bash: Bash;

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
    this.bash = new Bash();
  }

  /**
   * Run tests for an issue with the 'stone-ready-for-tests' label
   */
  public async runTestsForIssue(issueNumber: number): Promise<void> {
    // Get the issue details
    const { data: issue } = await this.client.getIssue(issueNumber);

    // Check if the issue has the 'stone-ready-for-tests' label
    const hasTestsLabel = issue.labels.some((label: any) => {
      return typeof label === 'string'
        ? label === 'stone-ready-for-tests'
        : label.name === 'stone-ready-for-tests';
    });

    if (!hasTestsLabel) {
      this.logger.info(
        `Issue #${issueNumber} does not have the 'stone-ready-for-tests' label`
      );
      return;
    }

    this.logger.info(`Running tests for issue #${issueNumber}`);

    // Determine the branch to test
    // In a real implementation, we would look for an associated PR or branch
    // For now, we'll use a placeholder branch name
    const branchName = `feature/issue-${issueNumber}`;

    try {
      // Run the test command
      const result = await this.bash.execute(this.config.workflow.testCommand);

      if (result.exitCode === 0) {
        // Tests passed
        await this.client.createIssueComment(
          issueNumber,
          `## Test Results\n\n✅ Tests passed successfully!\n\n\`\`\`\n${result.stdout}\n\`\`\``
        );

        // Update labels
        await this.client.addLabelsToIssue(issueNumber, ['stone-docs']);
        await this.client.removeLabelFromIssue(
          issueNumber,
          'stone-ready-for-tests'
        );

        this.logger.success(`Tests passed for issue #${issueNumber}`);
      } else {
        // Tests failed
        await this.client.createIssueComment(
          issueNumber,
          `## Test Failure\n\n❌ Tests failed!\n\n\`\`\`\n${
            result.stderr || result.stdout
          }\n\`\`\``
        );

        // Update labels
        await this.client.addLabelsToIssue(issueNumber, ['stone-test-failure']);

        this.logger.error(`Tests failed for issue #${issueNumber}`);
      }
    } catch (error) {
      // Error running tests
      await this.client.createIssueComment(
        issueNumber,
        `## Test Error\n\n❌ An error occurred while running tests:\n\n\`\`\`\n${error}\n\`\`\``
      );

      this.logger.error(`Error running tests for issue #${issueNumber}: ${error}`);
    }
  }

  /**
   * Run a complete test pipeline for a branch
   */
  public async runTestPipeline(
    branch: string,
    testPath?: string
  ): Promise<TestPipelineResult> {
    this.logger.info(`Running test pipeline for branch: ${branch}`);

    const testTypes = ['unit', 'integration', 'e2e'];
    const results: TestResult[] = [];
    let success = true;

    // Run each test type in sequence, stopping at first failure
    for (const testType of testTypes) {
      const startTime = Date.now();
      
      // Generate test command based on test type
      const testCommand = this.generateTestCommand(testType, testPath);
      
      // Run the test command
      const result = await this.bash.execute(testCommand);
      
      const duration = (Date.now() - startTime) / 1000; // duration in seconds
      
      const testResult: TestResult = {
        type: testType,
        success: result.exitCode === 0,
        output: result.exitCode === 0 ? result.stdout : result.stderr || result.stdout,
        duration
      };
      
      results.push(testResult);
      
      // If test failed, mark the pipeline as failed and stop
      if (!testResult.success) {
        success = false;
        break;
      }
    }

    return {
      success,
      testResults: results
    };
  }

  /**
   * Update a pull request's status based on test results
   */
  public async updatePRStatus(
    prNumber: number,
    sha: string,
    testResults: TestPipelineResult
  ): Promise<void> {
    // Set status based on test results
    const state = testResults.success ? 'success' : 'failure';
    const description = testResults.success
      ? 'All tests passed'
      : `Tests failed: ${testResults.testResults
          .filter(r => !r.success)
          .map(r => r.type)
          .join(', ')}`;

    // Update commit status
    await this.client.octokit.rest.repos.createCommitStatus({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      sha,
      state,
      description,
      context: 'stone/tests'
    });

    this.logger.info(`Updated PR #${prNumber} status: ${state}`);

    // If tests failed, comment on PR with details
    if (!testResults.success) {
      // Find the first failed test
      const failedTest = testResults.testResults.find(r => !r.success);
      
      if (failedTest) {
        // Create check run with more detailed output
        await this.client.octokit.rest.checks.create({
          owner: this.config.repository.owner,
          repo: this.config.repository.name,
          name: `stone/${failedTest.type}-tests`,
          head_sha: sha,
          status: 'completed',
          conclusion: 'failure',
          output: {
            title: `${failedTest.type} tests failed`,
            summary: `The ${failedTest.type} tests failed.`,
            text: failedTest.output
          }
        });
      }
    }
  }

  /**
   * Process build step for a branch
   */
  public async processBuildStep(branch: string): Promise<BuildResult> {
    this.logger.info(`Building branch: ${branch}`);
    
    const startTime = Date.now();
    
    // Run the build command
    const result = await this.bash.execute('npm run build');
    
    const duration = (Date.now() - startTime) / 1000; // duration in seconds
    
    return {
      success: result.exitCode === 0,
      output: result.exitCode === 0 ? result.stdout : result.stderr || result.stdout,
      duration
    };
  }

  /**
   * Process deployment to an environment
   */
  public async processDeployment(
    environment: string,
    branch: string
  ): Promise<DeploymentResult> {
    this.logger.info(`Deploying branch ${branch} to ${environment}`);
    
    const startTime = Date.now();
    
    // In a real implementation, this would contain actual deployment commands
    // For now, we'll simulate a deployment
    const deployCommand = `echo "Deploying ${branch} to ${environment}..."`;
    
    const result = await this.bash.execute(deployCommand);
    
    const duration = (Date.now() - startTime) / 1000; // duration in seconds
    
    return {
      success: result.exitCode === 0,
      environment,
      output: result.exitCode === 0 ? result.stdout : result.stderr || result.stdout,
      duration
    };
  }

  /**
   * Create a comprehensive status report for CI/CD process
   */
  public createStatusReport(
    branch: string,
    testResults: TestPipelineResult,
    buildResult: BuildResult,
    deploymentResult?: DeploymentResult
  ): string {
    const report: string[] = [];
    
    report.push(`## CI/CD Status Report for \`${branch}\``);
    report.push('');
    
    // Add test results
    report.push('### Unit Tests');
    for (const test of testResults.testResults) {
      const icon = test.success ? '✅' : '❌';
      report.push(`- ${icon} **${test.type}**: ${test.success ? 'Success' : 'Failed'} (${test.duration.toFixed(1)}s)`);
    }
    report.push('');
    
    // Add build result
    report.push('### Build');
    const buildIcon = buildResult.success ? '✅' : '❌';
    report.push(`- ${buildIcon} **Build**: ${buildResult.success ? 'Success' : 'Failed'} (${buildResult.duration.toFixed(1)}s)`);
    report.push('');
    
    // Add deployment result if present
    if (deploymentResult) {
      report.push('### Deployment');
      const deployIcon = deploymentResult.success ? '✅' : '❌';
      report.push(`- ${deployIcon} **${deploymentResult.environment}**: ${deploymentResult.success ? 'Success' : 'Failed'} (${deploymentResult.duration.toFixed(1)}s)`);
      report.push('');
    }
    
    // Add overall status
    const overallSuccess = testResults.success && buildResult.success && 
      (!deploymentResult || deploymentResult.success);
    
    report.push('### Overall Status');
    report.push(`${overallSuccess ? '✅ Success' : '❌ Failed'}`);
    
    return report.join('\n');
  }

  /**
   * Generate test command based on test type
   */
  private generateTestCommand(type: string, testPath?: string): string {
    let command: string;
    
    switch (type) {
      case 'unit':
        command = `${this.config.workflow.testCommand} -- --testPathPattern='unit'`;
        break;
      case 'integration':
        command = `${this.config.workflow.testCommand} -- --testPathPattern='integration'`;
        break;
      case 'e2e':
        command = `${this.config.workflow.testCommand} -- --testPathPattern='e2e'`;
        break;
      default:
        command = this.config.workflow.testCommand;
    }
    
    // Add specific test path if provided
    if (testPath) {
      command += ` ${testPath}`;
    }
    
    return command;
  }
}