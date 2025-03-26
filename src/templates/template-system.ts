import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Interface defining a template variable
 */
export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Interface defining a template
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  variables: TemplateVariable[];
  content: string;
  parent: string | null;
}

/**
 * Class for managing templates
 */
export class TemplateSystem {
  private templates: Map<string, Template> = new Map();

  /**
   * Loads a template from a file
   */
  loadTemplate(filePath: string): Template {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Template file not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const templateData = yaml.load(content) as any;
      
      const template: Template = {
        id: path.basename(filePath, path.extname(filePath)),
        name: templateData.name,
        description: templateData.description,
        variables: templateData.variables || [],
        content: templateData.content,
        parent: templateData.parent || null
      };
      
      this.registerTemplate(template);
      return template;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load template from ${filePath}: ${errorMessage}`);
    }
  }

  /**
   * Registers a template
   */
  registerTemplate(template: Template): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template with ID "${template.id}" is already registered`);
    }

    this.templates.set(template.id, template);
  }

  /**
   * Gets a template by ID
   */
  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Renders a template with provided variables
   */
  renderTemplate(id: string, variables: Record<string, any>): string {
    const template = this.getTemplate(id);
    if (!template) {
      throw new Error(`Template "${id}" not found`);
    }

    // Check required variables
    for (const variable of template.variables) {
      if (variable.required && !variables.hasOwnProperty(variable.name)) {
        throw new Error(`Required variable "${variable.name}" is missing`);
      }
    }

    // Apply template inheritance
    let content = template.content;
    if (template.parent) {
      const parentTemplate = this.getTemplate(template.parent);
      if (!parentTemplate) {
        throw new Error(`Parent template "${template.parent}" not found`);
      }

      // Replace {{content}} in parent template with child content
      const parentVariables = { ...variables, content: template.content };
      return this.renderTemplate(template.parent, parentVariables);
    }

    // Replace variables
    let renderedContent = content;
    
    // If using content from a child template in a parent template with {{content}}
    if (variables.content) {
      renderedContent = renderedContent.replace(/\{\{content\}\}/g, variables.content);
    }
    
    return this.replaceVariables(renderedContent, variables);
  }

  /**
   * Replaces variables in template content
   */
  private replaceVariables(content: string, variables: Record<string, any>): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const name = varName.trim();
      if (variables.hasOwnProperty(name)) {
        return variables[name];
      }
      return match; // Keep original if variable not found
    });
  }

  /**
   * Validates a template
   */
  validateTemplate(template: Template): boolean {
    // Basic structure validation
    if (!template.id || !template.name || !template.content) {
      return false;
    }

    // Check that all used variables are defined
    const variableMatches = template.content.match(/\{\{([^}]+)\}\}/g) || [];
    const definedVariables = new Set(template.variables.map(v => v.name));
    definedVariables.add('content'); // Special variable for inheritance

    for (const match of variableMatches) {
      const varName = match.substring(2, match.length - 2).trim();
      if (!definedVariables.has(varName)) {
        return false; // Undefined variable
      }
    }

    // Check parent template exists if specified
    if (template.parent && !this.templates.has(template.parent)) {
      return false;
    }

    return true;
  }

  /**
   * Saves a template to a file
   */
  saveTemplate(template: Template, directory: string): void {
    const templateData = {
      name: template.name,
      description: template.description,
      variables: template.variables,
      content: template.content,
      parent: template.parent
    };

    const filePath = path.join(directory, `${template.id}.yml`);
    const content = yaml.dump(templateData);

    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * Gets all registered templates
   */
  getAllTemplates(): Template[] {
    return Array.from(this.templates.values());
  }
}

/**
 * Export necessary components
 */
export default {
  TemplateSystem
};