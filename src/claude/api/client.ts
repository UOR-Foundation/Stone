const fetch = require('node-fetch');

interface ClaudeContentBlock {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeContentBlock[];
}

interface ClaudeErrorResponse {
  error: {
    message: string;
  };
}

export class ClaudeClient {
  private apiKey: string;
  private apiUrl: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error('Claude API key is required');
    }
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.model = model || 'claude-3-sonnet-20240229';
  }

  /**
   * Generate a response from Claude API
   */
  public async generateResponse(prompt: string, system?: string): Promise<string> {
    try {
      const response = await fetch(this.apiUrl, {
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
          system: system || undefined,
        }),
      });

      if (response.status !== 200) {
        const errorData = await response.json() as ClaudeErrorResponse;
        throw new Error(`Claude API error: ${errorData.error.message}`);
      }

      const data = await response.json() as ClaudeResponse;
      return this.extractTextContent(data);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('Claude API error:')) {
          throw error;
        }
        throw new Error(`Claude API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract text content from Claude API response
   */
  public extractTextContent(response: ClaudeResponse): string {
    return response.content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text)
      .join('');
  }
}