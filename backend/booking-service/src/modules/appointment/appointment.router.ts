// Appointment routes placeholder
import { Router } from "express";

const router = Router();
router.get("/", (req, res) =>
	res.json({
		message:
			"Appointment routes - use /public/appointments or /doctor/appointments",
	}),
);

export { router as appointmentRoutes };
