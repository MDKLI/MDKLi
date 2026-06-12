import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UserRole } from '../entity/User';
import { getUserProfile, updateUserProfile } from '../controllers/admin.controller';

const router = Router();

// Apply auth middleware first
router.use(authMiddleware);
// Then role middleware
router.use(requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));

router.get('/users/:userId/profile', getUserProfile);
router.put('/users/:userId/profile', updateUserProfile);

export default router;
