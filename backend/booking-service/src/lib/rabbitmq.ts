// eslint-disable-next-line @typescript-eslint/no-var-requires
const amqp = require("amqplib");

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

export class RabbitMQClient {
	private connection: any = null;
	private channel: any = null;
	private readonly EXCHANGE_NAME = "auth.events";

	async connect(): Promise<void> {
		try {
			const rabbitmqUrl =
				process.env.RABBITMQ_URL || "amqp://admin:admin@localhost:5672";
			this.connection = await amqp.connect(rabbitmqUrl);
			this.channel = await this.connection.createChannel();

			// Create exchange
			await this.channel.assertExchange(this.EXCHANGE_NAME, "topic", {
				durable: true,
			});

			// Create queues
			await this.setupQueues();

			logger.info("RabbitMQ connected");
		} catch (error) {
			logger.error("Failed to connect to RabbitMQ:", error);
			throw error;
		}
	}

	private async setupQueues(): Promise<void> {
		if (!this.channel) return;

		// Queue for booking service to receive events
		const queue = await this.channel.assertQueue("booking-service-events", {
			durable: true,
		});

		// Bind to routing keys
		await this.channel.bindQueue(queue.queue, this.EXCHANGE_NAME, "user.*");
		await this.channel.bindQueue(queue.queue, this.EXCHANGE_NAME, "doctor.*");
		await this.channel.bindQueue(queue.queue, this.EXCHANGE_NAME, "branch.*");
		await this.channel.bindQueue(queue.queue, this.EXCHANGE_NAME, "profile.*");
		await this.channel.bindQueue(
			queue.queue,
			this.EXCHANGE_NAME,
			"doctor_branch.*",
		);

		// Start consuming
		await this.channel.consume(queue.queue, this.handleMessage.bind(this));
	}

	private async handleMessage(msg: any): Promise<void> {
		if (!msg) return;

		try {
			const content = JSON.parse(msg.content.toString());
			const routingKey = msg.fields.routingKey;

			logger.info(`Received RabbitMQ event: ${routingKey}`, {
				userId: content.id,
			});

			switch (routingKey) {
				case "user.created":
				case "user.updated":
					await this.handleUserEvent(content);
					break;
				case "doctor.created":
				case "doctor.updated":
					await this.handleDoctorEvent(content);
					break;
				case "doctor.profile-updated":
					await this.handleDoctorProfileUpdate(content);
					break;
				case "branch.created":
				case "branch.updated":
					await this.handleBranchEvent(content);
					break;
				case "branch.deleted":
					await this.handleBranchDeleted(content);
					break;
				case "doctor_branch.assigned":
					await this.handleDoctorBranchAssigned(content);
					break;
				case "doctor_branch.removed":
					await this.handleDoctorBranchRemoved(content);
					break;
				default:
					logger.debug(`Unhandled routing key: ${routingKey}`);
			}

			this.channel?.ack(msg);
		} catch (error) {
			logger.error("Error handling RabbitMQ message:", error);
			this.channel?.nack(msg, false, false);
		}
	}

	private async handleUserEvent(data: any): Promise<void> {
		try {
			const { id, role, email, full_name } = data;

			if (role === "patient") {
				await prisma.patient.upsert({
					where: { userId: id },
					update: {
						email: email || "",
						name: full_name || email || "Unknown",
					},
					create: {
						userId: id,
						email: email || "",
						name: full_name || email || "Unknown",
					},
				});
				logger.info(`Synced patient: ${id}`);
			}
		} catch (error) {
			logger.error("Error syncing user:", error);
		}
	}

	private async handleDoctorEvent(data: any): Promise<void> {
		try {
			const { id, user_id, full_name, specialty, description, photo_url } =
				data;

			await prisma.doctor.upsert({
				where: { userId: user_id },
				update: {
					name: full_name || "Unknown Doctor",
					specialization: specialty || null,
					bio: description || null,
					avatarUrl: photo_url || null,
					isActive: true,
				},
				create: {
					userId: user_id,
					name: full_name || "Unknown Doctor",
					specialization: specialty || null,
					bio: description || null,
					avatarUrl: photo_url || null,
					isActive: true,
				},
			});

			logger.info(`Synced doctor: ${id}`);
		} catch (error) {
			logger.error("Error syncing doctor:", error);
		}
	}

	private async handleDoctorProfileUpdate(data: any): Promise<void> {
		try {
			const {
				userId,
				fullName,
				specialty,
				title,
				bio,
				photoUrl,
				hasPrivatePractice,
			} = data;

			await prisma.doctor.upsert({
				where: { userId },
				update: {
					name: fullName || undefined,
					specialization: specialty || undefined,
					bio: bio || undefined,
					avatarUrl: photoUrl || undefined,
					isActive: true,
				},
				create: {
					userId,
					name: fullName || "Unknown Doctor",
					specialization: specialty || null,
					bio: bio || null,
					avatarUrl: photoUrl || null,
					isActive: true,
				},
			});

			logger.info(`Updated doctor profile: ${userId}`);
		} catch (error) {
			logger.error("Error updating doctor profile:", error);
		}
	}

