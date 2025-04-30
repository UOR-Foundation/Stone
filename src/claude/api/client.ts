import { Logger } from '../../utils/logger';

const fetch = require('node-fetch');

/**
 * Claude content block interface
 */
interface ClaudeContentBlock {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

/**
 * Claude API response interface
 */
interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeContentBlock[];
}

/**
 * Claude API error response interface
 */
interface ClaudeErrorResponse {
  error: {
    message: string;
  };
}

/**
 * Claude API client for generating responses
 */
export class ClaudeClient {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private logger: Logger;

  /**
   * Create a new Claude API client
   * @param apiKey Claude API key
   * @param endpoint API endpoint (optional)
   * @param model Claude model to use (optional)
   */
  constructor(apiKey: string, endpoint?: string, model?: string) {
    if (!apiKey) {
      throw new Error('Claude API key is required');
    }
    this.apiKey = apiKey;
    this.endpoint = endpoint || 'https://api.anthropic.com/v1/messages';
    this.model = model || 'claude-3-sonnet-20240229';
    this.logger = new Logger();
  }

  /**
   * Generate a response from Claude API
   * @param prompt Main prompt for Claude
   * @param systemPrompt System prompt for Claude
   * @returns Generated response
   */
  public async generateResponse(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      this.logger.info('Generating Claude response');
      
      if (process.env.MOCK_CLAUDE === 'true' && process.env.NODE_ENV !== 'test') {
        this.logger.info('Using mock Claude response');
        return `This is a mock response from Claude.\n\nPrompt received: ${prompt.substring(0, 100)}...\n\nSystem prompt received: ${systemPrompt?.substring(0, 100) || 'None'}...`;
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4000,
          messages: [
            { role: 'user', content: prompt }
          ],
          system: systemPrompt || undefined,
        }),
      });

      if (response.status !== 200) {
        const errorData = await response.json() as ClaudeErrorResponse;
        this.logger.error(`Claude API error: ${errorData.error.message}`);
        throw new Error(`Claude API error: ${errorData.error.message}`);
      }

      const data = await response.json() as ClaudeResponse;
      this.logger.info('Successfully received Claude response');
      return this.extractTextContent(data);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('Claude API error:')) {
          throw error;
        }
        this.logger.error(`Claude API request failed: ${error.message}`);
        throw new Error(`Claude API request failed: ${error.message}`);
      }
      this.logger.error(`Claude API request failed with unknown error`);
      throw error;
    }
  }

  /**
   * Extract text content from Claude API response
   * @param response Claude API response
   * @returns Extracted text content
   */
  public extractTextContent(response: ClaudeResponse): string {
    return response.content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text)
      .join('');
  }
}
