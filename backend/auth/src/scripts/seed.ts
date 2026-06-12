import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entity/User';
import bcrypt from 'bcryptjs';

async function seed() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: { role: UserRole.SUPER_ADMIN } });
  if (!existing) {
    const hashed = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || 'superadmin', 10);
    const superAdmin = userRepo.create({
      username: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
      email: 'superadmin@example.com',
      passwordHash: hashed,
      role: UserRole.SUPER_ADMIN,
    });
    await userRepo.save(superAdmin);
    console.log('Super admin created');
  } else {
    console.log('Super admin already exists');
  }
  process.exit(0);
}
seed();
