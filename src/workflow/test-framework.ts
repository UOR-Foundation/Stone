import { GitHubClient } from '../github/client';
import { StoneConfig } from '../config';
import { Logger } from '../utils/logger';
import * as path from 'path';

/**
 * Interface for test failure analysis results
 */
export interface TestFailureAnalysis {
  success: boolean;
  message: string;
  failedTests: Array<{
    file: string;
    testName: string;
    error: string;
  }>;
}

/**
 * Handles test file generation and test framework integration
 */
export class TestFramework {
  private client: GitHubClient;
  private config: StoneConfig;
  private logger: Logger;

  constructor(client: GitHubClient, config: StoneConfig) {
    this.client = client;
    this.config = config;
    this.logger = new Logger();
  }

  /**
   * Generate a test file based on Gherkin specifications
   */
  public async generateTestFile(issueNumber: number): Promise<void> {
    this.logger.info(`Generating test file for issue: #${issueNumber}`);
    
    // Get the issue details
    const { data: issue } = await this.client.getIssue(issueNumber);
    
    // Get the comments to find the Gherkin specification
    const { data: comments } = await this.client.octokit.rest.issues.listComments({
      owner: this.config.repository.owner,
      repo: this.config.repository.name,
      issue_number: issueNumber
    });

    // Find the Gherkin specification
    const gherkinComment = comments.find((comment: { body?: string }) => 
      comment.body && comment.body.includes('## Gherkin Specification')
    );

    if (!gherkinComment) {
      await this.client.createIssueComment(
        issueNumber,
        `## Error: Gherkin Specification Missing\n\nCannot generate test file without Gherkin specifications.`
      );
      return;
    }

    // Extract the Gherkin spec
    const gherkinMatch = gherkinComment.body.match(/## Gherkin Specification\s*\n\s*Feature:[\s\S]+?(?=\n\n|$)/i);
    if (!gherkinMatch) {
      await this.client.createIssueComment(
        issueNumber,
        `## Error: Invalid Gherkin Format\n\nThe Gherkin specification format is invalid.`
      );
      return;
    }

    const gherkinSpec = gherkinMatch[0].replace('## Gherkin Specification', '').trim();
    
    // Determine the appropriate test file location
    const testLocation = await this.determineTestLocation(issueNumber);
    
    // Generate the test file content
    const testFileContent = this.createTestFileFromGherkin(gherkinSpec, testLocation);
    
    // Add a comment with the generated test file
    await this.client.createIssueComment(
      issueNumber,
      `## Test File Generated\n\nProposed location: \`${testLocation}\`\n\n\`\`\`typescript\n${testFileContent}\n\`\`\`\n\nThis test file will be used to verify the implementation.`
    );
    
    // Move to the implementation stage
    await this.client.addLabelsToIssue(issueNumber, ['stone-feature-implement']);
    await this.client.removeLabelFromIssue(issueNumber, 'stone-qa');
    
    this.logger.success(`Test file generated for issue: #${issueNumber}`);
  }

  /**
   * Determine the appropriate test location based on the feature
   */
  public async determineTestLocation(issueNumber: number): Promise<string> {
    const { data: issue } = await this.client.getIssue(issueNumber);
    
    // Extract keywords from the issue title to help determine the location
    const title = issue.title.toLowerCase();
    const words = title.split(/\s+/).filter((word: string) => word.length > 3);
    
    // Find the most relevant package based on keywords
    let relevantPackage = null;
    
    for (const pkg of this.config.packages) {
      if (words.some((word: string) => pkg.name.toLowerCase().includes(word) || 
                    (pkg.path && pkg.path.toLowerCase().includes(word)))) {
        relevantPackage = pkg;
        break;
      }
    }
    
    // If no package found, use a generic location
    if (!relevantPackage) {
      return `test/unit/${this.sanitizeForFileName(title)}.test.ts`;
    }
    
    // Determine appropriate test directory
    const pkgName = relevantPackage.name;
    const pkgPath = relevantPackage.path;
    
    // Check for existing test directories with similar purpose
    if (pkgPath) {
      const sourceDir = pkgPath.replace(/^src\//, '');
      const subDir = sourceDir.includes('/') ? sourceDir.split('/')[0] : sourceDir;
      return `test/unit/${subDir}/${this.sanitizeForFileName(title)}.test.ts`;
    }
    
    return `test/unit/${pkgName}/${this.sanitizeForFileName(title)}.test.ts`;
  }

  /**
   * Generate test run commands for the feature tests
   */
  public generateTestCommands(testFilePath: string): string {
    // Basic Jest command to run the specific test file
    return `npm test -- ${testFilePath}`;
  }

  /**
   * Analyze test output to identify failures
   */
  public analyzeTestFailure(testOutput: string): TestFailureAnalysis {
    const failureAnalysis: TestFailureAnalysis = {
      success: !testOutput.includes('FAIL'),
      message: '',
      failedTests: []
    };
    
    // Extract failed test cases
    const failedTestMatches = testOutput.matchAll(/FAIL\s+([^\s]+)\s+●\s+([^●]+?)(?=●|$)/gs);
    
    for (const match of failedTestMatches) {
      const file = match[1].trim();
      const testDetails = match[2];
      
      // Extract test name and error message
      const testNameMatch = testDetails.match(/([^]+?)(?=\s+expect|\s+Error:)/);
      const errorMatch = testDetails.match(/expect[^]+?$|Error:[^]+?$/);
      
      if (testNameMatch && errorMatch) {
        failureAnalysis.failedTests.push({
          file,
          testName: testNameMatch[1].trim(),
          error: errorMatch[0].trim()
        });
      }
    }
    
    // Generate a summary message
    if (failureAnalysis.failedTests.length > 0) {
      const failedTestCount = failureAnalysis.failedTests.length;
      failureAnalysis.message = `${failedTestCount} test${failedTestCount > 1 ? 's' : ''} failed. `;
      
      // Add more specific information for common failures
      // For test with "Authentication" in the testName or error message
      if (failureAnalysis.failedTests.some(test => 
          test.testName.includes('Authentication') || 
          (test.error && test.error.includes('Authentication'))
      )) {
        failureAnalysis.message += 'Authentication test failed. Verify credentials handling. ';
      }
      if (failureAnalysis.failedTests.some(test => test.error.includes('undefined'))) {
        failureAnalysis.message += 'Undefined values detected. Check null/undefined handling. ';
      }
    } else {
      failureAnalysis.message = 'All tests passed successfully.';
    }
    
    return failureAnalysis;
  }

  /**
   * Create a test file from a Gherkin specification
   */
  private createTestFileFromGherkin(gherkinSpec: string, testFilePath: string): string {
    // Parse the Gherkin specification
    const featureMatch = gherkinSpec.match(/Feature:\s+(.+?)(?=\n|$)/);
    if (!featureMatch) return '';
    
    const featureTitle = featureMatch[1].trim();
    
    // Extract scenarios
    const scenarios = [];
    const scenarioMatches = gherkinSpec.matchAll(/Scenario:\s+(.+?)(?=\n)\s+Given\s+(.+?)(?=\n)\s+When\s+(.+?)(?=\n)\s+Then\s+(.+?)(?=\n|$)/g);
    
    for (const scenarioMatch of scenarioMatches) {
      scenarios.push({
        title: scenarioMatch[1].trim(),
        given: scenarioMatch[2].trim(),
        when: scenarioMatch[3].trim(),
        then: scenarioMatch[4].trim()
      });
    }
    
    // Generate import statements
    const importStatements = [
      'import { describe, it, expect } from \'jest\';',
      // Add more imports based on the feature context
    ];
    
    // Determine additional imports based on feature title
    if (featureTitle.toLowerCase().includes('auth')) {
      importStatements.push('import { AuthService } from \'../../src/auth/auth-service\';');
    }
    
    // Generate test code
    const testCode = [
      ...importStatements,
      '',
      `describe('${featureTitle}', () => {`
    ];
    
    // Add test cases for each scenario
    for (const scenario of scenarios) {
      testCode.push(`  describe('${scenario.title}', () => {`);
      testCode.push(`    it('should ${scenario.then.toLowerCase()}', () => {`);
      testCode.push(`      // Arrange: ${scenario.given}`);
      testCode.push(`      // TODO: Setup test preconditions`);
      testCode.push('');
      testCode.push(`      // Act: ${scenario.when}`);
      testCode.push(`      // TODO: Execute the action being tested`);
      testCode.push('');
      testCode.push(`      // Assert: ${scenario.then}`);
      testCode.push(`      // TODO: Add assertions to verify expected behavior`);
      testCode.push(`      expect(true).toBe(true); // Replace with actual assertions`);
      testCode.push('    });');
      testCode.push('  });');
      testCode.push('');
    }
    
    testCode.push('});');
    
    return testCode.join('\n');
  }

  /**
   * Sanitize a string to be used as a file name
   */
  private sanitizeForFileName(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}