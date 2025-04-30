import { Command } from 'commander';
import { LoggerService } from '../../services/logger-service';
import { RBAC } from '../../security/rbac';
import { ConfigLoader } from '../../config/loader';
import { StoneConfig } from '../../config/schema';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const logger = new LoggerService();

/**
 * RBAC command for Stone CLI
 */
export const rbacCommand = new Command('rbac')
  .description('Role-Based Access Control commands')
  .addCommand(
    new Command('check')
      .description('Check if a role has permission to access resources')
      .option('-r, --role <role>', 'Role name to check')
      .option('-f, --files <files...>', 'File paths to check')
      .option('-d, --diff', 'Check permissions on git diff', false)
      .option('-b, --branch <branch>', 'Branch to compare with (for diff mode)')
      .action(async (options) => {
        try {
          const configLoader = new ConfigLoader();
          const config = await configLoader.load();
          
          if (!config) {
            logger.error('Failed to load configuration');
            process.exit(1);
          }
          
          const rbac = new RBAC(logger);
          
          const defaultRoles = {
            developer: {
              files: {
                read: ['**/*.ts', '**/*.js', '**/*.json', '!**/secrets/**'],
                write: ['src/**/*.ts', 'src/**/*.js', '!src/security/**', '!**/secrets/**']
              },
              github: {
                issues: ['read', 'comment'],
                pullRequests: ['read', 'create', 'comment'],
                branches: ['create']
              },
              workflow: {
                execute: ['build', 'test']
              }
            },
            security: {
              files: {
                read: ['**/*.ts', '**/*.js', '**/*.json'],
                write: ['src/security/**/*.ts', 'src/security/**/*.js']
              },
              github: {
                issues: ['read', 'comment', 'close'],
                pullRequests: ['read', 'review', 'comment'],
                branches: ['create']
              },
              workflow: {
                execute: ['security-scan', 'test']
              }
            }
          };
          
          if (!config.rbac || !config.rbac.roles) {
            logger.warn('No RBAC configuration found in stone.config.json, using default roles');
            rbac.loadConfig({ roles: defaultRoles });
          } else {
            rbac.loadConfig({ roles: config.rbac.roles });
          }
          
          if (!options.role) {
            logger.error('No role specified');
            process.exit(1);
          }
          
          if (!rbac.hasRole(options.role)) {
            logger.error(`Role not found: ${options.role}`);
            process.exit(1);
          }
          
          let filesToCheck: string[] = [];
          
          if (options.diff) {
            const { execSync } = require('child_process');
            const branch = options.branch || 'main';
            
            try {
              const diffOutput = execSync(`git diff --name-only ${branch}`).toString();
              filesToCheck = diffOutput.split('\n').filter(Boolean);
              
              if (filesToCheck.length === 0) {
                logger.info('No files changed in diff');
                process.exit(0);
              }
              
              logger.info(`Checking permissions for ${filesToCheck.length} files in diff`);
            } catch (error) {
              logger.error(`Failed to get git diff: ${error instanceof Error ? error.message : String(error)}`);
              process.exit(1);
            }
          } else if (options.files && options.files.length > 0) {
            filesToCheck = options.files;
          } else {
            logger.error('No files specified. Use --files or --diff option');
            process.exit(1);
          }
          
          const result = rbac.checkDiffPermissions(options.role, filesToCheck);
          
          if (result.denied.length === 0) {
            logger.info(`✅ Role '${options.role}' has permission to modify all ${result.allowed.length} files`);
            process.exit(0);
          } else {
            logger.error(`❌ Role '${options.role}' does not have permission to modify ${result.denied.length} files:`);
            result.denied.forEach(file => {
              logger.error(`  - ${file}`);
            });
            
            if (result.allowed.length > 0) {
              logger.info(`✅ Role '${options.role}' has permission to modify ${result.allowed.length} files`);
            }
            
            process.exit(1);
          }
        } catch (error) {
          logger.error(`RBAC check failed: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all roles and their permissions')
      .action(async () => {
        try {
          const configLoader = new ConfigLoader();
          const config = await configLoader.load();
          
          if (!config) {
            logger.error('Failed to load configuration');
            process.exit(1);
          }
          
          const rbac = new RBAC(logger);
          
          const defaultRoles = {
            developer: {
              files: {
                read: ['**/*.ts', '**/*.js', '**/*.json', '!**/secrets/**'],
                write: ['src/**/*.ts', 'src/**/*.js', '!src/security/**', '!**/secrets/**']
              },
              github: {
                issues: ['read', 'comment'],
                pullRequests: ['read', 'create', 'comment'],
                branches: ['create']
              },
              workflow: {
                execute: ['build', 'test']
              }
            },
            security: {
              files: {
                read: ['**/*.ts', '**/*.js', '**/*.json'],
                write: ['src/security/**/*.ts', 'src/security/**/*.js']
              },
              github: {
                issues: ['read', 'comment', 'close'],
                pullRequests: ['read', 'review', 'comment'],
                branches: ['create']
              },
              workflow: {
                execute: ['security-scan', 'test']
              }
            }
          };
          
          if (!config.rbac || !config.rbac.roles) {
            logger.warn('No RBAC configuration found in stone.config.json, using default roles');
            rbac.loadConfig({ roles: defaultRoles });
          } else {
            rbac.loadConfig({ roles: config.rbac.roles });
          }
          
          const roleNames = rbac.getRoleNames();
          
          if (roleNames.length === 0) {
            logger.info('No roles defined');
            process.exit(0);
          }
          
          logger.info(`Found ${roleNames.length} roles:`);
          
          for (const roleName of roleNames) {
            const permissions = rbac.getEffectivePermissions(roleName);
            
            if (!permissions) {
              continue;
            }
            
            logger.info(`\nRole: ${roleName}`);
            
            logger.info('  File permissions:');
            logger.info(`    Read: ${permissions.files.read.join(', ') || 'none'}`);
            logger.info(`    Write: ${permissions.files.write.join(', ') || 'none'}`);
            
            logger.info('  GitHub permissions:');
            Object.entries(permissions.github).forEach(([type, ops]) => {
              logger.info(`    ${type}: ${ops.join(', ') || 'none'}`);
            });
            
            logger.info('  Workflow permissions:');
            logger.info(`    Execute: ${permissions.workflow.execute.join(', ') || 'none'}`);
          }
        } catch (error) {
          logger.error(`RBAC list failed: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      })
  );
