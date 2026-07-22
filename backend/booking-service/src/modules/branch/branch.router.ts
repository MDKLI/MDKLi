// Branch routes placeholder
import { Router } from "express";

const router = Router();
router.get("/", (req, res) =>
	res.json({
		message: "Branch routes - use /public/branches for public access",
	}),
);

export { router as branchRoutes };