	private async handleBranchEvent(data: any): Promise<void> {
		try {
			// Handle both snake_case from auth service and camelCase
			const {
				id,
				doctorId,
				userId,
				user_id,
				name,
				address,
				city,
				area,
				phoneNumbers,
				phone_numbers,
				consultationFee,
				consultation_fee,
				media_urls,
				isVirtual,
			} = data;

			// Get the user ID from various possible field names
			const authUserId = doctorId || userId || user_id;

			if (!authUserId) {
				logger.error(`No user ID found for branch ${id}`);
				return;
			}

			// A branch's owner may be a private-practice doctor OR a facility.
			// Only set Branch.doctorId when the owner is actually a doctor; otherwise
			// this is a facility branch, and per-doctor access is tracked via BranchAssignment.
			const doctor = await prisma.doctor.findFirst({
				where: { userId: authUserId },
			});

			await prisma.branch.upsert({
				where: { id },
				update: {
					name: name || "Unknown Branch",
					address: address || null,
					city: city || null,
					area: area || null,
					phoneNumbers: phone_numbers || [],
					consultationFee: consultation_fee ? parseInt(consultation_fee) : null,
					mediaUrls: media_urls || [],
					isVirtual: isVirtual || false,
					isActive: true,
					...(doctor ? { doctorId: doctor.id } : { ownerUserId: authUserId }),
				},
				create: {
					id,
					doctorId: doctor?.id || null,
					ownerUserId: doctor ? null : authUserId,
					name: name || "Unknown Branch",
					address: address || null,
					city: city || null,
					area: area || null,
					phoneNumbers: phone_numbers || [],
					consultationFee: consultation_fee ? parseInt(consultation_fee) : null,
					mediaUrls: media_urls || [],
					isVirtual: isVirtual || false,
					isActive: true,
					timezone: "UTC",
				},
			});
			logger.info(
				`Synced branch: ${id} (owner: ${doctor ? `doctor ${doctor.id}` : `facility user ${authUserId}`})`,
			);
		} catch (error) {
			logger.error("Error syncing branch:", error);
		}
	}

	private async handleBranchDeleted(data: any): Promise<void> {
		try {
			const { id } = data;

			await prisma.branch.update({
				where: { id },
				data: { isActive: false },
			});

			logger.info(`Deactivated branch: ${id}`);
		} catch (error) {
			logger.error("Error deactivating branch:", error);
		}
	}

	// Doctor accepted a facility invitation for a branch
	private async handleDoctorBranchAssigned(data: any): Promise<void> {
		try {
			const { doctorUserId, branchId, consultationFee } = data;

			const doctor = await prisma.doctor.findFirst({
				where: { userId: doctorUserId },
			});
			const branch = await prisma.branch.findUnique({
				where: { id: branchId },
			});

			if (!doctor) {
				logger.warn(
					`doctor_branch.assigned: doctor not found for userId ${doctorUserId} (branch ${branchId})`,
				);
				return;
			}
			if (!branch) {
				logger.warn(`doctor_branch.assigned: branch ${branchId} not found`);
				return;
			}

			await prisma.branchAssignment.upsert({
				where: { branchId_doctorId: { branchId, doctorId: doctor.id } },
				update: {
					consultationFee: consultationFee ?? null,
					isActive: true,
				},
				create: {
					branchId,
					doctorId: doctor.id,
					consultationFee: consultationFee ?? null,
					isActive: true,
				},
			});

			logger.info(`Assigned doctor ${doctor.id} to branch ${branchId}`);
		} catch (error) {
			logger.error("Error handling doctor_branch.assigned:", error);
		}
	}

	// Doctor kicked or left a facility branch
	private async handleDoctorBranchRemoved(data: any): Promise<void> {
		try {
			const { doctorUserId, branchId } = data;

			const doctor = await prisma.doctor.findFirst({
				where: { userId: doctorUserId },
			});
			if (!doctor) {
				logger.warn(
					`doctor_branch.removed: doctor not found for userId ${doctorUserId}`,
				);
				return;
			}

			await prisma.branchAssignment.updateMany({
				where: { branchId, doctorId: doctor.id },
				data: { isActive: false },
			});

			logger.info(`Removed doctor ${doctor.id} from branch ${branchId}`);
		} catch (error) {
			logger.error("Error handling doctor_branch.removed:", error);
		}
	}

	async publishEvent(routingKey: string, data: any): Promise<void> {
		if (!this.channel) {
			logger.error("Cannot publish event: RabbitMQ not connected");
			return;
		}

		try {
			const message = Buffer.from(JSON.stringify(data));
			this.channel.publish(this.EXCHANGE_NAME, routingKey, message);
			logger.debug(`Published event: ${routingKey}`);
		} catch (error) {
			logger.error("Error publishing event:", error);
		}
	}

	async close(): Promise<void> {
		try {
			if (this.channel) {
				await this.channel.close();
			}
		} catch (e) {
			// Channel may already be closed
		}
		try {
			if (this.connection) {
				await (this.connection as any).close();
			}
		} catch (e) {
			// Connection may already be closed
		}
		logger.info("RabbitMQ connection closed");
	}
}

export const rabbitMQClient = new RabbitMQClient();
