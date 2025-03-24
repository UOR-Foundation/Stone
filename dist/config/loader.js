"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const schema_1 = require("./schema");
class ConfigLoader {
    constructor(configPath) {
        this.config = null;
        this.configPath = configPath || path_1.default.join(process.cwd(), 'stone.config.json');
    }
    /**
     * Load and validate the configuration file
     */
    async load() {
        try {
            // Check if config file exists
            if (!fs_1.default.existsSync(this.configPath)) {
                throw new Error(`Configuration file not found: ${this.configPath}`);
            }
            // Read and parse the config file
            const configContent = fs_1.default.readFileSync(this.configPath, 'utf8');
            const parsedConfig = JSON.parse(configContent);
            // Validate against schema
            const { error, value } = schema_1.configSchema.validate(parsedConfig, {
                abortEarly: false,
                allowUnknown: false,
            });
            if (error) {
                throw new Error(`Configuration validation failed: ${error.message}`);
            }
            this.config = value;
            return this.config;
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in configuration file: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Save configuration to file
     */
    async save(config) {
        try {
            const configContent = JSON.stringify(config, null, 2);
            fs_1.default.writeFileSync(this.configPath, configContent, 'utf8');
            this.config = config;
        }
        catch (error) {
            throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get current configuration or load it if not loaded yet
     */
    async getConfig() {
        if (!this.config) {
            return this.load();
        }
        return this.config;
    }
}
exports.ConfigLoader = ConfigLoader;
