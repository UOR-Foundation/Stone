import fs from 'fs';
import path from 'path';
import os from 'os';

export class GitHubAuth {
  private tokenPath: string;

  constructor() {
    this.tokenPath = path.join(os.homedir(), '.stone', 'credentials.json');
  }

  /**
   * Get GitHub token from environment or stored credentials
   */
  public async getToken(): Promise<string | null> {
    // First check environment variable
    if (process.env.STONE_GITHUB_TOKEN) {
      return process.env.STONE_GITHUB_TOKEN;
    }

    // Then check GitHub Actions environment
    if (process.env.GITHUB_TOKEN) {
      return process.env.GITHUB_TOKEN;
    }

    // Finally check stored credentials
    try {
      if (fs.existsSync(this.tokenPath)) {
        const credentials = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
        return credentials.token || null;
      }
    } catch (error) {
      // Ignore errors reading credentials file
    }

    return null;
  }

  /**
   * Save GitHub token to credentials file
   */
  public async saveToken(token: string): Promise<void> {
    const credentialsDir = path.dirname(this.tokenPath);
    
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true });
    }
    
    const credentials = { token };
    fs.writeFileSync(this.tokenPath, JSON.stringify(credentials, null, 2), 'utf8');
    
    // Set permissions to owner read/write only
    fs.chmodSync(this.tokenPath, 0o600);
  }

  /**
   * Check if a token has the required permissions
   */
  public async validateToken(token: string): Promise<boolean> {
    try {
      // Use node-fetch to make a request to GitHub API
      const headers = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': '@uor-foundation/stone',
      };

      const response = await fetch('https://api.github.com/user', {
        headers,
      });

      if (response.ok) {
        // Now check if token has repo and workflow scopes
        const scopesHeader = response.headers.get('x-oauth-scopes');
        if (scopesHeader) {
          const scopes = scopesHeader.split(',').map(s => s.trim());
          return scopes.includes('repo') || (
            scopes.includes('public_repo') && 
            scopes.some(s => s.includes('workflow'))
          );
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}