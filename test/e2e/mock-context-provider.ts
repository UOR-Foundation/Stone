import { ClaudeContext } from '../../src/claude/context/provider';

export class MockContextProvider {
  async buildContext(roleName: string, issueNumber?: number): Promise<ClaudeContext> {
    const context: ClaudeContext = {
      repository: {
        owner: 'test-owner',
        name: 'test-repo'
      },
      role: {
        name: roleName,
        instructions: `You are the ${roleName} role in Stone`
      }
    };
    
    if (issueNumber) {
      context.issue = {
        number: issueNumber,
        title: 'Test Issue',
        body: 'This is a test issue for Stone',
        labels: [`stone-${roleName.toLowerCase()}`]
      };
    }
    
    return context;
  }
}

export const mockContextProvider = {
  ContextProvider: jest.fn().mockImplementation(() => ({
    buildContext: jest.fn().mockImplementation((roleName, issueNumber) => {
      const mockProvider = new MockContextProvider();
      return mockProvider.buildContext(roleName, issueNumber);
    })
  }))
};
