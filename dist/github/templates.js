"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueTemplateGenerator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class IssueTemplateGenerator {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }
    /**
     * Create issue templates in the repository
     */
    async createIssueTemplates() {
        // Create feature template
        const featureTemplate = this.createFeatureTemplate();
        // Ensure directory exists
        const templateDir = path_1.default.join(process.cwd(), this.config.github.issueTemplateDirectory);
        if (!fs_1.default.existsSync(templateDir)) {
            fs_1.default.mkdirSync(templateDir, { recursive: true });
        }
        // Write template file
        const featureTemplatePath = path_1.default.join(templateDir, this.config.workflow.issueTemplate);
        fs_1.default.writeFileSync(featureTemplatePath, featureTemplate, 'utf8');
        // Push to GitHub if possible
        try {
            const content = Buffer.from(featureTemplate).toString('base64');
            const filePath = `${this.config.github.issueTemplateDirectory}/${this.config.workflow.issueTemplate}`;
            // Check if file already exists
            try {
                await this.client.getFileContent(filePath);
                // File exists, update it
                const { data: file } = await this.client.getFileContent(filePath);
                const sha = Array.isArray(file) ? undefined : file.sha;
                await this.client.octokit.rest.repos.createOrUpdateFileContents({
                    owner: this.config.repository.owner,
                    repo: this.config.repository.name,
                    path: filePath,
                    message: 'Update Stone feature issue template',
                    content: content,
                    sha: sha,
                });
            }
            catch (error) {
                // File doesn't exist, create it
                await this.client.octokit.rest.repos.createOrUpdateFileContents({
                    owner: this.config.repository.owner,
                    repo: this.config.repository.name,
                    path: filePath,
                    message: 'Create Stone feature issue template',
                    content: content,
                });
            }
        }
        catch (error) {
            // If pushing to GitHub fails, just continue
            // The template is still created locally
        }
    }
    /**
     * Create the feature issue template
     */
    createFeatureTemplate() {
        return `---
name: Stone Feature Request
about: Request a new feature using the Stone workflow
title: '[FEATURE] '
labels: ${this.config.workflow.stoneLabel}
assignees: ''
---

## Feature Description

<!-- Provide a clear and concise description of the feature you're requesting -->

## Acceptance Criteria

<!-- List the criteria that will indicate when this feature is complete -->

- [ ] 
- [ ] 
- [ ] 

## Technical Considerations

<!-- Any technical details or constraints that should be considered -->

## Additional Context

<!-- Add any other context, screenshots, or examples about the feature request here -->

`;
    }
}
exports.IssueTemplateGenerator = IssueTemplateGenerator;
