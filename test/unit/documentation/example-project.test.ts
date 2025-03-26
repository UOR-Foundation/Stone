import { ExampleProjectGenerator, ExampleFile, ExampleProject } from '../../../src/documentation/example-project';
import { ConfigLoader } from '../../../src/config/loader';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/config/loader');

describe('Example Project Generator', () => {
  let exampleGenerator: ExampleProjectGenerator;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;

  beforeEach(() => {
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>;
    
    // Mock config
    mockConfigLoader.getConfig = jest.fn().mockResolvedValue({
      repository: {
        owner: 'test-owner',
        name: 'test-repo'
      },
      documentation: {
        examplesDir: './examples'
      }
    });
    
    exampleGenerator = new ExampleProjectGenerator(mockConfigLoader);
    
    // Mock fs functions
    (fs.existsSync as jest.Mock).mockReset();
    (fs.mkdirSync as jest.Mock).mockReset();
    (fs.writeFileSync as jest.Mock).mockReset();
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (path.dirname as jest.Mock).mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
  });

  describe('generateBasicExample', () => {
    it('should generate a basic example project', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await exampleGenerator.generateBasicExample();
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(expect.any(Number));
      
      // Check if stone.config.json is created
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('stone.config.json'),
        expect.stringContaining('"repository"'),
        'utf8'
      );
      
      // Check if README.md is created
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        expect.stringContaining('Basic Example'),
        'utf8'
      );
    });
  });

  describe('generateAdvancedExample', () => {
    it('should generate an advanced example project', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await exampleGenerator.generateAdvancedExample();
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(expect.any(Number));
      
      // Check if stone.config.json is created with advanced options
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('stone.config.json'),
        expect.stringContaining('"customization"'),
        'utf8'
      );
    });
  });

  describe('generateCustomRoleExample', () => {
    it('should generate a custom role example project', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await exampleGenerator.generateCustomRoleExample();
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(expect.any(Number));
      
      // Check if custom role file is created
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('custom-role.js'),
        expect.stringContaining('CustomRole'),
        'utf8'
      );
    });
  });

  describe('createExampleProject', () => {
    it('should create an example project from a project definition', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const project: ExampleProject = {
        name: 'test-example',
        description: 'A test example project',
        files: [
          {
            path: 'README.md',
            content: '# Test Example\n\nThis is a test example.'
          },
          {
            path: 'stone.config.json',
            content: '{\n  "repository": {\n    "owner": "example",\n    "name": "example-repo"\n  }\n}'
          }
        ]
      };
      
      await exampleGenerator.createExampleProject(project);
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(project.files.length);
    });
  });

  describe('generateIndex', () => {
    it('should generate an index file for all examples', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['basic-example', 'advanced-example']);
      (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
      (fs.readFileSync as jest.Mock).mockImplementation((path) => {
        if (path.includes('README.md')) {
          return '# Example\n\nExample description.';
        }
        return '';
      });
      
      await exampleGenerator.generateIndex();
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('index.md'),
        expect.stringContaining('Examples'),
        'utf8'
      );
    });
  });
});