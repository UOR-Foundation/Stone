"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.configSchema = joi_1.default.object({
    repository: joi_1.default.object({
        owner: joi_1.default.string().required(),
        name: joi_1.default.string().required(),
    }).required(),
    packages: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().required(),
        path: joi_1.default.string().required(),
        team: joi_1.default.string().required(),
    })).required(),
    workflow: joi_1.default.object({
        issueTemplate: joi_1.default.string().default('stone-feature.md'),
        stoneLabel: joi_1.default.string().default('stone-process'),
        useWebhooks: joi_1.default.boolean().default(true),
        testCommand: joi_1.default.string().default('npm test'),
        timeoutMinutes: joi_1.default.number().default(30),
    }).default(),
    github: joi_1.default.object({
        actionsDirectory: joi_1.default.string().default('.github/workflows'),
        issueTemplateDirectory: joi_1.default.string().default('.github/ISSUE_TEMPLATE'),
        stoneDirectory: joi_1.default.string().default('.github/stone'),
    }).default(),
    roles: joi_1.default.object({
        pm: joi_1.default.object({
            enabled: joi_1.default.boolean().default(true),
            claudeFile: joi_1.default.string().default('PM.CLAUDE.md'),
        }).default(),
        qa: joi_1.default.object({
            enabled: joi_1.default.boolean().default(true),
            claudeFile: joi_1.default.string().default('QA.CLAUDE.md'),
        }).default(),
        feature: joi_1.default.object({
            enabled: joi_1.default.boolean().default(true),
            claudeFile: joi_1.default.string().default('FEATURE.CLAUDE.md'),
        }).default(),
        auditor: joi_1.default.object({
            enabled: joi_1.default.boolean().default(true),
            claudeFile: joi_1.default.string().default('AUDITOR.CLAUDE.md'),
        }).default(),
        actions: joi_1.default.object({
            enabled: joi_1.default.boolean().default(true),
            claudeFile: joi_1.default.string().default('ACTIONS.CLAUDE.md'),
        }).default(),
    }).default(),
}).required();
