export interface CodeBlock {
  language: string;
  code: string;
}

export class ResponseParser {
  /**
   * Parse Gherkin specification from Claude response
   */
  public parseGherkinSpecification(response: string): string {
    const gherkinCodeBlocks = this.parseCodeBlocks(response)
      .filter(block => block.language.toLowerCase() === 'gherkin');
    
    if (gherkinCodeBlocks.length === 0) {
      return '';
    }
    
    return gherkinCodeBlocks[0].code;
  }
  
  /**
   * Parse all code blocks from Claude response
   */
  public parseCodeBlocks(response: string): CodeBlock[] {
    const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
    const codeBlocks: CodeBlock[] = [];
    
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      codeBlocks.push({
        language: match[1],
        code: match[2].trim(),
      });
    }
    
    return codeBlocks;
  }
  
  /**
   * Parse action items from Claude response
   */
  public parseActionItems(response: string): string[] {
    // Find action items section
    const actionSectionRegex = /Actions?:[\s\S]*?((?:(?:[-•*]\s*|\d+\.\s*)[^\n]+\n?)+)/i;
    const actionSectionMatch = response.match(actionSectionRegex);
    
    if (!actionSectionMatch) {
      return [];
    }
    
    // Extract individual action items
    const actionItemsText = actionSectionMatch[1];
    const actionItemRegex = /(?:[-•*]|\d+\.)\s*([^\n]+)/g;
    
    const actionItems: string[] = [];
    let match;
    
    while ((match = actionItemRegex.exec(actionItemsText)) !== null) {
      actionItems.push(match[1].trim());
    }
    
    return actionItems;
  }
  
  /**
   * Parse file paths from Claude response
   */
  public parseFilePaths(response: string): string[] {
    const filePathRegex = /\b(?:\/[\w.-]+)+\b/g;
    const matches = response.match(filePathRegex) || [];
    
    return [...new Set(matches)]; // Remove duplicates
  }
  
  /**
   * Parse JSON from Claude response
   */
  public parseJson<T>(response: string): T | null {
    try {
      const jsonRegex = /```(?:json)?\n([\s\S]*?)```/;
      const match = response.match(jsonRegex);
      
      if (!match) {
        return null;
      }
      
      const jsonString = match[1].trim();
      return JSON.parse(jsonString) as T;
    } catch (error) {
      return null;
    }
  }
}