export declare class GitHubAuth {
    private tokenPath;
    constructor();
    /**
     * Get GitHub token from environment or stored credentials
     */
    getToken(): Promise<string | null>;
    /**
     * Save GitHub token to credentials file
     */
    saveToken(token: string): Promise<void>;
    /**
     * Check if a token has the required permissions
     */
    validateToken(token: string): Promise<boolean>;
}
