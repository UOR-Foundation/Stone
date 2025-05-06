# Schema Validation Workflow

This document describes how to use Stone to validate UOR content against Schema.org templates and OpenAPI specifications.

## Overview

The Stone schema validation workflow uses the existing OpenAPI validator from the UOR Content repository to validate content against schemas. It integrates the validator with Stone's role-based workflow system to provide automated validation and reporting.

## Components

- **OpenAPI Validator Tool**: Integrates the existing validator with Stone
- **QA Role**: Runs the validator and reports results
- **Validation Issue Template**: Standardized format for validation requests
- **Validation Script**: Helper script to trigger validation

## Usage

### Manual Validation

1. Create a new issue using the Schema Validation template
2. Fill in the required information (content directory, template directory, etc.)
3. Submit the issue with the `stone-process` and `schema-validation` labels
4. Stone will automatically process the issue and run the validator
5. The QA role will generate a validation report and add it as a comment on the issue

### Automated Validation

Run the validation script to automatically create an issue and trigger validation:

```bash
node scripts/validate-schemas.js
```

### Validation Results

- If all content is valid, the issue will be labeled with `schema-valid` and assigned to the Feature team
- If any content is invalid, the issue will be labeled with `schema-invalid` and assigned back to the PM team with instructions for fixing the issues

## Customization

The validation process can be customized by:

- Modifying the OpenAPI validator tool in `.github/stone/tools/openapi-validator.ts`
- Updating the QA role in `.github/stone/QA.CLAUDE.md`
- Adjusting the validation script in `scripts/validate-schemas.js`
