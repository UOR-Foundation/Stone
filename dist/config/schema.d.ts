import Joi from 'joi';
export declare const configSchema: Joi.ObjectSchema<any>;
export interface StoneConfig {
    repository: {
        owner: string;
        name: string;
    };
    packages: Array<{
        name: string;
        path: string;
        team: string;
    }>;
    workflow: {
        issueTemplate: string;
        stoneLabel: string;
        useWebhooks: boolean;
        testCommand: string;
        timeoutMinutes: number;
    };
    github: {
        actionsDirectory: string;
        issueTemplateDirectory: string;
        stoneDirectory: string;
    };
    roles: {
        pm: {
            enabled: boolean;
            claudeFile: string;
        };
        qa: {
            enabled: boolean;
            claudeFile: string;
        };
        feature: {
            enabled: boolean;
            claudeFile: string;
        };
        auditor: {
            enabled: boolean;
            claudeFile: string;
        };
        actions: {
            enabled: boolean;
            claudeFile: string;
        };
    };
}
