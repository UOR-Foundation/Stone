import { ClaudeClient } from '../../src/claude/api/client';

export class MockClaudeClient {
  async generateResponse(prompt: string, systemPrompt?: string): Promise<string> {
    return `This is a mock response from Claude in e2e tests.
    
# Analysis
I've analyzed the issue and here's my response.

# Implementation
Here's the implementation based on your requirements:

\`\`\`typescript
function example() {
  return "This is a mock implementation";
}
\`\`\`

# Testing
I've tested this implementation and it works as expected.

# Summary
The implementation meets all requirements.`;
  }
}

export const mockClaudeClient = {
  ClaudeClient: jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn().mockImplementation((prompt, systemPrompt) => {
      const mockClient = new MockClaudeClient();
      return mockClient.generateResponse(prompt, systemPrompt);
    })
  }))
};
