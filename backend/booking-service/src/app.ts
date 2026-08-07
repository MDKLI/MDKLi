import { PrismaClient } from "@prisma/client";
import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { rabbitMQClient } from "./lib/rabbitmq";
import { errorHandler } from "./middleware/errorHandler";
import { appointmentRoutes } from "./modules/appointment/appointment.router";
import { availabilityRoutes } from "./modules/availability/availability.router";
import { branchRoutes } from "./modules/branch/branch.router";
// Import routes
import { doctorRoutes } from "./modules/doctor/doctor.router";
import { paymentRoutes } from "./modules/payment/payment.router";
import { publicRoutes } from "./modules/public/public.router";
import { walletRoutes } from "./modules/wallet/wallet.router";
import { logger } from "./utils/logger";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";

// Load environment variables
dotenv.config();

// Initialize Prisma
export const prisma = new PrismaClient();

// Create Express app
const app = express();
app.set("trust proxy", 1);
// Security middleware
app.use(helmet());
// Configure CORS from CORS_ALLOWED env var (comma-separated list).
// In production CORS_ALLOWED must be explicitly set and must NOT include '*'.
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
			if (!origin) return callback(null, true);
			if (_allowedOrigins.includes(origin)) return callback(null, true);
			logger.warn(`CORS rejected origin: ${origin}`);
			return callback(null, false);
		},
		credentials: true,
	}),
);
app.use(compression());

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(apiRateLimiter);

// Request logging
app.use((req, res, next) => {
	logger.info(`${req.method} ${req.path}`);
	next();
});

// Health check
app.get("/health", (req, res) => {
	res.json({
		status: "ok",
		service: "booking-service",
		timestamp: new Date().toISOString(),
	});
});

// API Routes
app.use("/api/v1/doctor", doctorRoutes);
app.use("/api/v1/branches", branchRoutes);
app.use("/api/v1/availability", availabilityRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/wallet", walletRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
	res.status(404).json({ error: "Not found" });
});

// Start server
const PORT = process.env.PORT || 3004;

async function startServer() {
	try {
		// Connect to RabbitMQ
		await rabbitMQClient.connect();

		// Start HTTP server
		app.listen(PORT, () => {
			logger.info(`Booking service running on port ${PORT}`);
		});
	} catch (error) {
		logger.error("Failed to start server:", error);
		process.exit(1);
	}
}

// Graceful shutdown
process.on("SIGTERM", async () => {
	logger.info("SIGTERM received, shutting down gracefully");
	await rabbitMQClient.close();
	await prisma.$disconnect();
	process.exit(0);
});

process.on("SIGINT", async () => {
	logger.info("SIGINT received, shutting down gracefully");
	await rabbitMQClient.close();
	await prisma.$disconnect();
	process.exit(0);
});

startServer();
