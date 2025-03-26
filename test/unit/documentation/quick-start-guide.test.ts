import { QuickStartGuideGenerator, GuideSection } from '../../../src/documentation/quick-start-guide';
import { ConfigLoader } from '../../../src/config/loader';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/config/loader');

describe('Quick Start Guide Generator', () => {
  let guideGenerator: QuickStartGuideGenerator;
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
    
    guideGenerator = new QuickStartGuideGenerator(mockConfigLoader);
    
    // Mock fs functions
    (fs.existsSync as jest.Mock).mockReset();
    (fs.mkdirSync as jest.Mock).mockReset();
    (fs.writeFileSync as jest.Mock).mockReset();
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('generateGuide', () => {
    it('should generate a quick start guide with all sections', async () => {
      const sections: GuideSection[] = [
        {
          title: 'Installation',
          content: 'npm install @uor-foundation/stone -g',
          code: 'npm install @uor-foundation/stone -g'
        },
        {
          title: 'Configuration',
          content: 'Create a stone.config.json file',
          code: '{\n  "repository": {\n    "owner": "example",\n    "name": "example-repo"\n  }\n}'
        },
        {
          title: 'Usage',
          content: 'Run the stone command',
          code: 'stone init'
        }
      ];
      
      const guide = guideGenerator.generateGuide(sections);
      
      expect(guide).toBeDefined();
      expect(guide).toContain('# Quick Start Guide');
      expect(guide).toContain('## Installation');
      expect(guide).toContain('npm install @uor-foundation/stone -g');
      expect(guide).toContain('## Configuration');
      expect(guide).toContain('## Usage');
    });
  });

  describe('saveGuide', () => {
    it('should save the guide to the specified location', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const guide = '# Quick Start Guide\n\nThis is a quick start guide.';
      
      await guideGenerator.saveGuide(guide, 'quick-start.md');
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('quick-start.md'),
        guide,
        'utf8'
      );
    });
  });

  describe('generateInstallationSection', () => {
    it('should generate the installation section', () => {
      const section = guideGenerator.generateInstallationSection();
      
      expect(section).toBeDefined();
      expect(section.title).toBe('Installation');
      expect(section.content).toContain('Install Stone');
      expect(section.code).toContain('npm install');
    });
  });

  describe('generateConfigurationSection', () => {
    it('should generate the configuration section', () => {
      const section = guideGenerator.generateConfigurationSection();
      
      expect(section).toBeDefined();
      expect(section.title).toBe('Configuration');
      expect(section.content).toContain('stone.config.json');
      expect(section.code).toContain('"repository"');
    });
  });

  describe('generateUsageSection', () => {
    it('should generate the usage section', () => {
      const section = guideGenerator.generateUsageSection();
      
      expect(section).toBeDefined();
      expect(section.title).toBe('Usage');
      expect(section.content).toContain('Initialize Stone');
      expect(section.code).toContain('stone');
    });
  });

  describe('generateWorkflowSection', () => {
    it('should generate the workflow section', () => {
      const section = guideGenerator.generateWorkflowSection();
      
      expect(section).toBeDefined();
      expect(section.title).toBe('Workflow');
      expect(section.content).toContain('issues');
      expect(section.code).toContain('stone');
    });
  });

  describe('generateTroubleshootingSection', () => {
    it('should generate the troubleshooting section', () => {
      const section = guideGenerator.generateTroubleshootingSection();
      
      expect(section).toBeDefined();
      expect(section.title).toBe('Troubleshooting');
      expect(section.content).toContain('issues');
    });
  });
});