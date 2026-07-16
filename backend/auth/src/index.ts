import axios from "axios";
import cors from "cors";
import express from "express";
import { AppDataSource } from "./data-source";
import requestLogger from "./middleware/logger.middleware";
import { matricsEndpoint, matricsMiddleware } from "./monitor/metrics";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import invitationRoutes from "./routes/invitation.routes";
import mediaRoutes from "./routes/media.routes";
import profileRoutes from "./routes/profile.routes";
import { publishAllData } from "./services/event-publisher.service";
import { rabbitMQService } from "./services/rabbitmq.service";
import logger from "./utility/logger";

const app = express();
const PORT = process.env.PORT || 3000;
const BOOKING_SERVICE_URL =
	process.env.BOOKING_SERVICE_URL || "http://booking-service:3004";

// Enable CORS for all origins (configure properly for production)
app.use(
	cors({
		origin: "*",
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(requestLogger);

app.use(matricsMiddleware);

app.get("/health", (_req, res) => {
	logger.info("/health accessed");
	res.send("Auth Microservice is running");
});

// Simple proxy for booking service
// Maps /api/booking/* to booking-service:3004/api/v1/*
app.use("/api/booking", async (req: express.Request, res: express.Response) => {
	try {
		const targetPath = req.url || "/";
		// Map /api/booking/public/* to /api/v1/public/*
		// Map /api/booking/doctor/* to /api/v1/doctor/*
		const url = `${BOOKING_SERVICE_URL}/api/v1${targetPath}`;
		logger.info(
			`Proxying to booking service: ${req.method} ${req.originalUrl} -> ${url}`,
		);

		const response = await axios({
			method: req.method as any,
			url: url,
			data: req.body,
			headers: {
				...req.headers,
				host: "booking-service:3004",
			},
			validateStatus: () => true, // Don't throw on error status codes
		});

		res.status(response.status).json(response.data);
	} catch (error) {
		logger.error("Booking service proxy error:", error);
		res.status(503).json({ error: "Booking service unavailable" });
	}
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/invitations", invitationRoutes);

app.get("/metrics", matricsEndpoint);

// Initialize RabbitMQ
rabbitMQService.connect().catch((err) => {
	logger.error("Error during RabbitMQ initialization:", err);
});

AppDataSource.initialize()
	.then(async () => {
		logger.info("Data Source has been initialized!");

		// Wait for RabbitMQ to be ready then publish all data for resync
		setTimeout(async () => {
			try {
				await publishAllData();
			} catch (err) {
				logger.error("Startup resync failed:", err);
			}
		}, 3000); // 3s delay to ensure RabbitMQ connection is established

		app.listen(PORT, () => {
			logger.info(`Auth Microservice is running on port ${PORT}`);
		});
	})
	.catch((err) => {
		logger.error("Error during Data Source initialization:", err);
	});
