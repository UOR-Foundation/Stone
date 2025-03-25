import crypto from 'crypto';
import path from 'path';
import { FileSystemService } from '../services/filesystem-service';
import { LoggerService } from '../services/logger-service';

/**
 * Manages secure storage, retrieval, and rotation of API tokens
 */
export class TokenManager {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly secureDirectory = '.stone/secure';
  private readonly masterKeyPath: string;
  private masterKey: Buffer | null = null;

  constructor(
    private fsService: FileSystemService,
    private logger: LoggerService
  ) {
    this.masterKeyPath = path.join(this.secureDirectory, '.master_key');
  }

  /**
   * Initialize the token manager by ensuring the master encryption key exists
   */
  public async initialize(): Promise<void> {
    try {
      await this.fsService.ensureDirectoryExists(this.secureDirectory);
      
      if (!await this.fsService.fileExists(this.masterKeyPath)) {
        // Generate a new master key if one doesn't exist
        this.masterKey = crypto.randomBytes(this.keyLength);
        await this.fsService.writeFile(this.masterKeyPath, this.masterKey.toString('hex'));
        this.logger.info('Generated new master encryption key');
      } else {
        // Load existing master key
        const masterKeyHex = await this.fsService.readFile(this.masterKeyPath);
        this.masterKey = Buffer.from(masterKeyHex, 'hex');
        this.logger.debug('Loaded existing master encryption key');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to initialize token manager', { error: errorMessage });
      throw new Error(`Failed to initialize token manager: ${errorMessage}`);
    }
  }

  /**
   * Store an API token securely
   * @param token The token to store
   * @param type The type of token (e.g., 'github', 'npm')
   */
  public async storeToken(token: string, type: string): Promise<void> {
    try {
      if (!this.masterKey) {
        await this.initialize();
      }
      
      const encryptedToken = this.encrypt(token);
      const tokenPath = this.getTokenPath(type);
      
      await this.fsService.writeFile(tokenPath, encryptedToken);
      this.logger.info(`Stored ${type} token securely`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to store token: ${type}`, { error: errorMessage });
      throw new Error(`Failed to store token: ${errorMessage}`);
    }
  }

  /**
   * Retrieve and decrypt a stored token
   * @param type The type of token to retrieve
   * @returns The decrypted token
   */
  public async retrieveToken(type: string): Promise<string> {
    try {
      if (!this.masterKey) {
        await this.initialize();
      }
      
      const tokenPath = this.getTokenPath(type);
      
      if (!await this.fsService.fileExists(tokenPath)) {
        throw new Error(`Token not found: ${type}`);
      }
      
      const encryptedToken = await this.fsService.readFile(tokenPath);
      const token = this.decrypt(encryptedToken);
      
      this.logger.debug(`Retrieved ${type} token`);
      return token;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to retrieve token: ${type}`, { error: errorMessage });
      throw new Error(`Failed to retrieve token: ${errorMessage}`);
    }
  }

  /**
   * Rotate a token by using a rotation function and storing the new token
   * @param type The type of token to rotate
   * @param rotationFn Function that takes the old token and returns a new one
   * @returns The new token
   */
  public async rotateToken(
    type: string, 
    rotationFn: (oldToken: string) => Promise<string>
  ): Promise<string> {
    try {
      // Get the current token
      const oldToken = await this.retrieveToken(type);
      
      // Generate a new token using the provided rotation function
      const newToken = await rotationFn(oldToken);
      
      // Store the new token
      await this.storeToken(newToken, type);
      
      this.logger.info(`Rotated ${type} token successfully`);
      return newToken;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to rotate token: ${type}`, { error: errorMessage });
      throw new Error(`Failed to rotate token: ${errorMessage}`);
    }
  }

  /**
   * Validate a token using a validation function
   * @param token The token to validate
   * @param validationFn Function that checks if the token is valid
   * @returns True if the token is valid, false otherwise
   */
  public async validateToken(
    token: string,
    validationFn: (token: string) => Promise<boolean>
  ): Promise<boolean> {
    try {
      const isValid = await validationFn(token);
      return isValid;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Token validation failed', { error: errorMessage });
      return false;
    }
  }

  /**
   * Encrypt a string using the master key
   * @param text The text to encrypt
   * @returns The encrypted text
   */
  public encrypt(text: string): string {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(this.ivLength);
    
    // Create a cipher using the master key and IV
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine the IV, encrypted text, and auth tag
    // Format: iv:encrypted:authTag
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  /**
   * Decrypt an encrypted string using the master key
   * @param encryptedText The encrypted text to decrypt
   * @returns The decrypted text
   */
  public decrypt(encryptedText: string): string {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }
    
    // Split the encrypted text into its components
    const [ivHex, encrypted, authTagHex] = encryptedText.split(':');
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create a decipher using the master key and IV
    const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
    
    // Set the authentication tag
    decipher.setAuthTag(authTag);
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get the file path for storing a token of a specific type
   * @param type The token type
   * @returns The file path
   */
  private getTokenPath(type: string): string {
    return path.join(this.secureDirectory, `${type}_token`);
  }
}
