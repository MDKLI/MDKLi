import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { publishAllData } from '../services/event-publisher.service';
import logger from '../utility/logger';

async function main() {
  try {
    await AppDataSource.initialize();
    logger.info('Database connected. Starting admin resync...');
    await publishAllData();
    logger.info('✅ Resync finished successfully. Check admin-service logs.');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Resync failed:', error);
    process.exit(1);
  }
}
main();
