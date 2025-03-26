import { DocumentationManager, DocSection } from './documentation-manager';
import { QuickStartGuideGenerator, GuideSection } from './quick-start-guide';
import { ExampleProjectGenerator, ExampleProject, ExampleFile } from './example-project';

export {
  DocumentationManager,
  DocSection,
  QuickStartGuideGenerator,
  GuideSection,
  ExampleProjectGenerator,
  ExampleProject,
  ExampleFile
};

// Re-export types
export type { ApiDocOptions } from './documentation-manager';
export type { DocumentSection } from './documentation-manager';
export type { PageTemplate } from './documentation-manager';

export type { QuickStartOptions } from './quick-start-guide';
export type { GeneratedSection } from './quick-start-guide';

export type { ExampleOptions } from './example-project';

export default {
  DocumentationManager,
  QuickStartGuideGenerator,
  ExampleProjectGenerator
};