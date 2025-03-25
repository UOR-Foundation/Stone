import path from 'path';
import { FileSystemService } from '../services/filesystem-service';
import { LoggerService } from '../services/logger-service';
import { SensitiveDataFilter } from './data-filter';

/**
 * Security event type
 */
export interface SecurityEvent {
  type: string;
  action: string;
  user?: string;
  resource?: string;
  status?: string;
  details?: Record<string, any>;
  timestamp?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Filter options for retrieving events
 */
export interface EventFilterOptions {
  type?: string;
  action?: string;
  user?: string;
  status?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

/**
 * Security report structure
 */
export interface SecurityReport {
  totalEvents: number;
  eventsByType: Record<string, number>;
  authenticationFailures: number;
  permissionDenials: number;
  userActivity: Record<string, number>;
  timeRange: {
    start: string;
    end: string;
  };
  summary: string;
}

/**
 * Logger for security audit events
 */
export class SecurityAuditLogger {
  private readonly auditLogDir = '.stone/security-logs';
  private readonly auditLogFile: string;

  constructor(
    private fsService: FileSystemService,
    private logger: LoggerService,
    private dataFilter: SensitiveDataFilter
  ) {
    this.auditLogFile = path.join(this.auditLogDir, 'security-audit.log');
  }

  /**
   * Log a security event to the audit log
   * @param event The security event to log
   */
  public async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Ensure the log directory exists
      await this.fsService.ensureDirectoryExists(this.auditLogDir);
      
      // Add timestamp if not provided
      const timestamp = event.timestamp || new Date().toISOString();
      const eventWithTimestamp = { ...event, timestamp };
      
      // Filter sensitive data
      const filteredEvent = this.dataFilter.sanitizeForLog(eventWithTimestamp);
      
      // Format as JSON line
      const logLine = JSON.stringify(filteredEvent) + '\n';
      
      // Append to log file
      await this.fsService.appendFile(this.auditLogFile, logLine);
      
      this.logger.debug('Security event logged', { type: event.type, action: event.action });
    } catch (error: unknown) {
      this.logger.error('Failed to write to security audit log', { error: error instanceof Error ? error.message : String(error) });
      // We intentionally don't rethrow here to avoid disrupting application flow
      // when logging fails, but we do log the error
    }
  }

  /**
   * Get recent security events with optional filtering
   * @param options Filter options
   * @returns Array of filtered security events
   */
  public async getRecentEvents(options: EventFilterOptions = {}): Promise<SecurityEvent[]> {
    try {
      // Check if log file exists
      const exists = await this.fsService.fileExists(this.auditLogFile);
      if (!exists) {
        return [];
      }
      
      // Read log file
      const content = await this.fsService.readFile(this.auditLogFile);
      if (!content.trim()) {
        return [];
      }
      
      // Parse log lines into events
      const events: SecurityEvent[] = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            this.logger.warn(`Invalid JSON in security log: ${line}`);
            return null;
          }
        })
        .filter(event => event !== null);
      
      // Apply filters
      let filteredEvents = events;
      
      if (options.type) {
        filteredEvents = filteredEvents.filter(event => event.type === options.type);
      }
      
      if (options.action) {
        filteredEvents = filteredEvents.filter(event => event.action === options.action);
      }
      
      if (options.user) {
        filteredEvents = filteredEvents.filter(event => event.user === options.user);
      }
      
      if (options.status) {
        filteredEvents = filteredEvents.filter(event => event.status === options.status);
      }
      
      if (options.startTime) {
        filteredEvents = filteredEvents.filter(event => {
          if (!event.timestamp) return false;
          return new Date(event.timestamp) >= options.startTime!;
        });
      }
      
      if (options.endTime) {
        filteredEvents = filteredEvents.filter(event => {
          if (!event.timestamp) return false;
          return new Date(event.timestamp) <= options.endTime!;
        });
      }
      
      // Sort by timestamp (newest first)
      filteredEvents.sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      });
      
      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        filteredEvents = filteredEvents.slice(0, options.limit);
      }
      
      return filteredEvents;
    } catch (error: unknown) {
      this.logger.error('Failed to retrieve security events', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Generate a security report for a time period
   * @param options Filter options including timeframe
   * @returns Security report
   */
  public async generateSecurityReport(options: EventFilterOptions = {}): Promise<SecurityReport> {
    // Default to last 30 days if not specified
    const endTime = options.endTime || new Date();
    const startTime = options.startTime || new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get events for the time period
    const events = await this.getRecentEvents({
      ...options,
      startTime,
      endTime
    });
    
    // Initialize report
    const report: SecurityReport = {
      totalEvents: events.length,
      eventsByType: {},
      authenticationFailures: 0,
      permissionDenials: 0,
      userActivity: {},
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString()
      },
      summary: ''
    };
    
    // Count events by type
    for (const event of events) {
      // Count by event type
      report.eventsByType[event.type] = (report.eventsByType[event.type] || 0) + 1;
      
      // Count auth failures
      if (event.type === 'authentication' && event.status === 'failed') {
        report.authenticationFailures++;
      }
      
      // Count permission denials
      if (event.type === 'access_control' && event.action === 'permission_denied') {
        report.permissionDenials++;
      }
      
      // Count user activity
      if (event.user) {
        report.userActivity[event.user] = (report.userActivity[event.user] || 0) + 1;
      }
    }
    
    // Generate summary
    const timeRangeText = `${startTime.toDateString()} to ${endTime.toDateString()}`;
    report.summary = `Security analysis for ${timeRangeText}: ${report.totalEvents} events recorded. ` +
      `Notable: ${report.authenticationFailures} authentication failures, ` +
      `${report.permissionDenials} permission denials.`;
    
    return report;
  }
}
