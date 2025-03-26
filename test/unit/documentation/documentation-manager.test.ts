import { DocumentationManager, DocSection } from '../../../src/documentation/documentation-manager';
import { ConfigLoader } from '../../../src/config/loader';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/config/loader');

describe('Documentation Manager', () => {
  let documentationManager: DocumentationManager;
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
        outputDir: './docs'
      }
    });
    
    documentationManager = new DocumentationManager(mockConfigLoader);
    
    // Mock fs functions
    (fs.existsSync as jest.Mock).mockReset();
    (fs.mkdirSync as jest.Mock).mockReset();
    (fs.writeFileSync as jest.Mock).mockReset();
    (fs.readFileSync as jest.Mock).mockReset();
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('generateDocumentation', () => {
    it('should generate documentation based on templates', async () => {
      // Mock the file system
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const sections: DocSection[] = [
        {
          title: 'Introduction',
          content: '# Introduction\n\nThis is the introduction to Stone.',
          filename: 'introduction.md'
        },
        {
          title: 'Getting Started',
          content: '# Getting Started\n\nHow to get started with Stone.',
          filename: 'getting-started.md'
        }
      ];
      
      await documentationManager.generateDocumentation(sections);
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(3); // 2 sections + index
    });
  });

  describe('generateQuickStartGuide', () => {
    it('should generate a quick start guide', async () => {
      // Mock template content
      documentationManager.getTemplate = jest.fn().mockReturnValue(
        '# Quick Start Guide\n\n## Installation\n{{installation}}\n\n## Configuration\n{{configuration}}\n\n## Usage\n{{usage}}'
      );
      
      const guide = await documentationManager.generateQuickStartGuide();
      
      expect(guide).toBeDefined();
      expect(guide).toContain('Quick Start Guide');
      expect(guide).toContain('Installation');
      expect(guide).toContain('Configuration');
      expect(guide).toContain('Usage');
    });
  });

  describe('generateAPIReference', () => {
    it('should generate API reference documentation', async () => {
      // Mock the file system for source files
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['file1.ts', 'file2.ts']);
      (fs.readFileSync as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('file1.ts')) {
          return '/**\n * Class description\n */\nexport class TestClass {\n  /**\n   * Method description\n   */\n  public testMethod() {}\n}';
        }
        return '';
      });
      
      const apiDocs = await documentationManager.generateAPIReference(['src/test']);
      
      expect(apiDocs).toBeDefined();
      expect(apiDocs.length).toBeGreaterThan(0);
      expect(apiDocs[0].content).toContain('TestClass');
      expect(apiDocs[0].content).toContain('Method description');
    });
  });

  describe('generateExampleProject', () => {
    it('should generate an example project', async () => {
      const exampleName = 'basic-usage';
      const exampleFiles = [
        {
          path: 'example/basic-usage/README.md',
          content: '# Basic Usage Example\n\nThis example shows basic Stone usage.'
        },
        {
          path: 'example/basic-usage/stone.config.json',
          content: '{\n  "repository": {\n    "owner": "example",\n    "name": "example-repo"\n  }\n}'
        }
      ];
      
      await documentationManager.generateExampleProject(exampleName, exampleFiles);
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(exampleFiles.length);
    });
  });

  describe('renderDocumentation', () => {
    it('should convert markdown documentation to HTML', () => {
      const markdown = '# Test Heading\n\nThis is a test paragraph.';
      
      const html = documentationManager.renderDocumentation(markdown);
      
      expect(html).toBeDefined();
      expect(html).toContain('<h1>Test Heading</h1>');
      expect(html).toContain('<p>This is a test paragraph.</p>');
    });
  });

  describe('generateTableOfContents', () => {
    it('should generate a table of contents for documentation files', async () => {
      const sections: DocSection[] = [
        {
          title: 'Introduction',
          content: '# Introduction\n\nThis is the introduction to Stone.',
          filename: 'introduction.md'
        },
        {
          title: 'Getting Started',
          content: '# Getting Started\n\nHow to get started with Stone.',
          filename: 'getting-started.md'
        }
      ];
      
      const toc = documentationManager.generateTableOfContents(sections);
      
      expect(toc).toBeDefined();
      expect(toc).toContain('Introduction');
      expect(toc).toContain('Getting Started');
      expect(toc).toContain('introduction.md');
      expect(toc).toContain('getting-started.md');
    });
  });
});