import { StoneConfig } from './schema';
export declare class ConfigLoader {
    private configPath;
    private config;
    constructor(configPath?: string);
    /**
     * Load and validate the configuration file
     */
    load(): Promise<StoneConfig>;
    /**
     * Save configuration to file
     */
    save(config: StoneConfig): Promise<void>;
    /**
     * Get current configuration or load it if not loaded yet
     */
    getConfig(): Promise<StoneConfig>;
}
