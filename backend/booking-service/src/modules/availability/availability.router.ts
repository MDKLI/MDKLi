// Availability routes placeholder
import { Router } from "express";

const router = Router();
router.get("/", (req, res) =>
	res.json({ message: "Availability routes - use /public/branches/:id/slots" }),
);

export { router as availabilityRoutes };
