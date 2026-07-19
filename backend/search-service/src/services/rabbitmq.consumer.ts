import * as amqp from "amqplib";
import logger from "../utils/logger";

class RabbitMQConsumer {
	private connection: any = null;
	private channel: any = null;
	private readonly url: string;
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 10;
	private handlers: Map<string, ((data: any) => Promise<void>)[]> = new Map();

	constructor() {
		// Use RabbitMQ credentials from env or default to admin/admin
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

			// Assert exchanges
			await this.channel.assertExchange("auth.events", "topic", {
				durable: true,
			});

			// Create and bind queues
			await this.setupQueues();

			// Handle connection events
			this.connection.on("close", () => {
				logger.warn("RabbitMQ connection closed, attempting to reconnect...");
				this.reconnect();
			});

			this.connection.on("error", (error: any) => {
				logger.error("RabbitMQ connection error:", error);
			});

			this.reconnectAttempts = 0;
			logger.info("✅ RabbitMQ consumer connected successfully");

			// Start consuming
			this.startConsuming();
		} catch (error) {
			logger.error("Failed to connect to RabbitMQ:", error);
			this.reconnect();
		}
	}

	private async setupQueues(): Promise<void> {
		if (!this.channel) return;

		// Create queue for search service
		const queue = await this.channel.assertQueue("search-service-queue", {
			durable: true,
			arguments: {
				"x-message-ttl": 24 * 60 * 60 * 1000, // 24 hours TTL
				"x-max-length": 100000, // Max 100k messages
			},
		});

		// Bind to all relevant routing keys
		const routingKeys = [
			"doctor.created",
			"doctor.updated",
			"doctor.deleted",
			"facility.created",
			"facility.updated",
			"facility.deleted",
			"branch.created",
			"branch.updated",
			"branch.deleted",
			"invitation.accepted",
			"invitation.rejected",
			"user.blocked",
			"user.unblocked",
			"user.deleted",
		];
		for (const routingKey of routingKeys) {
			await this.channel.bindQueue(queue.queue, "auth.events", routingKey);
		}

		logger.info(`Queue bound to ${routingKeys.length} routing keys`);
	}

	private async startConsuming(): Promise<void> {
		if (!this.channel) {
			logger.error("Cannot start consuming - channel not available");
			return;
		}

		await this.channel.consume("search-service-queue", async (msg: any) => {
			if (!msg) return;

			try {
				const content = JSON.parse(msg.content.toString());
				const routingKey = msg.fields.routingKey;

				logger.info(`Received event: ${routingKey}`);

				// Call registered handlers
				const handlers = this.handlers.get(routingKey) || [];
				for (const handler of handlers) {
					try {
						await handler(content);
					} catch (error) {
						logger.error(`Handler error for ${routingKey}:`, error);
					}
				}

				// Acknowledge message
				this.channel?.ack(msg);
			} catch (error) {
				logger.error("Error processing message:", error);
				// Reject message and requeue
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
			if (this.channel) {
				await this.channel.close();
			}
			if (this.connection) {
				await this.connection.close();
			}
			logger.info("RabbitMQ consumer connection closed");
		} catch (error) {
			logger.error("Error closing RabbitMQ connection:", error);
		}
	}
}

export const rabbitMQConsumer = new RabbitMQConsumer();
