import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "http";
import { rabbitMQConsumer } from "./lib/rabbitmq-consumer";
import { mediaRouter } from "./modules/media/media.router";
import { roomsRouter } from "./modules/rooms/rooms.router";
import {
	handleDoctorEvent,
	handleFacilityEvent,
	handleUserCreated,
} from "./services/event-handlers.service";
import { MediaService } from "./services/media.service";
import { initSocketServer } from "./sockets/chat.socket";
import { logger } from "./utils/logger";

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

app.get("/health", (_req, res) => {
	res.json({ status: "ok", service: "chat-service" });
});

app.use("/rooms", roomsRouter);
app.use("/media", mediaRouter);

// Wire RabbitMQ events -> local User cache
rabbitMQConsumer.on("user.created", handleUserCreated);
rabbitMQConsumer.on("doctor.created", handleDoctorEvent);
rabbitMQConsumer.on("doctor.updated", handleDoctorEvent);
rabbitMQConsumer.on("facility.created", handleFacilityEvent);
rabbitMQConsumer.on("facility.updated", handleFacilityEvent);

const PORT = process.env.PORT || 3005;

async function start() {
	await MediaService.initializeBucket();
	await rabbitMQConsumer.connect();
	initSocketServer(server);

	server.listen(PORT, () => {
		logger.info(`chat-service listening on port ${PORT}`);
	});
}

start().catch((error) => {
	logger.error("Failed to start chat-service:", error);
	process.exit(1);
});
