import { ExternalToolIntegration, ExternalTool, ToolExecutionContext } from './external-tool';
import { ExtensionAPI, APIEndpoint, APIRequest, APIResponse, APIMiddleware } from './api';
import { NotificationSystem, NotificationChannel, Notification } from './notification';
import { DataExchangeManager, DataExporter, DataImporter } from './data-exchange';

/**
 * Integration module that exports all integration-related components
 */
export {
  // External tool integration
  ExternalToolIntegration,
  ExternalTool,
  ToolExecutionContext,
  
  // API for third-party extensions
  ExtensionAPI,
  APIEndpoint,
  APIRequest,
  APIResponse,
  APIMiddleware,
  
  // Notification system
  NotificationSystem,
  NotificationChannel,
  Notification,
  
  // Data exchange
  DataExchangeManager,
  DataExporter,
  DataImporter
};

/**
 * Default export of the integration system
 */
export default {
  ExternalToolIntegration,
  ExtensionAPI,
  NotificationSystem,
  DataExchangeManager
};