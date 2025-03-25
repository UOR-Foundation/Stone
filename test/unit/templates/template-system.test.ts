import { TemplateSystem, Template, TemplateVariable } from '../../../src/templates/template-system';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('Template System', () => {
  let templateSystem: TemplateSystem;

  beforeEach(() => {
    (fs.readFileSync as jest.Mock).mockReset();
    (fs.existsSync as jest.Mock).mockReset();
    (fs.writeFileSync as jest.Mock).mockReset();
    templateSystem = new TemplateSystem();
  });

  describe('loadTemplate', () => {
    it('should load a template from file', () => {
      const templateContent = `
        name: Test Template
        description: A test template
        variables:
          - name: title
            description: The title of the issue
            required: true
          - name: body
            description: The body of the issue
            required: true
        content: |
          # {{title}}
          
          {{body}}
      `;
      
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);
      
      const template = templateSystem.loadTemplate('test-template.yml');
      
      expect(template).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.variables).toHaveLength(2);
      expect(template.variables[0].name).toBe('title');
    });

    it('should throw error if template file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      expect(() => templateSystem.loadTemplate('non-existent.yml')).toThrow();
    });
  });

  describe('registerTemplate', () => {
    it('should register a template', () => {
      const template: Template = {
        id: 'issue-template',
        name: 'Issue Template',
        description: 'A template for issues',
        variables: [
          { name: 'title', description: 'The title of the issue', required: true },
          { name: 'body', description: 'The body of the issue', required: true }
        ],
        content: '# {{title}}\n\n{{body}}',
        parent: null
      };
      
      templateSystem.registerTemplate(template);
      
      expect(templateSystem.getTemplate('issue-template')).toBe(template);
    });

    it('should throw error when registering template with duplicate ID', () => {
      const template: Template = {
        id: 'issue-template',
        name: 'Issue Template',
        description: 'A template for issues',
        variables: [],
        content: 'Test content',
        parent: null
      };
      
      templateSystem.registerTemplate(template);
      
      expect(() => templateSystem.registerTemplate(template)).toThrow();
    });
  });

  describe('renderTemplate', () => {
    it('should render a template with provided variables', () => {
      const template: Template = {
        id: 'issue-template',
        name: 'Issue Template',
        description: 'A template for issues',
        variables: [
          { name: 'title', description: 'The title of the issue', required: true },
          { name: 'body', description: 'The body of the issue', required: true }
        ],
        content: '# {{title}}\n\n{{body}}',
        parent: null
      };
      
      templateSystem.registerTemplate(template);
      
      const variables = {
        title: 'Test Issue',
        body: 'This is a test issue.'
      };
      
      const rendered = templateSystem.renderTemplate('issue-template', variables);
      
      expect(rendered).toBe('# Test Issue\n\nThis is a test issue.');
    });

    it('should throw error when required variables are missing', () => {
      const template: Template = {
        id: 'issue-template',
        name: 'Issue Template',
        description: 'A template for issues',
        variables: [
          { name: 'title', description: 'The title of the issue', required: true },
          { name: 'body', description: 'The body of the issue', required: true }
        ],
        content: '# {{title}}\n\n{{body}}',
        parent: null
      };
      
      templateSystem.registerTemplate(template);
      
      const variables = {
        title: 'Test Issue'
        // missing body
      };
      
      expect(() => templateSystem.renderTemplate('issue-template', variables)).toThrow();
    });
  });

  describe('template inheritance', () => {
    it('should extend parent template content', () => {
      const parentTemplate: Template = {
        id: 'base-template',
        name: 'Base Template',
        description: 'A base template',
        variables: [
          { name: 'header', description: 'The header', required: true }
        ],
        content: '{{header}}\n\n{{content}}',
        parent: null
      };
      
      const childTemplate: Template = {
        id: 'child-template',
        name: 'Child Template',
        description: 'A child template',
        variables: [
          { name: 'body', description: 'The body', required: true }
        ],
        content: '{{body}}',
        parent: 'base-template'
      };
      
      templateSystem.registerTemplate(parentTemplate);
      templateSystem.registerTemplate(childTemplate);
      
      const variables = {
        header: 'Test Header',
        body: 'Test Body'
      };
      
      const rendered = templateSystem.renderTemplate('child-template', variables);
      
      expect(rendered).toBe('Test Header\n\nTest Body');
    });
  });

  describe('validateTemplate', () => {
    it('should validate a correct template', () => {
      const template: Template = {
        id: 'valid-template',
        name: 'Valid Template',
        description: 'A valid template',
        variables: [
          { name: 'var1', description: 'Variable 1', required: true }
        ],
        content: '{{var1}}',
        parent: null
      };
      
      expect(templateSystem.validateTemplate(template)).toBe(true);
    });

    it('should return false for an invalid template with undefined variables', () => {
      const template: Template = {
        id: 'invalid-template',
        name: 'Invalid Template',
        description: 'An invalid template',
        variables: [
          { name: 'var1', description: 'Variable 1', required: true }
        ],
        content: '{{var1}} {{var2}}', // var2 is not defined
        parent: null
      };
      
      expect(templateSystem.validateTemplate(template)).toBe(false);
    });
  });

  describe('saveTemplate', () => {
    it('should save a template to file', () => {
      const template: Template = {
        id: 'save-template',
        name: 'Save Template',
        description: 'A template to save',
        variables: [
          { name: 'var1', description: 'Variable 1', required: true }
        ],
        content: '{{var1}}',
        parent: null
      };
      
      (path.join as jest.Mock).mockReturnValue('/path/to/templates/save-template.yml');
      
      templateSystem.saveTemplate(template, '/path/to/templates');
      
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});