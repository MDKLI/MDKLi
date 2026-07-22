import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { verificationRouter } from "./modules/verification/verification.router";
import { logger } from "./utils/logger";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

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
