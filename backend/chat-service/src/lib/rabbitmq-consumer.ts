import * as amqp from "amqplib";
import { logger } from "../utils/logger";

class RabbitMQConsumer {
	private connection: any = null;
	private channel: any = null;
	private readonly url: string;
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 10;
	private handlers: Map<string, ((data: any) => Promise<void>)[]> = new Map();

	constructor() {
		const rabbitUser = process.env.RABBITMQ_USER || "admin";
		const rabbitPass = process.env.RABBITMQ_PASS || "admin";
		const rabbitHost = process.env.RABBITMQ_HOST || "rabbitmq";
		const rabbitPort = process.env.RABBITMQ_PORT || "5672";
		this.url =
			process.env.RABBITMQ_URL ||
			`amqp://${rabbitUser}:${rabbitPass}@${rabbitHost}:${rabbitPort}`;
	}

	async connect(): Promise<void> {
		try {
			logger.info(`Connecting to RabbitMQ at ${this.url}`);
			this.connection = await amqp.connect(this.url);
			this.channel = await this.connection.createChannel();

			await this.channel.assertExchange("auth.events", "topic", {
				durable: true,
			});

			await this.setupQueues();

			this.connection.on("close", () => {
				logger.warn("RabbitMQ connection closed, attempting to reconnect...");
				this.reconnect();
			});

			this.connection.on("error", (error: any) => {
				logger.error("RabbitMQ connection error:", error);
			});

			this.reconnectAttempts = 0;
			logger.info("✅ RabbitMQ consumer connected successfully");

			this.startConsuming();
		} catch (error) {
			logger.error("Failed to connect to RabbitMQ:", error);
			this.reconnect();
		}
	}

	private async setupQueues(): Promise<void> {
		if (!this.channel) return;

		// Own queue, separate from search-service-queue, so each service gets its own copy of every event
		const queue = await this.channel.assertQueue("chat-service-queue", {
			durable: true,
			arguments: {
				"x-message-ttl": 24 * 60 * 60 * 1000,
				"x-max-length": 100000,
			},
		});

		// chat-service only needs enough to keep its local User cache (name/photo/role/about) fresh.
		// No booking/branch/invitation-status events needed here.
		// NOTE: doctor.deleted / facility.deleted are intentionally NOT bound — their payload only
		// carries the auth-service profile id (Doctor.id / ClinicProfile.id), never user_id, so
		// there's no reliable way to map them to a cached User row. Same blind spot booking-service
		// already has. Worst case: a deleted account's stale name/photo lingers in chat's cache —
		// cosmetic, not functional (rooms and messages are keyed by user_id regardless).
		const routingKeys = [
			"user.created",
			"doctor.created",
			"doctor.updated",
			"facility.created",
			"facility.updated",
		];

		for (const routingKey of routingKeys) {
			await this.channel.bindQueue(queue.queue, "auth.events", routingKey);
		}

		logger.info(
			`chat-service queue bound to ${routingKeys.length} routing keys`,
		);
	}

	private async startConsuming(): Promise<void> {
		if (!this.channel) {
			logger.error("Cannot start consuming - channel not available");
			return;
		}

		await this.channel.consume("chat-service-queue", async (msg: any) => {
			if (!msg) return;

			try {
				const content = JSON.parse(msg.content.toString());
				const routingKey = msg.fields.routingKey;

				logger.info(`Received event: ${routingKey}`);

				const handlers = this.handlers.get(routingKey) || [];
				for (const handler of handlers) {
					try {
						await handler(content);
					} catch (error) {
						logger.error(`Handler error for ${routingKey}:`, error);
					}
				}

				this.channel?.ack(msg);
			} catch (error) {
				logger.error("Error processing message:", error);
				this.channel?.nack(msg, false, true);
			}
		});

		logger.info("Started consuming messages from queue");
	}

	private async reconnect(): Promise<void> {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			logger.error("Max RabbitMQ reconnection attempts reached");
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);

		logger.info(
			`Reconnecting to RabbitMQ in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
		);

		setTimeout(() => {
			this.connect().catch((error) => {
				logger.error("RabbitMQ reconnection failed:", error);
			});
		}, delay);
	}

	on(event: string, handler: (data: any) => Promise<void>): void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, []);
		}
		this.handlers.get(event)!.push(handler);
	}

	async close(): Promise<void> {
		try {
			if (this.channel) await this.channel.close();
			if (this.connection) await this.connection.close();
			logger.info("RabbitMQ consumer connection closed");
		} catch (error) {
			logger.error("Error closing RabbitMQ connection:", error);
		}
	}
}

export const rabbitMQConsumer = new RabbitMQConsumer();
