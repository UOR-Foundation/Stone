export declare class Logger {
    /**
     * Log an informational message
     */
    info(message: string): void;
    /**
     * Log a success message
     */
    success(message: string): void;
    /**
     * Log a warning message
     */
    warning(message: string): void;
    /**
     * Log an error message
     */
    error(message: string): void;
    /**
     * Log a debug message (only in debug mode)
     */
    debug(message: string): void;
}
