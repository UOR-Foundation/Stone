import { startDashboardServer, stopDashboardServer } from '../../../src/performance/dashboard-server';
import { LoggerService } from '../../../src/services/logger-service';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';

jest.mock('../../../src/services/logger-service');

let mockServer: any = {
  close: jest.fn()
};

jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn(() => mockServer)
  };
  const mockExpress = jest.fn(() => mockApp);
  Object.defineProperty(mockExpress, 'static', {
    value: jest.fn()
  });
  return mockExpress;
});

jest.mock('http', () => ({
  Server: jest.fn(() => ({
    close: jest.fn()
  }))
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

describe('Dashboard Server', () => {
  let mockLogger: jest.Mocked<LoggerService>;
  let mockServer: jest.Mocked<http.Server>;
  let mockApp: any;
  let mockResponse: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    
    mockApp = express();
    mockServer = mockApp.listen() as jest.Mocked<http.Server>;
    
    mockResponse = {
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
      sendFile: jest.fn(),
      send: jest.fn()
    };
    
    (mockApp.get as jest.Mock).mockImplementation((path: string, handler: Function) => {
      if (path === '/') {
        handler({}, mockResponse);
      } else if (path === '/health') {
        handler({}, mockResponse);
      } else if (path === '*') {
        handler({}, mockResponse);
      }
    });
    
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    (fs.readFileSync as jest.Mock).mockReturnValue('<!DOCTYPE html><html><body>Dashboard</body></html>');
  });
  
  afterEach(() => {
    stopDashboardServer();
  });
  
  describe('startDashboardServer and stopDashboardServer', () => {
    it('should start and stop the dashboard server', () => {
      startDashboardServer(3000);
      
      expect(mockApp.use).toHaveBeenCalled();
      expect(mockApp.get).toHaveBeenCalledWith('/', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('*', expect.any(Function));
      expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      
      expect(mockResponse.sendFile).toHaveBeenCalled();
      
      stopDashboardServer();
      
      expect(mockServer.close).toHaveBeenCalled();
    });
    
    it('should handle missing index.html', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      
      startDashboardServer(3000);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith('Dashboard not built. Run `pnpm build:dashboard` first.');
      
      stopDashboardServer();
    });
    
    it('should handle health check endpoint', () => {
      startDashboardServer(3000);
      
      const healthHandler = (mockApp.get as jest.Mock).mock.calls.find(call => call[0] === '/health')[1];
      
      healthHandler({}, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith({ status: 'ok' });
      
      stopDashboardServer();
    });
  });
});
