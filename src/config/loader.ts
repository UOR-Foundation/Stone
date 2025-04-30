import fs from 'fs';
import path from 'path';
import { configSchema, StoneConfig, validateConfig } from './schema';
import { Logger } from '../utils/logger';

/**
 * Loads and validates Stone configuration
 */
export class ConfigLoader {
  private configPath: string;
  private config: StoneConfig | null = null;
  private logger: Logger;

  /**
   * Create a new config loader
   * @param configPath Path to the configuration file (defaults to stone.config.json in current directory)
   */
  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'stone.config.json');
    this.logger = new Logger();
  }

  /**
   * Load and validate the configuration file
   * @returns Validated Stone configuration
   * @throws Error if configuration file is not found, invalid, or fails validation
   */
  public async load(): Promise<StoneConfig> {
    try {
      this.logger.info(`Loading configuration from ${this.configPath}`);
      
      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        this.logger.error(`Configuration file not found: ${this.configPath}`);
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      // Read and parse the config file
      let configContent: string;
      try {
        configContent = fs.readFileSync(this.configPath, 'utf8');
      } catch (error) {
        this.logger.error(`Error reading configuration file: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Error reading configuration file: ${error instanceof Error ? error.message : String(error)}`);
      }

      let parsedConfig: any;
      try {
        parsedConfig = JSON.parse(configContent);
      } catch (error) {
        this.logger.error(`Invalid JSON in configuration file: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Invalid JSON in configuration file: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Validate against schema
      this.logger.info('Validating configuration against schema');
      const { error, value } = configSchema.validate(parsedConfig, {
        abortEarly: false,
        allowUnknown: false,
      });

      if (error) {
        const errorDetails = error.details.map(detail => detail.message).join(', ');
        this.logger.error(`Configuration validation failed: ${errorDetails}`);
        throw new Error(`Configuration validation failed: ${errorDetails}`);
      }

      this.config = value as StoneConfig;
      this.logger.success('Configuration loaded and validated successfully');
      return this.config;
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error(`Unknown error loading configuration: ${String(error)}`);
      }
      throw error;
    }
  }

  /**
   * Save configuration to file
   * @param config Stone configuration to save
   * @throws Error if configuration fails validation or cannot be saved
   */
  public async save(config: StoneConfig): Promise<void> {
    try {
      this.logger.info(`Saving configuration to ${this.configPath}`);
      
      // Validate configuration before saving
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        const errorDetails = validation.errors.join(', ');
        this.logger.error(`Cannot save invalid configuration: ${errorDetails}`);
        throw new Error(`Cannot save invalid configuration: ${errorDetails}`);
      }
      
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        this.logger.info(`Creating directory: ${configDir}`);
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Write configuration to file
      const configContent = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configContent, 'utf8');
      this.config = config;
      
      this.logger.success('Configuration saved successfully');
    } catch (error) {
      this.logger.error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current configuration or load it if not loaded yet
   * @returns Stone configuration
   */
  public async getConfig(): Promise<StoneConfig> {
    try {
      if (!this.config) {
        this.logger.info('No configuration loaded, loading from file');
        return this.load();
      }
      return this.config;
    } catch (error) {
      this.logger.error(`Failed to get configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate a configuration object against the schema
   * @param config Configuration object to validate
   * @returns Validation result with errors if any
   */
  public validateConfig(config: StoneConfig): { isValid: boolean; errors: string[] } {
    try {
      this.logger.info('Validating configuration against schema');
      return validateConfig(config);
    } catch (error) {
      this.logger.error(`Error during configuration validation: ${error instanceof Error ? error.message : String(error)}`);
      return { 
        isValid: false, 
        errors: [`Error during validation: ${error instanceof Error ? error.message : String(error)}`] 
      };
    }
  }
  
  /**
   * Check if configuration file exists
   * @returns True if configuration file exists, false otherwise
   */
  public configExists(): boolean {
    return fs.existsSync(this.configPath);
  }
  
  /**
   * Create a backup of the configuration file
   * @returns Path to the backup file or null if backup failed
   */
  public createBackup(): string | null {
    try {
      if (!this.configExists()) {
        this.logger.warning('Cannot create backup: Configuration file does not exist');
        return null;
      }
      
      const backupPath = `${this.configPath}.backup.${Date.now()}`;
      this.logger.info(`Creating backup of configuration at ${backupPath}`);
      
      fs.copyFileSync(this.configPath, backupPath);
      this.logger.success(`Backup created at ${backupPath}`);
      
      return backupPath;
    } catch (error) {
      this.logger.error(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Restore configuration from a backup file
   * @param backupPath Path to the backup file
   * @returns True if restore was successful, false otherwise
   */
  public restoreFromBackup(backupPath: string): boolean {
    try {
      this.logger.info(`Restoring configuration from backup: ${backupPath}`);
      
      if (!fs.existsSync(backupPath)) {
        this.logger.error(`Backup file not found: ${backupPath}`);
        return false;
      }
      
      fs.copyFileSync(backupPath, this.configPath);
      this.config = null; // Reset cached config
      
      this.logger.success('Configuration restored from backup');
      return true;
    } catch (error) {
      this.logger.error(`Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
