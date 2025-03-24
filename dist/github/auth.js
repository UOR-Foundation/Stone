"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubAuth = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class GitHubAuth {
    constructor() {
        this.tokenPath = path_1.default.join(os_1.default.homedir(), '.stone', 'credentials.json');
    }
    /**
     * Get GitHub token from environment or stored credentials
     */
    async getToken() {
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
            if (fs_1.default.existsSync(this.tokenPath)) {
                const credentials = JSON.parse(fs_1.default.readFileSync(this.tokenPath, 'utf8'));
                return credentials.token || null;
            }
        }
        catch (error) {
            // Ignore errors reading credentials file
        }
        return null;
    }
    /**
     * Save GitHub token to credentials file
     */
    async saveToken(token) {
        const credentialsDir = path_1.default.dirname(this.tokenPath);
        if (!fs_1.default.existsSync(credentialsDir)) {
            fs_1.default.mkdirSync(credentialsDir, { recursive: true });
        }
        const credentials = { token };
        fs_1.default.writeFileSync(this.tokenPath, JSON.stringify(credentials, null, 2), 'utf8');
        // Set permissions to owner read/write only
        fs_1.default.chmodSync(this.tokenPath, 0o600);
    }
    /**
     * Check if a token has the required permissions
     */
    async validateToken(token) {
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
                    return scopes.includes('repo') || (scopes.includes('public_repo') &&
                        scopes.some(s => s.includes('workflow')));
                }
            }
            return false;
        }
        catch (error) {
            return false;
        }
    }
}
exports.GitHubAuth = GitHubAuth;
