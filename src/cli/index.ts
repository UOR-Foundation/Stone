#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { processCommand } from './commands/process';
import { statusCommand } from './commands/status';
import { runCommand } from './commands/run';
import { resetCommand } from './commands/reset';
import { actionsCommand } from './commands/actions';
import { Logger } from '../utils/logger';

const logger = new Logger();

// Create the CLI program
const program = new Command();

program
  .name('stone')
  .description('Stone - A software factory for GitHub-based development')
  .version('0.1.0');

// Register commands
initCommand(program);
processCommand(program);
statusCommand(program);
runCommand(program);
resetCommand(program);
actionsCommand(program);

// Handle errors
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error) {
  if (error instanceof Error) {
    logger.error(error.message);
    process.exit(1);
  }
}