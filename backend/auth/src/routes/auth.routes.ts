import { Router } from "express";
import { body } from "express-validator";
import {
	changePassword,
	loginUser,
	registerUser,
	setupTOTP,
	verifyOTPForTOTP,
} from "../controllers/auth.controller";
import {
	checkPendingRegistration,
	completeRegistration,
	startRegistration,
} from "../controllers/registration.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Old registration (kept for backward compatibility)
router.post(
	"/register",
	[
		body("username").isString().notEmpty(),
		body("email").isEmail(),
		body("password").isLength({ min: 6 }),
		body("role").isIn(["patient", "clinic_admin", "doctor", "pharmacy_admin"]),
		body("profileData").isObject(),
	],
	registerUser,
);

// New delayed registration endpoints
router.post(
	"/register/start",
	[
		body("username").isString().notEmpty(),
		body("email").isEmail(),
		body("password").isLength({ min: 8 }),
		body("role").isIn(["patient", "clinic_admin", "doctor", "pharmacy_admin"]),
		body("profileData").isObject(),
	],
	startRegistration,
);

router.post(
	"/register/complete",
	[
		body("pendingToken").isString().notEmpty(),
		body("onboardingData").isObject(),
	],
	completeRegistration,
);

router.get("/register/pending/:pendingToken", checkPendingRegistration);

router.post(
	"/login",
	[
		body("username").isString().notEmpty(),
		body("password").isString().notEmpty(),
		body("otp").optional().isString(),
	],
	loginUser,
);

router.post("/2fa/setup/:userId", setupTOTP);
router.post(
	"/2fa/verify/:userId",
	[body("token").isString()],
	verifyOTPForTOTP,
);
router.post(
	"/change-password",
	authMiddleware,
	[body("oldPassword").isString(), body("newPassword").isLength({ min: 6 })],
	changePassword,
);

export default router;
