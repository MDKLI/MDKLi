import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getMyProfile, updateMyProfile, deleteAccount, deleteBranch } from '../controllers/profile.controller';
import { profileValidation } from '../middleware/profile.validator';

const router = Router();

router.get('/me', authMiddleware, getMyProfile);
router.put('/me', authMiddleware, profileValidation, updateMyProfile);
router.delete('/me', authMiddleware, deleteAccount);
router.delete('/branches/:branchId', authMiddleware, deleteBranch);

export default router;
