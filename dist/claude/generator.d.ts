import { StoneConfig } from '../config';
export declare class ClaudeFileGenerator {
    private config;
    constructor(config: StoneConfig);
    /**
     * Generate Claude files for each role
     */
    generateClaudeFiles(): Promise<void>;
    /**
     * Generate Claude file for PM role
     */
    private generatePMClaudeFile;
    /**
     * Generate Claude file for QA role
     */
    private generateQAClaudeFile;
    /**
     * Generate Claude file for Feature team role
     */
    private generateFeatureClaudeFile;
    /**
     * Generate Claude file for Auditor role
     */
    private generateAuditorClaudeFile;
    /**
     * Generate Claude file for GitHub Actions role
     */
    private generateActionsClaudeFile;
}
