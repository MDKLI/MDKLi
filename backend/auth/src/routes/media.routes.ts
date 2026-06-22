import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { 
  uploadMiddleware, 
  uploadProfilePicture, 
  uploadBranchMedia,
  deleteBranchMedia 
} from '../controllers/media.controller';

const router = Router();

// Upload profile picture (doctors and facilities only)
router.post('/profile-picture', authMiddleware, uploadMiddleware, uploadProfilePicture);

// Upload branch media
router.post('/branch/:branchId', authMiddleware, uploadMiddleware, uploadBranchMedia);

// Delete branch media
router.delete('/branch', authMiddleware, deleteBranchMedia);

export default router;
