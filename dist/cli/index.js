#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const init_1 = require("./commands/init");
const process_1 = require("./commands/process");
const status_1 = require("./commands/status");
const run_1 = require("./commands/run");
const reset_1 = require("./commands/reset");
const logger_1 = require("../utils/logger");
const logger = new logger_1.Logger();
// Create the CLI program
const program = new commander_1.Command();
program
    .name('stone')
    .description('Stone - A software factory for GitHub-based development')
    .version('0.1.0');
// Register commands
(0, init_1.initCommand)(program);
(0, process_1.processCommand)(program);
(0, status_1.statusCommand)(program);
(0, run_1.runCommand)(program);
(0, reset_1.resetCommand)(program);
// Handle errors
program.exitOverride();
try {
    program.parse(process.argv);
}
catch (error) {
    if (error instanceof Error) {
        logger.error(error.message);
        process.exit(1);
    }
}
