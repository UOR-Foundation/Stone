import { Command } from 'commander';
import { Controller } from '../../scalability/controller';
import { LoggerService } from '../../services/logger-service';
import path from 'path';

/**
 * Command for managing multiple Stone repositories
 */
export function createControllerCommand(): Command {
  const controller = new Command('controller')
    .description('Manage multiple Stone repositories')
    .option('-c, --config <path>', 'Path to parent configuration file', 'mono.stone.json')
    .action(async (options) => {
      const logger = new LoggerService();
      
      try {
        const configPath = path.isAbsolute(options.config)
          ? options.config
          : path.join(process.cwd(), options.config);
        
        logger.info(`Using parent config: ${configPath}`);
        
        const controllerInstance = new Controller(configPath);
        
        process.on('SIGINT', () => {
          logger.info('Received SIGINT, stopping controller');
          controllerInstance.stop();
          process.exit(0);
        });
        
        process.on('SIGTERM', () => {
          logger.info('Received SIGTERM, stopping controller');
          controllerInstance.stop();
          process.exit(0);
        });
        
        await controllerInstance.start();
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`Controller error: ${error.message}`);
        }
        process.exit(1);
      }
    });
  
  return controller;
}
