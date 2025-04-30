import { ClaudeClient } from '../../../../src/claude/api/client';

jest.mock('node-fetch');
const mockFetch = jest.requireMock('node-fetch');

describe('ClaudeClient', () => {
  let client: typeof ClaudeClient.prototype;
  
  beforeEach(() => {
    jest.resetAllMocks();
    client = new ClaudeClient('mock-api-key');
  });

  describe('constructor', () => {
    test('initializes client with API key', () => {
      expect(client).toBeInstanceOf(ClaudeClient);
    });

    test('throws error when API key is not provided', () => {
      expect(() => new ClaudeClient('')).toThrow('Claude API key is required');
    });
  });

  describe('generateResponse', () => {
    test('successfully generates response from Claude API', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'This is a mock response from Claude.' }]
      };
      
      const mockJsonPromise = Promise.resolve(mockResponse);
      const mockFetchPromise = Promise.resolve({
        status: 200,
        json: () => mockJsonPromise,
      });
      
      mockFetch.mockReturnValue(mockFetchPromise as any);

      const prompt = 'Test prompt';
      const system = 'You are a helpful assistant';
      const result = await client.generateResponse(prompt, system);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'anthropic-version': expect.any(String),
            'x-api-key': 'mock-api-key',
            'content-type': 'application/json',
          }),
          body: expect.stringContaining('"model":"claude-3-sonnet-20240229"'),
        })
      );

      expect(result).toEqual('This is a mock response from Claude.');
    });

    test('handles API error response', async () => {
      const mockFetchPromise = Promise.resolve({
        status: 400,
        json: () => Promise.resolve({ error: { message: 'Bad request' } }),
      });
      
      mockFetch.mockReturnValue(mockFetchPromise as any);

      await expect(client.generateResponse('Test prompt', 'System')).rejects.toThrow('Claude API error: Bad request');
    });

    test('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.generateResponse('Test prompt', 'System')).rejects.toThrow('Claude API request failed: Network error');
    });
  });

  describe('extractTextContent', () => {
    test('extracts text from Claude API response', () => {
      const response = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'First part. ' },
          { type: 'text', text: 'Second part.' }
        ]
      };

      const result = client.extractTextContent(response);
      expect(result).toBe('First part. Second part.');
    });

    test('returns empty string for empty content', () => {
      const response = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: []
      };

      const result = client.extractTextContent(response);
      expect(result).toBe('');
    });

    test('handles non-text content blocks', () => {
      const response = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Text content. ' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } }
        ]
      };

      const result = client.extractTextContent(response);
      expect(result).toBe('Text content. ');
    });
  });
});
