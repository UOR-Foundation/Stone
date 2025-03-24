import { StoneConfig } from './schema';
export declare class ConfigGenerator {
    private repositoryPath;
    private configLoader;
    private analyzer;
    constructor(repositoryPath?: string);
    /**
     * Generate a default configuration based on repository analysis
     */
    generate(owner: string, name: string): Promise<StoneConfig>;
    /**
     * Create the directory structure for Stone
     */
    createDirectories(config: StoneConfig): Promise<void>;
}
