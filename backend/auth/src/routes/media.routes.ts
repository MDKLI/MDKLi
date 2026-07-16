import { Router } from "express";
import {
	deleteBranchMedia,
	uploadBranchMedia,
	uploadMiddleware,
	uploadProfilePicture,
} from "../controllers/media.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Upload profile picture (doctors and facilities only)
router.post(
	"/profile-picture",
	authMiddleware,
	uploadMiddleware,
	uploadProfilePicture,
);

// Upload branch media
router.post(
	"/branch/:branchId",
	authMiddleware,
	uploadMiddleware,
	uploadBranchMedia,
);

// Delete branch media
router.delete("/branch", authMiddleware, deleteBranchMedia);

export default router;
