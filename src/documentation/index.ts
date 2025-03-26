import { DocumentationManager, DocSection } from './documentation-manager';
import { QuickStartGuideGenerator, GuideSection } from './quick-start-guide';
import { ExampleProjectGenerator, ExampleProject, ExampleFile } from './example-project';

export {
  DocumentationManager,
  QuickStartGuideGenerator,
  ExampleProjectGenerator
};

export type {
  DocSection,
  GuideSection,
  ExampleProject,
  ExampleFile
};

// Define types
export interface ApiDocOptions {
  className: string;
  description: string;
  methods: string[];
}

export interface DocumentSection {
  title: string;
  content: string;
}

export interface PageTemplate {
  name: string;
  template: string;
}

export interface QuickStartOptions {
  includeExamples: boolean;
  outputFormat: 'md' | 'html';
}

export interface GeneratedSection {
  title: string;
  content: string;
}

export interface ExampleOptions {
  language: string;
  complexity: 'basic' | 'intermediate' | 'advanced';
}

export default {
  DocumentationManager,
  QuickStartGuideGenerator,
  ExampleProjectGenerator
};