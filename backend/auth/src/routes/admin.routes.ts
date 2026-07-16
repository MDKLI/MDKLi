import { Router } from "express";
import {
	blockUser,
	getUserProfile,
	rejectDoctor,
	rejectFacility,
	unblockUser,
	updateUserProfile,
	verifyDoctor,
	verifyFacility,
} from "../controllers/admin.controller";
import { UserRole } from "../entity/User";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// Apply auth middleware first
router.use(authMiddleware);
// Then role middleware
router.use(requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));

router.get("/users/:userId/profile", getUserProfile);
router.put("/users/:userId/profile", updateUserProfile);
router.patch("/doctors/:doctorId/verify", verifyDoctor);
router.patch("/doctors/:doctorId/reject", rejectDoctor);
router.patch("/facilities/:facilityId/verify", verifyFacility);
router.patch("/facilities/:facilityId/reject", rejectFacility);

router.patch("/users/:userId/block", blockUser);
router.patch("/users/:userId/unblock", unblockUser);
export default router;
