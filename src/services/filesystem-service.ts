import fs from 'fs/promises';
import path from 'path';
import { LoggerService } from './logger-service';

/**
 * Service for handling file system operations
 */
export class FileSystemService {
  constructor(private logger: LoggerService) {}

  /**
   * Write content to a file
   * @param filePath Path to the file
   * @param content Content to write
   */
  public async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf8');
      this.logger.debug(`File written successfully: ${filePath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to write file: ${filePath}`, { error: errorMessage });
      throw new Error(`Failed to write file: ${filePath} - ${errorMessage}`);
    }
  }

  /**
   * Read content from a file
   * @param filePath Path to the file
   * @returns The file content as a string
   */
  public async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      this.logger.debug(`File read successfully: ${filePath}`);
      return content;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read file: ${filePath}`, { error: errorMessage });
      throw new Error(`Failed to read file: ${filePath} - ${errorMessage}`);
    }
  }

  /**
   * Append content to a file
   * @param filePath Path to the file
   * @param content Content to append
   */
  public async appendFile(filePath: string, content: string): Promise<void> {
    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      await fs.appendFile(filePath, content, 'utf8');
      this.logger.debug(`Content appended to file: ${filePath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to append to file: ${filePath}`, { error: errorMessage });
      throw new Error(`Failed to append to file: ${filePath} - ${errorMessage}`);
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param dirPath Path to the directory
   */
  public async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.debug(`Directory exists or was created: ${dirPath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create directory: ${dirPath}`, { error: errorMessage });
      throw new Error(`Failed to create directory: ${dirPath} - ${errorMessage}`);
    }
  }

  /**
   * Check if a file exists
   * @param filePath Path to the file
   * @returns True if the file exists, false otherwise
   */
  public async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   * @param filePath Path to the file
   */
  public async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.debug(`File deleted: ${filePath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete file: ${filePath}`, { error: errorMessage });
      throw new Error(`Failed to delete file: ${filePath} - ${errorMessage}`);
    }
  }
}