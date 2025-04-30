import { Controller, ParentConfig } from '../../../src/scalability/controller';
import { LoggerService } from '../../../src/services/logger-service';
import { GitService } from '../../../src/services/git-service';
import { FileSystemService } from '../../../src/services/filesystem-service';
import { MultiRepositoryManager } from '../../../src/scalability/multi-repository-manager';
import { ResourceController } from '../../../src/scalability/resource-controller';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../../src/services/logger-service');
jest.mock('../../../src/services/git-service');
jest.mock('../../../src/services/filesystem-service');
jest.mock('../../../src/scalability/multi-repository-manager');
jest.mock('../../../src/scalability/resource-controller');

describe('Controller', () => {
  let controller: Controller;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockGitService: jest.Mocked<GitService>;
  let mockFsService: jest.Mocked<FileSystemService>;
  let mockRepoManager: jest.Mocked<MultiRepositoryManager>;
  let mockResourceController: jest.Mocked<ResourceController>;
  let mockConfig: ParentConfig;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      repositories: [
        { path: '/repo1', name: 'repo1', owner: 'owner1', enabled: true },
        { path: '/repo2', name: 'repo2', owner: 'owner2', enabled: false }
      ],
      concurrency: 2,
      pollingInterval: 30000,
      logLevel: 'info'
    }));
    
    mockLogger = new LoggerService() as jest.Mocked<LoggerService>;
    mockGitService = new GitService(mockLogger) as jest.Mocked<GitService>;
    mockFsService = new FileSystemService(mockLogger) as jest.Mocked<FileSystemService>;
    mockRepoManager = new MultiRepositoryManager('', mockGitService, mockFsService, mockLogger) as jest.Mocked<MultiRepositoryManager>;
    mockResourceController = new ResourceController(mockLogger) as jest.Mocked<ResourceController>;
    
    (LoggerService as jest.Mock).mockImplementation(() => mockLogger);
    (GitService as jest.Mock).mockImplementation(() => mockGitService);
    (FileSystemService as jest.Mock).mockImplementation(() => mockFsService);
    (MultiRepositoryManager as jest.Mock).mockImplementation(() => mockRepoManager);
    (ResourceController as jest.Mock).mockImplementation(() => mockResourceController);
    
    mockRepoManager.registerRepository = jest.fn().mockResolvedValue(undefined);
    mockRepoManager.getAllRepositories = jest.fn().mockReturnValue([
      { path: '/repo1', name: 'repo1' }
    ]);
    
    mockResourceController.getResourceUsage = jest.fn().mockReturnValue({
      parallelOperations: 0,
      memoryUsage: 0,
      cpuUsage: 0
    });
    mockResourceController.incrementParallelOperations = jest.fn();
    mockResourceController.decrementParallelOperations = jest.fn();
    
    controller = new Controller('/path/to/config.json');
    
    (controller as any).repositoryManager = mockRepoManager;
    (controller as any).resourceController = mockResourceController;
    
    mockConfig = {
      repositories: [
        { path: '/repo1', name: 'repo1', owner: 'owner1', enabled: true },
        { path: '/repo2', name: 'repo2', owner: 'owner2', enabled: false }
      ],
      concurrency: 2,
      pollingInterval: 30000,
      logLevel: 'info'
    };
    (controller as any).config = mockConfig;
  });
  
  describe('loadConfig', () => {
    it('should load configuration from file', async () => {
      const loadConfig = (controller as any).loadConfig.bind(controller);
      
      const config = await loadConfig();
      
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/config.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/config.json', 'utf-8');
      expect(config).toHaveProperty('repositories');
      expect(config.repositories).toHaveLength(2);
      expect(config.concurrency).toBe(2);
      expect(config.pollingInterval).toBe(30000);
    });
    
    it('should throw error if config file not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const loadConfig = (controller as any).loadConfig.bind(controller);
      
      await expect(loadConfig()).rejects.toThrow('Configuration file not found');
    });
    
    it('should throw error if config is invalid', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('{ "invalid": true }');
      
      const loadConfig = (controller as any).loadConfig.bind(controller);
      
      await expect(loadConfig()).rejects.toThrow('Invalid configuration');
    });
    
    it('should set default values for missing properties', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        repositories: [{ path: '/repo1', name: 'repo1', owner: 'owner1', enabled: true }]
      }));
      
      const loadConfig = (controller as any).loadConfig.bind(controller);
      
      const config = await loadConfig();
      
      expect(config.concurrency).toBe(2); // Default
      expect(config.pollingInterval).toBe(60000); // Default
      expect(config.logLevel).toBe('info'); // Default
    });
  });
  
  describe('initialize', () => {
    it('should initialize controller components', async () => {
      (controller as any).loadConfig = jest.fn().mockResolvedValue(mockConfig);
      
      const initialize = (controller as any).initialize.bind(controller);
      
      await initialize();
      
      expect((controller as any).loadConfig).toHaveBeenCalled();
      expect(MultiRepositoryManager).toHaveBeenCalled();
      expect(ResourceController).toHaveBeenCalled();
      expect(mockRepoManager.registerRepository).toHaveBeenCalledWith(
        'repo1',
        'https://github.com/owner1/repo1.git'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Controller initialized successfully');
    });
    
    it('should handle initialization errors', async () => {
      (controller as any).loadConfig = jest.fn().mockRejectedValue(new Error('Config error'));
      
      const initialize = (controller as any).initialize.bind(controller);
      
      await expect(initialize()).rejects.toThrow('Failed to initialize controller');
    });
  });
  
  describe('start', () => {
    it('should start the controller', async () => {
      (controller as any).initialize = jest.fn().mockResolvedValue(undefined);
      (controller as any).startPolling = jest.fn();
      
      await controller.start();
      
      expect((controller as any).initialize).toHaveBeenCalled();
      expect((controller as any).startPolling).toHaveBeenCalled();
      expect((controller as any).isRunning).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Controller started successfully');
    });
    
    it('should not start if already running', async () => {
      (controller as any).isRunning = true;
      
      await controller.start();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Controller is already running');
    });
    
    it('should handle start errors', async () => {
      (controller as any).initialize = jest.fn().mockRejectedValue(new Error('Init error'));
      
      await expect(controller.start()).rejects.toThrow('Init error');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to start controller'));
    });
  });
  
  describe('stop', () => {
    it('should stop the controller', () => {
      (controller as any).isRunning = true;
      
      (controller as any).pollingInterval = setInterval(() => {}, 1000);
      
      const mockProcess = {
        kill: jest.fn()
      };
      (controller as any).childProcesses = new Map([
        ['/repo1', mockProcess]
      ]);
      
      controller.stop();
      
      expect((controller as any).isRunning).toBe(false);
      expect((controller as any).pollingInterval).toBeNull();
      expect(mockProcess.kill).toHaveBeenCalled();
      expect((controller as any).childProcesses.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Controller stopped successfully');
    });
    
    it('should not stop if not running', () => {
      (controller as any).isRunning = false;
      
      controller.stop();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Controller is not running');
    });
  });
  
  describe('pollRepositories', () => {
    it('should poll repositories and process them', async () => {
      (controller as any).processRepository = jest.fn();
      
      const pollRepositories = (controller as any).pollRepositories.bind(controller);
      
      await pollRepositories();
      
      expect(mockRepoManager.getAllRepositories).toHaveBeenCalled();
      expect(mockResourceController.getResourceUsage).toHaveBeenCalled();
      expect(mockResourceController.incrementParallelOperations).toHaveBeenCalled();
      expect((controller as any).processRepository).toHaveBeenCalledWith('/repo1');
    });
    
    it('should not process repositories if at max concurrency', async () => {
      mockResourceController.getResourceUsage = jest.fn().mockReturnValue({
        parallelOperations: 2, // Same as config.concurrency
        memoryUsage: 0,
        cpuUsage: 0
      });
      
      (controller as any).processRepository = jest.fn();
      
      const pollRepositories = (controller as any).pollRepositories.bind(controller);
      
      await pollRepositories();
      
      expect(mockResourceController.incrementParallelOperations).not.toHaveBeenCalled();
      expect((controller as any).processRepository).not.toHaveBeenCalled();
    });
    
    it('should handle errors during polling', async () => {
      mockRepoManager.getAllRepositories = jest.fn().mockImplementation(() => {
        throw new Error('Repo error');
      });
      
      const pollRepositories = (controller as any).pollRepositories.bind(controller);
      
      await pollRepositories();
      
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to poll repositories'));
    });
  });
  
  describe('processRepository', () => {
    it('should spawn a Stone process for the repository', () => {
      const mockChildProcess = new EventEmitter() as ChildProcess;
      mockChildProcess.stdout = new EventEmitter() as any;
      mockChildProcess.stderr = new EventEmitter() as any;
      mockChildProcess.kill = jest.fn();
      
      const spawnMock = jest.fn().mockReturnValue(mockChildProcess);
      require('child_process').spawn = spawnMock;
      
      const processRepository = (controller as any).processRepository.bind(controller);
      
      processRepository('/repo1');
      
      expect(spawnMock).toHaveBeenCalledWith(
        'npx',
        ['stone', 'process', '--auto'],
        expect.objectContaining({
          cwd: '/repo1',
          env: expect.objectContaining({ STONE_CONTROLLER: 'true' })
        })
      );
      
      expect((controller as any).childProcesses.get('/repo1')).toBe(mockChildProcess);
      
      mockChildProcess.stdout!.emit('data', Buffer.from('Process output'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Process output'));
      
      mockChildProcess.stderr!.emit('data', Buffer.from('Process error'));
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Process error'));
      
      mockChildProcess.emit('close', 0);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('exited with code 0'));
      expect(mockResourceController.decrementParallelOperations).toHaveBeenCalled();
      expect((controller as any).childProcesses.has('/repo1')).toBe(false);
    });
    
    it('should not process repository if already being processed', () => {
      (controller as any).childProcesses = new Map([
        ['/repo1', {}]
      ]);
      
      const processRepository = (controller as any).processRepository.bind(controller);
      
      processRepository('/repo1');
      
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Repository already being processed'));
      expect(require('child_process').spawn).not.toHaveBeenCalled();
    });
    
    it('should handle process spawn errors', () => {
      require('child_process').spawn = jest.fn().mockImplementation(() => {
        throw new Error('Spawn error');
      });
      
      const processRepository = (controller as any).processRepository.bind(controller);
      
      processRepository('/repo1');
      
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to process repository'));
      expect(mockResourceController.decrementParallelOperations).toHaveBeenCalled();
    });
  });
  
  describe('getStatus', () => {
    it('should return status information', () => {
      (controller as any).childProcesses = new Map([
        ['/repo1', {}]
      ]);
      
      const status = controller.getStatus();
      
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('repositories');
      expect(status).toHaveProperty('concurrency');
      expect(status).toHaveProperty('pollingInterval');
      expect(status.repositories[0]).toHaveProperty('active', true);
    });
    
    it('should return empty status if repository manager not initialized', () => {
      (controller as any).repositoryManager = null;
      
      const status = controller.getStatus();
      
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('repositories');
      expect(status.repositories).toEqual([]);
    });
  });
});
