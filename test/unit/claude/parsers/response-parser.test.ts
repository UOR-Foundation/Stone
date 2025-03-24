import { ResponseParser } from '../../../../src/claude/parsers/response-parser';

describe('ResponseParser', () => {
  let parser: ResponseParser;
  
  beforeEach(() => {
    parser = new ResponseParser();
  });
  
  describe('parseGherkinSpecification', () => {
    test('extracts Gherkin specification from Claude response', () => {
      const response = `
I'll create a Gherkin specification based on the issue.

\`\`\`gherkin
Feature: User Authentication
  As a user
  I want to log in to the system
  So that I can access my account

  Scenario: Successful login
    Given I am on the login page
    When I enter valid credentials
    Then I should be redirected to the dashboard
\`\`\`

Please let me know if you need any clarification.
      `;
      
      const result = parser.parseGherkinSpecification(response);
      
      expect(result).toBe(
        'Feature: User Authentication\n' +
        '  As a user\n' +
        '  I want to log in to the system\n' +
        '  So that I can access my account\n' +
        '\n' +
        '  Scenario: Successful login\n' +
        '    Given I am on the login page\n' +
        '    When I enter valid credentials\n' +
        '    Then I should be redirected to the dashboard'
      );
    });
    
    test('returns empty string when no Gherkin code block is found', () => {
      const response = 'This response has no Gherkin specification.';
      
      const result = parser.parseGherkinSpecification(response);
      
      expect(result).toBe('');
    });
    
    test('handles multiple code blocks and extracts only Gherkin', () => {
      const response = `
Here's a JavaScript example:

\`\`\`javascript
function login() {
  // Code here
}
\`\`\`

And here's the Gherkin specification:

\`\`\`gherkin
Feature: Login
  Scenario: Valid login
    Given I have an account
    When I log in
    Then I should be authenticated
\`\`\`
      `;
      
      const result = parser.parseGherkinSpecification(response);
      
      expect(result).toBe(
        'Feature: Login\n' +
        '  Scenario: Valid login\n' +
        '    Given I have an account\n' +
        '    When I log in\n' +
        '    Then I should be authenticated'
      );
    });
  });
  
  describe('parseCodeBlocks', () => {
    test('extracts all code blocks with their languages', () => {
      const response = `
Here's some JavaScript:

\`\`\`javascript
function test() {
  return true;
}
\`\`\`

And some TypeScript:

\`\`\`typescript
function test(): boolean {
  return true;
}
\`\`\`
      `;
      
      const result = parser.parseCodeBlocks(response);
      
      expect(result).toEqual([
        {
          language: 'javascript',
          code: 'function test() {\n  return true;\n}',
        },
        {
          language: 'typescript',
          code: 'function test(): boolean {\n  return true;\n}',
        },
      ]);
    });
    
    test('returns empty array when no code blocks are found', () => {
      const response = 'This response has no code blocks.';
      
      const result = parser.parseCodeBlocks(response);
      
      expect(result).toEqual([]);
    });
    
    test('handles code blocks without language specification', () => {
      const response = `
Here's some code:

\`\`\`
function test() {
  return true;
}
\`\`\`
      `;
      
      const result = parser.parseCodeBlocks(response);
      
      expect(result).toEqual([
        {
          language: '',
          code: 'function test() {\n  return true;\n}',
        },
      ]);
    });
  });
  
  describe('parseActionItems', () => {
    test('extracts action items from Claude response', () => {
      const response = `
Here are the next steps:

Actions:
1. Create a new file for the login component
2. Implement authentication service
3. Add unit tests

Let me know if you have any questions.
      `;
      
      const result = parser.parseActionItems(response);
      
      expect(result).toEqual([
        'Create a new file for the login component',
        'Implement authentication service',
        'Add unit tests',
      ]);
    });
    
    test('returns empty array when no action items section is found', () => {
      const response = 'This response has no action items.';
      
      const result = parser.parseActionItems(response);
      
      expect(result).toEqual([]);
    });
    
    test('handles different action item formats', () => {
      const response = `
Here are the action items:

Actions:
- First item
* Second item
• Third item
  
Plus another one:
- Fourth item
      `;
      
      const result = parser.parseActionItems(response);
      
      expect(result).toEqual([
        'First item',
        'Second item',
        'Third item',
      ]);
    });
  });
});