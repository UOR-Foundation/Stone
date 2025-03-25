/**
 * Interface defining an API request
 */
export interface APIRequest {
  path: string;
  method: string;
  query: Record<string, any>;
  body: Record<string, any>;
  headers: Record<string, string>;
}

/**
 * Interface defining an API response
 */
export interface APIResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

/**
 * Interface defining an API endpoint
 */
export interface APIEndpoint {
  path: string;
  method: string;
  handler: (request: APIRequest) => Promise<APIResponse>;
  requiresAuth: boolean;
}

/**
 * Type for API middleware function
 */
export type APIMiddleware = (request: APIRequest, next: (request: APIRequest) => Promise<APIResponse>) => Promise<APIResponse>;

/**
 * Class for managing the extension API
 */
export class ExtensionAPI {
  private endpoints: Map<string, APIEndpoint> = new Map();
  private middleware: APIMiddleware[] = [];

  /**
   * Registers an API endpoint
   */
  registerEndpoint(endpoint: APIEndpoint): void {
    const key = this.getEndpointKey(endpoint.path, endpoint.method);
    if (this.endpoints.has(key)) {
      throw new Error(`Endpoint for ${endpoint.method} ${endpoint.path} is already registered`);
    }

    this.endpoints.set(key, endpoint);
  }

  /**
   * Gets an endpoint by path and method
   */
  getEndpoint(path: string, method: string): APIEndpoint | undefined {
    return this.endpoints.get(this.getEndpointKey(path, method));
  }

  /**
   * Unregisters an endpoint by path and method
   */
  unregisterEndpoint(path: string, method: string): boolean {
    return this.endpoints.delete(this.getEndpointKey(path, method));
  }

  /**
   * Creates a unique key for an endpoint
   */
  private getEndpointKey(path: string, method: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * Adds middleware to the API
   */
  addMiddleware(middleware: APIMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Handles an API request
   */
  async handleRequest(request: APIRequest): Promise<APIResponse> {
    const endpoint = this.getEndpoint(request.path, request.method);
    
    if (!endpoint) {
      return { status: 404, body: { error: 'Endpoint not found' } };
    }

    // Check if authentication is required
    if (endpoint.requiresAuth && !this.isAuthenticated(request)) {
      return { status: 401, body: { error: 'Authentication required' } };
    }

    // Apply middleware
    let currentRequest = request;
    let handlerFn = async (req: APIRequest) => endpoint.handler(req);

    // Chain middleware in reverse order
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const middleware = this.middleware[i];
      const nextHandler = handlerFn;
      handlerFn = async (req: APIRequest) => middleware(req, nextHandler);
    }

    try {
      return await handlerFn(currentRequest);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: 500,
        body: { error: `Internal server error: ${errorMessage}` }
      };
    }
  }

  /**
   * Checks if a request is authenticated
   */
  private isAuthenticated(request: APIRequest): boolean {
    // Simple check for authorization header
    // In a real implementation, this would verify tokens, etc.
    return !!request.headers['authorization'];
  }

  /**
   * Gets all registered endpoints
   */
  getAllEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }
}

/**
 * Export necessary components
 */
export default {
  ExtensionAPI
};