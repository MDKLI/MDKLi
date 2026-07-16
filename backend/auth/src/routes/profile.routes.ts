import { Router } from "express";
import {
	deleteAccount,
	deleteBranch,
	getMyProfile,
	updateMyProfile,
} from "../controllers/profile.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { profileValidation } from "../middleware/profile.validator";

const router = Router();

router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, profileValidation, updateMyProfile);
router.delete("/me", authMiddleware, deleteAccount);
router.delete("/branches/:branchId", authMiddleware, deleteBranch);

export default router;
