const amqp = require("amqplib");

import { logger } from "../utils/logger";
import { prisma } from "./prisma";

const EXCHANGE_NAME = "auth.events";

export class AdminRabbitMQConsumer {
	private connection: any = null;
	private channel: any = null;

	async connect(): Promise<void> {
		const rabbitmqUrl =
			process.env.RABBITMQ_URL || "amqp://admin:admin@rabbitmq:5672";
		this.connection = await amqp.connect(rabbitmqUrl);
		this.channel = await this.connection.createChannel();
		await this.channel.assertExchange(EXCHANGE_NAME, "topic", {
			durable: true,
		});

		const queue = await this.channel.assertQueue("admin-service-events", {
			durable: true,
		});
		await this.channel.bindQueue(queue.queue, EXCHANGE_NAME, "user.*");
		await this.channel.bindQueue(queue.queue, EXCHANGE_NAME, "doctor.*");
		await this.channel.bindQueue(queue.queue, EXCHANGE_NAME, "facility.*");
		await this.channel.bindQueue(queue.queue, EXCHANGE_NAME, "appointment.*");

		await this.channel.consume(queue.queue, this.handleMessage.bind(this));
		logger.info("admin-service RabbitMQ consumer connected");
	}

	private async handleMessage(msg: any): Promise<void> {
		if (!msg) return;
		try {
			const content = JSON.parse(msg.content.toString());
			const routingKey = msg.fields.routingKey;
			logger.info(`Received event: ${routingKey}`);

			switch (routingKey) {
				case "user.created":
				case "user.updated":
					await this.syncUser(content);
					break;
				case "doctor.created":
				case "doctor.updated":
					await this.syncDoctor(content);
					break;
				case "facility.created":
				case "facility.updated":
					await this.syncFacility(content);
					break;
				case "appointment.created":
				case "appointment.status_changed":
					await this.syncAppointment(content);
					break;
				default:
					logger.debug(`Unhandled routing key: ${routingKey}`);
			}
			this.channel?.ack(msg);
		} catch (error) {
			logger.error("Error handling message:", error);
			this.channel?.nack(msg, false, false);
		}
	}

	private async syncUser(data: any) {
		const { id, username, email, role, is_suspended, blocked_at, deleted_at } =
			data;
		if (!id) return;
		await prisma.user.upsert({
			where: { id },
			update: {
				username: username ?? undefined,
				email: email ?? undefined,
				role: role ?? undefined,
				isSuspended: is_suspended ?? undefined,
				blockedAt: blocked_at
					? new Date(blocked_at)
					: blocked_at === null
						? null
						: undefined,
				deletedAt: deleted_at
					? new Date(deleted_at)
					: deleted_at === null
						? null
						: undefined,
			},
			create: {
				id,
				username: username || null,
				email: email || null,
				role: role || "patient",
				isSuspended: is_suspended || false,
				blockedAt: blocked_at ? new Date(blocked_at) : null,
				deletedAt: deleted_at ? new Date(deleted_at) : null,
			},
		});
	}

	private async syncDoctor(data: any) {
		const {
			id,
			user_id,
			full_name,
			specialty,
			photo_url,
			verification_status,
		} = data;
		if (!id) return;
		await prisma.doctorVerification.upsert({
			where: { id },
			update: {
				fullName: full_name ?? undefined,
				specialty: specialty ?? undefined,
				photoUrl: photo_url ?? undefined,
				verificationStatus: verification_status ?? undefined,
			},
			create: {
				id,
				userId: user_id,
				fullName: full_name || null,
				specialty: specialty || null,
				photoUrl: photo_url || null,
				verificationStatus: verification_status || "pending",
			},
		});
	}

	private async syncFacility(data: any) {
		const { id, user_id, facility_type, name, photo_url, status } = data;
		if (!id) return;
		await prisma.facilityVerification.upsert({
			where: { id },
			update: {
				name: name ?? undefined,
				photoUrl: photo_url ?? undefined,
				status: status ?? undefined,
			},
			create: {
				id,
				userId: user_id,
				facilityType: facility_type || "clinic",
				name: name || null,
				photoUrl: photo_url || null,
				status: status || "pending",
			},
		});
	}

	private async syncAppointment(data: any) {
		const { id, doctorId, branchId, patientId, status, date, consultationFee } =
			data;
		if (!id) return;
		await prisma.appointmentSummary.upsert({
			where: { id },
			update: {
				status: status ?? undefined,
				consultationFee: consultationFee ?? undefined,
			},
			create: {
				id,
				doctorId,
				branchId,
				patientId,
				status: status || "PENDING",
				consultationFee: consultationFee ?? null,
				date: new Date(date),
			},
		});
	}

	async close(): Promise<void> {
		try {
			await this.channel?.close();
		} catch {}
		try {
			await this.connection?.close();
		} catch {}
	}
}

export const adminRabbitMQConsumer = new AdminRabbitMQConsumer();
