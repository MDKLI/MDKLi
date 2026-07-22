import { Router } from "express";
import { prisma } from "../../app";
import { rabbitMQClient } from "../../lib/rabbitmq";
import { paymobService } from "../../services/paymob.service";
import { walletService } from "../../services/wallet.service";
import { logger } from "../../utils/logger";

const router = Router();

// GET /api/v1/payment/status/:appointmentId - frontend polls this after redirect back
router.get("/status/:appointmentId", async (req, res, next) => {
	try {
		const appointment = await prisma.appointment.findUnique({
			where: { id: req.params.appointmentId },
			include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
		});
		if (!appointment) {
			res.status(404).json({ error: "Appointment not found" });
			return;
		}
		res.json({
			success: true,
			data: {
				status: appointment.status,
				payment: appointment.payments[0] || null,
			},
		});
	} catch (error) {
		next(error);
	}
});

// POST /api/v1/payment/webhook - Paymob transaction processed callback (sandbox + live)
router.post("/webhook", async (req, res, next) => {
	try {
		const receivedHmac = req.query.hmac as string;
		const obj = req.body?.obj;

		if (!obj || !receivedHmac) {
			res.status(400).json({ error: "Malformed webhook payload" });
			return;
		}

		const valid = paymobService.verifyHmac(obj, receivedHmac);
		if (!valid) {
			logger.error("Paymob webhook HMAC verification failed");
			res.status(401).json({ error: "Invalid signature" });
			return;
		}

		const paymobOrderId = String(obj.order?.id ?? obj.order);
		const success = obj.success === true || obj.success === "true";

		const transaction = await prisma.paymentTransaction.findFirst({
			where: { paymobOrderId },
			orderBy: { createdAt: "desc" },
		});

		if (!transaction) {
			logger.error(
				`Webhook received for unknown paymob order ${paymobOrderId}`,
			);
			res.status(404).json({ error: "Transaction not found" });
			return;
		}

		await prisma.paymentTransaction.update({
			where: { id: transaction.id },
			data: { status: success ? "SUCCESS" : "FAILED", rawPayload: obj },
		});

		const appointment = await prisma.appointment.update({
			where: { id: transaction.appointmentId },
			data: { status: success ? "PENDING" : "PAYMENT_FAILED" },
			include: { branch: true, doctor: true },
		});

		if (success) {
			const recipientUserId =
				appointment.branch.ownerUserId || appointment.doctor.userId;
			await walletService.creditForAppointment(
				recipientUserId,
				transaction.amount,
				appointment.id,
			);

			rabbitMQClient
				.publishEvent("appointment.created", {
					id: appointment.id,
					doctorId: appointment.doctorId,
					branchId: appointment.branchId,
					patientId: appointment.patientId,
					status: appointment.status,
					date: appointment.date,
					consultationFee: appointment.branch.consultationFee ?? null,
				})
				.catch((err) =>
					logger.error("Failed to publish appointment.created:", err),
				);
		} else {
			rabbitMQClient
				.publishEvent("appointment.status_changed", {
					id: appointment.id,
					doctorId: appointment.doctorId,
					branchId: appointment.branchId,
					patientId: appointment.patientId,
					status: appointment.status,
					date: appointment.date,
				})
				.catch((err) =>
					logger.error("Failed to publish appointment.status_changed:", err),
				);
		}

		res.status(200).json({ success: true });
	} catch (error) {
		next(error);
	}
});

// POST /api/v1/payment/fake-confirm/:appointmentId - MVP demo only: mimics a payment
// gateway confirming payment. Accepts any card fields (ignored, no validation) and
// credits the business wallet exactly like the real Paymob webhook would.
router.post("/fake-confirm/:appointmentId", async (req, res, next) => {
	try {
		const { appointmentId } = req.params;

		const transaction = await prisma.paymentTransaction.findFirst({
			where: { appointmentId },
			orderBy: { createdAt: "desc" },
		});

		if (!transaction) {
			res.status(404).json({ error: "Transaction not found" });
			return;
		}

		if (transaction.status === "SUCCESS") {
			res.json({ success: true, data: { alreadyConfirmed: true } });
			return;
		}

		await prisma.paymentTransaction.update({
			where: { id: transaction.id },
			data: {
				status: "SUCCESS",
				rawPayload: { fake: true, confirmedAt: new Date().toISOString() },
			},
		});

		const appointment = await prisma.appointment.update({
			where: { id: transaction.appointmentId },
			data: { status: "PENDING" },
			include: { branch: true, doctor: true },
		});

		const recipientUserId =
			appointment.branch.ownerUserId || appointment.doctor.userId;
		await walletService.creditForAppointment(
			recipientUserId,
			transaction.amount,
			appointment.id,
		);

		rabbitMQClient
			.publishEvent("appointment.created", {
				id: appointment.id,
				doctorId: appointment.doctorId,
				branchId: appointment.branchId,
				patientId: appointment.patientId,
				status: appointment.status,
				date: appointment.date,
				consultationFee: appointment.branch.consultationFee ?? null,
			})
			.catch((err) =>
				logger.error("Failed to publish appointment.created:", err),
			);

		res.json({ success: true, data: { status: appointment.status } });
	} catch (error) {
		next(error);
	}
});

export { router as paymentRoutes };
