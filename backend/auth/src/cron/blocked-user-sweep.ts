import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import { publishUserUpdated } from '../services/event-publisher.service';
import logger from '../utility/logger';

const BLOCK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function sweepBlockedUsers(): Promise<void> {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const cutoff = new Date(Date.now() - BLOCK_WINDOW_MS);

    const expired = await userRepo
      .createQueryBuilder('user')
      .where('user.is_suspended = true')
      .andWhere('user.blocked_at IS NOT NULL')
      .andWhere('user.blocked_at <= :cutoff', { cutoff })
      .andWhere('user.deleted_at IS NULL')
      .getMany();

    if (expired.length === 0) return;

    logger.info(`Blocked-user sweep: soft-deleting ${expired.length} user(s) past 24h window`);

    for (const user of expired) {
      user.deleted_at = new Date();
      await userRepo.save(user);
      await publishUserUpdated(user.id);
    }
  } catch (error) {
    logger.error('Blocked-user sweep failed:', error);
  }
}

export function startBlockedUserSweep(): void {
  const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // check every 15 minutes
  setInterval(() => {
    sweepBlockedUsers();
  }, SWEEP_INTERVAL_MS);
  logger.info('Blocked-user sweep scheduled (every 15 minutes)');
}
