import { ExternalToolIntegration } from './external-tool';
import type { ExternalTool, ToolExecutionContext } from './external-tool';
import { ExtensionAPI } from './api';
import type { APIEndpoint, APIRequest, APIResponse, APIMiddleware } from './api';
import { NotificationSystem } from './notification';
import type { NotificationChannel, Notification } from './notification';
import { DataExchangeManager } from './data-exchange';
import type { DataExporter, DataImporter } from './data-exchange';

/**
 * Integration module that exports all integration-related components
 */
export {
  // External tool integration
  ExternalToolIntegration,
  
  // API for third-party extensions
  ExtensionAPI,
  
  // Notification system
  NotificationSystem,
  
  // Data exchange
  DataExchangeManager
};

// Export types
export type {
  ExternalTool,
  ToolExecutionContext,
  APIEndpoint,
  APIRequest,
  APIResponse,
  APIMiddleware,
  NotificationChannel,
  Notification,
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