export declare class RepositoryAnalyzer {
    private repositoryPath;
    constructor(repositoryPath?: string);
    /**
     * Analyze repository structure to detect packages
     */
    analyzePackages(): Promise<Array<{
        name: string;
        path: string;
        team: string;
    }>>;
    /**
     * Detect test framework used in the repository
     */
    detectTestFramework(): Promise<string>;
}
