import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { verificationRouter } from "./modules/verification/verification.router";
import { logger } from "./utils/logger";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";

export const app = express();

app.use(helmet());
// Configure CORS from environment variable CORS_ALLOWED (comma-separated list).
// In production CORS_ALLOWED must be explicitly set and must NOT include '*'.
const _corsEnv = process.env.CORS_ALLOWED;
const _devDefaults = "http://localhost:5173,http://localhost:3000";
const _allowedOrigins = (
	_corsEnv || (process.env.NODE_ENV === "production" ? "" : _devDefaults)
)
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
if (process.env.NODE_ENV === "production") {
	if (!_corsEnv || _corsEnv.split(",").map((s) => s.trim()).some((o) => o === "*")) {
		logger.error(
			"CORS_ALLOWED is not set or includes '*'. In production this is insecure — please set CORS_ALLOWED to a comma-separated list of allowed origins.",
		);
		// Fallback to dev defaults to keep services running; strongly recommend setting CORS_ALLOWED in production.
		_allowedOrigins.push(..._devDefaults.split(",").map((s) => s.trim()).filter(Boolean));
	}
}
app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin) return callback(null, true); // allow server-to-server / curl requests
			if (_allowedOrigins.includes(origin)) return callback(null, true);
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	}),
);
app.use(compression());
app.use(express.json());
app.use(apiRateLimiter);

app.get("/health", (_req, res) => {
	res.json({ status: "ok", service: "admin-service" });
});

// Keep both singular/plural mounts for backward compatibility across clients/gateway configs.
app.use("/verification", verificationRouter);
app.use("/verifications", verificationRouter);
app.use("/admin/verification", verificationRouter);
app.use("/admin/verifications", verificationRouter);

app.use(
	(
		err: any,
		_req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) => {
		logger.error("Unhandled error:", err);
		res.status(500).json({ error: "Internal server error" });
	},
);
