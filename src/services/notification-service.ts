/**
 * Service for sending notifications
 */
export interface NotificationService {
  /**
   * Sends an alert notification
   * @param title The alert title
   * @param message The alert message
   * @param recipients The recipients of the alert
   * @param severity The severity level (default: 'info')
   */
  sendAlert(title: string, message: string, recipients: string[], severity?: 'info' | 'warning' | 'error' | 'critical'): Promise<void>;

  /**
   * Sends a status update notification
   * @param title The status title
   * @param message The status message
   * @param recipients The recipients of the status
   */
  sendStatusUpdate(title: string, message: string, recipients: string[]): Promise<void>;
}
