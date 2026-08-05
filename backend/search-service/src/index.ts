import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import "reflect-metadata";

import { initializeIndexes } from "./config/meilisearch";
import { AppDataSource } from "./data-source";
import searchRoutes from "./routes/search.routes";
import syncRoutes from "./routes/sync.routes";
import * as eventHandlers from "./services/event-handlers.service";
import { rabbitMQConsumer } from "./services/rabbitmq.consumer";
import logger from "./utils/logger";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
// Configure CORS using CORS_ALLOWED environment variable (comma-separated list).
// In production CORS_ALLOWED must be explicitly set and must not include '*'.
const _corsEnv = process.env.CORS_ALLOWED;
const _devDefaults = "http://localhost:5173,http://localhost:3000,http://localhost";
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
			// Allow non-browser requests (e.g., server-to-server, curl) and known dev origins.
			if (!origin) return callback(null, true);
			if (_allowedOrigins.includes(origin)) return callback(null, true);
			// Instead of passing an Error which leads to a 500 with no CORS headers,
			// signal CORS rejection by passing `false`. The cors middleware will
			// then respond with a proper 403 and include no Access-Control-Allow-* headers.
			return callback(null, false);
		},
		credentials: true,
	}),
);
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
	res.json({ status: "ok", service: "search-service" });
});

// Routes
app.use("/api", searchRoutes);
app.use("/api/sync", syncRoutes);

// Error handling
app.use(
	(
		err: any,
		req: express.Request,
		res: express.Response,
		next: express.NextFunction,
	) => {
		logger.error("Unhandled error:", err);
		res.status(500).json({ error: "Internal server error" });
	},
);

// Retry helper: Postgres can still refuse a connection for a brief window
// even after the entrypoint's TCP check passes (e.g. it accepts the socket
// then closes it while finishing its own startup). Retry a few times before
// giving up, instead of exiting on the very first failure.
async function initializeDataSourceWithRetry(
	maxAttempts = 10,
	delayMs = 3000,
) {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await AppDataSource.initialize();
			return;
		} catch (error) {
			if (attempt === maxAttempts) throw error;
			logger.warn(
				`Database connection attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`,
			);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
}

// Initialize database and start server
const startServer = async () => {
	try {
		// Initialize TypeORM
		await initializeDataSourceWithRetry();
		logger.info("✅ Database connected successfully");

		// Initialize Meilisearch
		await initializeIndexes();
		logger.info("✅ Meilisearch initialized");

		// Initialize RabbitMQ consumer
		await rabbitMQConsumer.connect();
		logger.info("✅ RabbitMQ consumer initialized");

		// Register event handlers
		rabbitMQConsumer.on("doctor.created", eventHandlers.handleDoctorCreated);
		rabbitMQConsumer.on("doctor.updated", eventHandlers.handleDoctorUpdated);
		rabbitMQConsumer.on("doctor.deleted", eventHandlers.handleDoctorDeleted);
		rabbitMQConsumer.on(
			"facility.created",
			eventHandlers.handleFacilityCreated,
		);
		rabbitMQConsumer.on(
			"facility.updated",
			eventHandlers.handleFacilityUpdated,
		);
		rabbitMQConsumer.on(
			"facility.deleted",
			eventHandlers.handleFacilityDeleted,
		);
		rabbitMQConsumer.on("branch.created", eventHandlers.handleBranchCreated);
		rabbitMQConsumer.on("branch.updated", eventHandlers.handleBranchUpdated);
		rabbitMQConsumer.on("branch.deleted", eventHandlers.handleBranchDeleted);
		rabbitMQConsumer.on(
			"invitation.accepted",
			eventHandlers.handleInvitationAccepted,
		);
		rabbitMQConsumer.on(
			"invitation.rejected",
			eventHandlers.handleInvitationRejected,
		);
		rabbitMQConsumer.on("user.blocked", eventHandlers.handleUserBlocked);
		rabbitMQConsumer.on("user.unblocked", eventHandlers.handleUserUnblocked);
		rabbitMQConsumer.on("user.deleted", eventHandlers.handleUserDeleted);
		logger.info("✅ Event handlers registered");

		// Start server
		app.listen(PORT, () => {
			logger.info(`🚀 Search service running on port ${PORT}`);
		});
	} catch (error) {
		logger.error("Failed to start server:", error);
		process.exit(1);
	}
};

startServer();
