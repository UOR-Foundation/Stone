import { Role } from '../../../../src/claude/roles/role';
import { ClaudeClient } from '../../../../src/claude/api/client';
import { ContextProvider } from '../../../../src/claude/context/provider';
import { ResponseParser } from '../../../../src/claude/parsers/response-parser';
import { ConfigLoader } from '../../../../src/config';
import { GitHubClient } from '../../../../src/github';

jest.mock('../../../../src/claude/api/client');
jest.mock('../../../../src/claude/context/provider');
jest.mock('../../../../src/claude/parsers/response-parser');
jest.mock('../../../../src/config');
jest.mock('../../../../src/github');

class TestRole extends Role {
  public name = 'test';
  
  constructor(token: string) {
    super(token);
  }
  
  // Already public in base class
  
  // Exposing protected methods for testing
  public async testGeneratePrompt(context: any): Promise<string> {
    return this.generatePrompt(context);
  }
  
  public async testGenerateSystemPrompt(context: any): Promise<string> {
    return this.generateSystemPrompt(context);
  }
}

describe('Role', () => {
  const MockClaudeClient = ClaudeClient as jest.MockedClass<typeof ClaudeClient>;
  const MockContextProvider = ContextProvider as jest.MockedClass<typeof ContextProvider>;
  const MockResponseParser = ResponseParser as jest.MockedClass<typeof ResponseParser>;
  const MockConfigLoader = ConfigLoader as jest.MockedClass<typeof ConfigLoader>;
  const MockGitHubClient = GitHubClient as jest.MockedClass<typeof GitHubClient>;
  
  let role: TestRole;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockContextProvider: jest.Mocked<ContextProvider>;
  let mockResponseParser: jest.Mocked<ResponseParser>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  let mockConfig: any;
  
  beforeEach(() => {
    mockClaudeClient = {
      generateResponse: jest.fn().mockResolvedValue('Claude response'),
    } as unknown as jest.Mocked<ClaudeClient>;
    
    mockContextProvider = {
      buildContext: jest.fn().mockResolvedValue({
        issue: { number: 123, title: 'Test Issue', body: 'Issue body', labels: ['test-label'] },
        repository: { owner: 'test-owner', name: 'test-repo' },
        role: { name: 'test', instructions: '# Test role instructions' },
      }),
    } as unknown as jest.Mocked<ContextProvider>;
    
    mockResponseParser = {
      parseActionItems: jest.fn().mockReturnValue(['Action 1', 'Action 2']),
      parseGherkinSpecification: jest.fn().mockReturnValue('Gherkin spec'),
      parseCodeBlocks: jest.fn().mockReturnValue([{ language: 'typescript', code: 'const x = 1;' }]),
    } as unknown as jest.Mocked<ResponseParser>;
    
    mockConfig = {
      roles: {
        test: { enabled: true },
      },
    };
    
    mockGitHubClient = {
      createIssueComment: jest.fn().mockResolvedValue({}),
      addLabelsToIssue: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<GitHubClient>;
    
    MockClaudeClient.mockImplementation(() => mockClaudeClient);
    MockContextProvider.mockImplementation(() => mockContextProvider);
    MockResponseParser.mockImplementation(() => mockResponseParser);
    MockConfigLoader.prototype.getConfig = jest.fn().mockResolvedValue(mockConfig);
    MockGitHubClient.mockImplementation(() => mockGitHubClient);
    
    role = new TestRole('mock-token');
  });
  
  describe('constructor', () => {
    test('initializes with dependencies', () => {
      expect(MockClaudeClient).toHaveBeenCalledWith('mock-token');
      expect(MockContextProvider).toHaveBeenCalledWith('mock-token');
      expect(MockResponseParser).toHaveBeenCalled();
    });
  });
  
  describe('processIssue', () => {
    test('generates prompt from context and parses response', async () => {
      await role.processIssue(123);
      
      expect(mockContextProvider.buildContext).toHaveBeenCalledWith('test', 123);
      expect(mockClaudeClient.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('Issue: #123 Test Issue'),
        expect.stringContaining('# Test role instructions')
      );
    });
    
    test('adds comment to issue with Claude response', async () => {
      await role.processIssue(123);
      
      expect(mockGitHubClient.createIssueComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Claude response')
      );
    });
  });
  
  describe('generatePrompt', () => {
    test('creates prompt with context information', async () => {
      const context = {
        issue: { number: 123, title: 'Test Issue', body: 'Issue body', labels: ['test-label'] },
        repository: { owner: 'test-owner', name: 'test-repo' },
        role: { name: 'test', instructions: '# Test role instructions' },
      };
      
      const prompt = await role.testGeneratePrompt(context);
      
      expect(prompt).toContain('Issue: #123 Test Issue');
      expect(prompt).toContain('Issue body');
      expect(prompt).toContain('test-owner/test-repo');
    });
  });
  
  describe('generateSystemPrompt', () => {
    test('creates system prompt with role instructions', async () => {
      const context = {
        role: { name: 'test', instructions: '# Test role instructions' },
      };
      
      const systemPrompt = await role.testGenerateSystemPrompt(context);
      
      expect(systemPrompt).toContain('# Test role instructions');
    });
  });
});