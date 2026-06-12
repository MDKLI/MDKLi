import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getMyProfile, updateMyProfile } from '../controllers/profile.controller';
import { profileValidation } from '../middleware/profile.validator';

const router = Router();

router.get('/me', authMiddleware, getMyProfile);
router.put('/me', authMiddleware, profileValidation, updateMyProfile);

export default router;
