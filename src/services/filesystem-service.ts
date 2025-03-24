/**
 * Service for file system operations
 */
export interface FileSystemService {
  /**
   * Reads a file from disk
   * @param filePath The path to the file
   * @returns The file contents as string
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Writes a file to disk
   * @param filePath The path to the file
   * @param content The content to write
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * Deletes a file from disk
   * @param filePath The path to the file
   */
  deleteFile(filePath: string): Promise<void>;

  /**
   * Ensures a directory exists, creating it if necessary
   * @param dirPath The path to the directory
   */
  ensureDirectoryExists(dirPath: string): Promise<void>;

  /**
   * Finds files matching a pattern
   * @param pattern The glob pattern to match
   * @returns Array of matching file paths
   */
  findFiles(pattern: string): Promise<string[]>;
}
