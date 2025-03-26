import fs from 'fs';
import path from 'path';
import { configSchema, StoneConfig } from './schema';

export class ConfigLoader {
  private configPath: string;
  private config: StoneConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'stone.config.json');
  }

  /**
   * Load and validate the configuration file
   */
  public async load(): Promise<StoneConfig> {
    try {
      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      // Read and parse the config file
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const parsedConfig = JSON.parse(configContent);

      // Validate against schema
      const { error, value } = configSchema.validate(parsedConfig, {
        abortEarly: false,
        allowUnknown: false,
      });

      if (error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
      }

      this.config = value as StoneConfig;
      return this.config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  public async save(config: StoneConfig): Promise<void> {
    try {
      const configContent = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configContent, 'utf8');
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current configuration or load it if not loaded yet
   */
  public async getConfig(): Promise<StoneConfig> {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  /**
   * Validate a configuration object against the schema
   */
  public validateConfig(config: StoneConfig): { isValid: boolean; errors: string[] } {
    const { error } = configSchema.validate(config, {
      abortEarly: false,
      allowUnknown: false,
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
  }
}