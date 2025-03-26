import { ExtensionAPI, APIEndpoint, APIRequest, APIResponse } from '../../../src/integration/api';

describe('Extension API', () => {
  let extensionAPI: ExtensionAPI;

  beforeEach(() => {
    extensionAPI = new ExtensionAPI();
  });

  describe('registerEndpoint', () => {
    it('should register an API endpoint', () => {
      const endpoint: APIEndpoint = {
        path: '/api/status',
        method: 'GET',
        handler: jest.fn(),
        requiresAuth: false
      };

      extensionAPI.registerEndpoint(endpoint);
      
      expect(extensionAPI.getEndpoint('/api/status', 'GET')).toBe(endpoint);
    });

    it('should throw error when registering duplicate endpoint', () => {
      const endpoint: APIEndpoint = {
        path: '/api/status',
        method: 'GET',
        handler: jest.fn(),
        requiresAuth: false
      };

      extensionAPI.registerEndpoint(endpoint);
      
      expect(() => extensionAPI.registerEndpoint(endpoint)).toThrow();
    });
  });

  describe('handleRequest', () => {
    it('should handle API request and return response', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ 
        status: 200, 
        body: { message: 'Success' } 
      });
      
      const endpoint: APIEndpoint = {
        path: '/api/status',
        method: 'GET',
        handler: mockHandler,
        requiresAuth: false
      };

      extensionAPI.registerEndpoint(endpoint);
      
      const request: APIRequest = {
        path: '/api/status',
        method: 'GET',
        query: {},
        body: {},
        headers: {}
      };
      
      const response = await extensionAPI.handleRequest(request);
      
      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Success' });
    });

    it('should return 404 for non-existent endpoint', async () => {
      const request: APIRequest = {
        path: '/api/non-existent',
        method: 'GET',
        query: {},
        body: {},
        headers: {}
      };
      
      const response = await extensionAPI.handleRequest(request);
      
      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthorized access to protected endpoint', async () => {
      const endpoint: APIEndpoint = {
        path: '/api/protected',
        method: 'GET',
        handler: jest.fn(),
        requiresAuth: true
      };

      extensionAPI.registerEndpoint(endpoint);
      
      const request: APIRequest = {
        path: '/api/protected',
        method: 'GET',
        query: {},
        body: {},
        headers: {} // No auth header
      };
      
      const response = await extensionAPI.handleRequest(request);
      
      expect(response.status).toBe(401);
    });
  });

  describe('unregisterEndpoint', () => {
    it('should unregister an API endpoint', () => {
      const endpoint: APIEndpoint = {
        path: '/api/status',
        method: 'GET',
        handler: jest.fn(),
        requiresAuth: false
      };

      extensionAPI.registerEndpoint(endpoint);
      expect(extensionAPI.getEndpoint('/api/status', 'GET')).toBe(endpoint);
      
      extensionAPI.unregisterEndpoint('/api/status', 'GET');
      expect(extensionAPI.getEndpoint('/api/status', 'GET')).toBeUndefined();
    });
  });

  describe('middleware', () => {
    it('should process middleware functions', async () => {
      const middleware1 = jest.fn().mockImplementation((req, next) => next(req));
      const middleware2 = jest.fn().mockImplementation((req, next) => next(req));
      
      extensionAPI.addMiddleware(middleware1);
      extensionAPI.addMiddleware(middleware2);
      
      const mockHandler = jest.fn().mockResolvedValue({ 
        status: 200, 
        body: { message: 'Success' } 
      });
      
      const endpoint: APIEndpoint = {
        path: '/api/test',
        method: 'GET',
        handler: mockHandler,
        requiresAuth: false
      };

      extensionAPI.registerEndpoint(endpoint);
      
      const request: APIRequest = {
        path: '/api/test',
        method: 'GET',
        query: {},
        body: {},
        headers: {}
      };
      
      await extensionAPI.handleRequest(request);
      
      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });
  });
});