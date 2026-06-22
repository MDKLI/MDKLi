import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entity/User';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    await AppDataSource.initialize();
    const userRepo = AppDataSource.getRepository(User);
    
    // Check by username instead of role to avoid unique constraint errors
    const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const existing = await userRepo.findOne({ where: { username } });
    
    if (!existing) {
      const hashed = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || 'superadmin', 10);
      const superAdmin = userRepo.create({
        username: username,
        email: 'superadmin@example.com',
        passwordHash: hashed,
        role: UserRole.SUPER_ADMIN,
      });
      await userRepo.save(superAdmin);
      console.log('Super admin created');
    } else {
      console.log('Super admin already exists');
    }
  } catch (error: any) {
    console.log('Seed error (may be already seeded):', error?.message || error);
  }
  process.exit(0);
}
seed();
