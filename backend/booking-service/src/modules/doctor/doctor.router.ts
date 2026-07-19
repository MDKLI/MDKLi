import { Router } from "express";
import { prisma } from "../../app";
import { rabbitMQClient } from "../../lib/rabbitmq";
import { logger } from "../../utils/logger";

const router = Router();

const requireDoctor = (req: any, res: any, next: any) => {
	next();
};

function noticePeriodToHours(period: string): number {
	const map: Record<string, number> = {
		none: 0,
		"1_hour": 1,
		"2_hours": 2,
		"4_hours": 4,
		"8_hours": 8,
		"12_hours": 12,
		"24_hours": 24,
		"48_hours": 48,
		"72_hours": 72,
	};
	return map[period] ?? 24;
}

function hoursToNoticePeriod(hours?: number): string {
	if (!hours || hours === 0) return "none";
	const map: Record<number, string> = {
		1: "1_hour",
		2: "2_hours",
		4: "4_hours",
		8: "8_hours",
		12: "12_hours",
		24: "24_hours",
		48: "48_hours",
		72: "72_hours",
	};
	return map[hours] || "24_hours";
}

// Helper: resolve any ID (bookingdb doctor.id or auth user_id) → bookingdb doctor.id
async function resolveDocitorId(rawId: string): Promise<string | null> {
	const doctor = await prisma.doctor.findFirst({
		where: { OR: [{ id: rawId }, { userId: rawId }] },
	});
	return doctor?.id || null;
}

async function resolveBranchAccess(branchId: string, doctorId: string) {
	const branch = await prisma.branch.findUnique({ where: { id: branchId } });
	if (!branch) return { error: "Branch not found" as const };

	if (branch.doctorId === doctorId) {
		return {
			branch,
			doctorId,
			scopeDoctorId: null as string | null,
			mode: "owner" as const,
		};
	}

	const assignment = await prisma.branchAssignment.findFirst({
		where: { branchId, doctorId, isActive: true },
	});
	if (assignment) {
		return {
			branch,
			doctorId,
			scopeDoctorId: doctorId,
			mode: "assigned" as const,
		};
	}

	return { error: "This doctor is not assigned to this branch" as const };
}

async function findScheduleOverlap(
	doctorId: string,
	excludeBranchId: string,
	newRules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
): Promise<string | null> {
	const [ownedBranches, assignments] = await Promise.all([
		prisma.branch.findMany({
			where: { doctorId, isActive: true },
			select: { id: true, name: true },
		}),
		prisma.branchAssignment.findMany({
			where: { doctorId, isActive: true },
			include: { branch: { select: { id: true, name: true, isActive: true } } },
		}),
	]);

	const otherBranches = [
		...ownedBranches.map((b) => ({
			id: b.id,
			name: b.name,
			scopeDoctorId: null as string | null,
		})),
		...assignments
			.filter((a) => a.branch && a.branch.isActive)
			.map((a) => ({
				id: a.branch.id,
				name: a.branch.name,
				scopeDoctorId: doctorId as string | null,
			})),
	].filter((b) => b.id !== excludeBranchId);

	for (const other of otherBranches) {
		const existingRules = await prisma.availabilityRule.findMany({
			where: {
				branchId: other.id,
				doctorId: other.scopeDoctorId,
				isActive: true,
			},
		});

		for (const existing of existingRules) {
			for (const incoming of newRules) {
				if (existing.dayOfWeek !== incoming.dayOfWeek) continue;
				const overlaps =
					incoming.startTime < existing.endTime &&
					existing.startTime < incoming.endTime;
				if (overlaps) {
					return `Overlaps with existing schedule at "${other.name}" on day ${incoming.dayOfWeek} (${existing.startTime}-${existing.endTime})`;
				}
			}
		}
	}

	return null;
}
// GET /api/v1/doctor/branches
router.get("/branches", requireDoctor, async (req: any, res, next) => {
	try {
		const rawId = req.user?.doctorId || (req.query.doctorId as string);
		if (!rawId) {
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		const doctorId = await resolveDocitorId(rawId);
		if (!doctorId) {
			res.status(404).json({ error: "Doctor not found" });
			return;
		}

		// A doctor's full branch list is the union of two sources:
		// 1. Private-practice branches they own directly (Branch.doctorId)
		// 2. Facility branches they've been invited to and accepted (BranchAssignment)
		// A branch can only ever be in one of these two sets, never both, so no
		// dedup is needed — but we still merge+sort them into a single list.
		const [ownedBranches, assignments] = await Promise.all([
			prisma.branch.findMany({
				where: { doctorId, isActive: true },
				include: { _count: { select: { appointments: true } } },
			}),
			prisma.branchAssignment.findMany({
				where: { doctorId, isActive: true },
				include: {
					branch: {
						include: { _count: { select: { appointments: true } } },
					},
				},
			}),
		]);

		const assignedBranches = assignments
			.filter((a) => a.branch && a.branch.isActive)
			.map((a) => ({
				...a.branch,
				// Facility-set fee for this specific doctor at this branch, when present,
				// overrides the branch's own default consultationFee.
				consultationFee: a.consultationFee ?? a.branch.consultationFee,
				isFacilityBranch: true,
			}));

		const branches = [
			...ownedBranches.map((b) => ({ ...b, isFacilityBranch: false })),
			...assignedBranches,
		].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		res.json({ success: true, data: branches });
	} catch (error) {
		next(error);
	}
});

// GET /api/v1/doctor/branches/:branchId/availability
// Optional ?doctorId= scopes to a specific facility-assigned doctor's rules.
// Omitted (legacy/private-practice calls) returns the branch's own rules.
router.get(
	"/branches/:branchId/availability",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { branchId } = req.params;
			const rawDoctorId =
				req.user?.doctorId || (req.query.doctorId as string | undefined);

			let scopeDoctorId: string | null = null;
			if (rawDoctorId) {
				const doctorId = await resolveDocitorId(String(rawDoctorId));
				if (!doctorId) {
					res.status(404).json({ error: "Doctor not found" });
					return;
				}

				const access = await resolveBranchAccess(branchId, doctorId);
				if ("error" in access) {
					res.status(403).json({ error: access.error });
					return;
				}
				scopeDoctorId = access.scopeDoctorId;
			}

			const rules = await prisma.availabilityRule.findMany({
				where: { branchId, doctorId: scopeDoctorId, isActive: true },
				orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
			});

			res.json({ success: true, data: rules });
		} catch (error) {
			next(error);
		}
	},
);

// POST /api/v1/doctor/branches/:branchId/availability
router.post(
	"/branches/:branchId/availability",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { branchId } = req.params;
			const { dayOfWeek, startTime, endTime, slotDurationMinutes } = req.body;

			if (
				dayOfWeek === undefined ||
				!startTime ||
				!endTime ||
				!slotDurationMinutes
			) {
				res.status(400).json({
					error: "Missing required fields",
					required: [
						"dayOfWeek",
						"startTime",
						"endTime",
						"slotDurationMinutes",
					],
				});
				return;
			}

			if (dayOfWeek < 0 || dayOfWeek > 6) {
				res.status(400).json({ error: "dayOfWeek must be 0-6 (Sunday=0)" });
				return;
			}

			const rule = await prisma.availabilityRule.create({
				data: {
					branchId,
					dayOfWeek,
					startTime,
					endTime,
					slotDurationMinutes,
					isActive: true,
				},
			});

			logger.info(
				`Availability rule created: ${rule.id} for branch ${branchId}`,
			);
			res.status(201).json({ success: true, data: rule });
		} catch (error) {
			next(error);
		}
	},
);

// PUT /api/v1/doctor/branches/:branchId/availability
// Replaces all active availability rules for a branch
router.put(
	"/branches/:branchId/availability",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { branchId } = req.params;
			const { rules } = req.body as {
				rules?: Array<{
					dayOfWeek: number;
					startTime: string;
					endTime: string;
					slotDurationMinutes?: number;
				}>;
			};

			if (!Array.isArray(rules)) {
				res.status(400).json({ error: "rules must be an array" });
				return;
			}

			for (const rule of rules) {
				const dayOfWeek = Number(rule.dayOfWeek);
				const startTime = rule.startTime;
				const endTime = rule.endTime;
				const slotDurationMinutes = Number(rule.slotDurationMinutes ?? 30);

				if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
					res.status(400).json({ error: "dayOfWeek must be between 0 and 6" });
					return;
				}
				if (!startTime || !endTime || startTime >= endTime) {
					res.status(400).json({
						error: "Each rule must have a valid startTime and endTime",
					});
					return;
				}
				if (Number.isNaN(slotDurationMinutes) || slotDurationMinutes <= 0) {
					res
						.status(400)
						.json({ error: "slotDurationMinutes must be a positive number" });
					return;
				}
			}

			const rawId =
				req.user?.doctorId ||
				req.body.doctorId ||
				req.body.doctor_id ||
				req.query.doctorId;
			if (!rawId) {
				res.status(401).json({ error: "doctorId is required" });
				return;
			}

			const doctorId = await resolveDocitorId(String(rawId));
			if (!doctorId) {
				res.status(404).json({ error: "Doctor not found" });
				return;
			}

			const access = await resolveBranchAccess(branchId, doctorId);
			if ("error" in access) {
				res.status(403).json({ error: access.error });
				return;
			}
			const { scopeDoctorId } = access;

			const overlapError = await findScheduleOverlap(
				doctorId,
				branchId,
				rules.map((r) => ({
					dayOfWeek: Number(r.dayOfWeek),
					startTime: r.startTime,
					endTime: r.endTime,
				})),
			);
			if (overlapError) {
				res.status(409).json({ error: overlapError });
				return;
			}

			await prisma.$transaction(async (tx) => {
				await tx.availabilityRule.updateMany({
					where: { branchId, doctorId: scopeDoctorId, isActive: true },
					data: { isActive: false },
				});

				if (rules.length > 0) {
					await tx.availabilityRule.createMany({
						data: rules.map((rule) => ({
							branchId,
							doctorId: scopeDoctorId,
							dayOfWeek: Number(rule.dayOfWeek),
							startTime: rule.startTime,
							endTime: rule.endTime,
							slotDurationMinutes: Number(rule.slotDurationMinutes ?? 30),
							isActive: true,
						})),
					});
				}
			});

			const updatedRules = await prisma.availabilityRule.findMany({
				where: { branchId, doctorId: scopeDoctorId, isActive: true },
				orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
			});

			res.json({ success: true, data: updatedRules });
		} catch (error) {
			next(error);
		}
	},
);

// DELETE /api/v1/doctor/branches/:branchId/availability/:ruleId
router.delete(
	"/branches/:branchId/availability/:ruleId",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { branchId, ruleId } = req.params;

			const rule = await prisma.availabilityRule.findFirst({
				where: { id: ruleId, branchId },
			});
			if (!rule) {
				res.status(404).json({ error: "Rule not found" });
				return;
			}

			await prisma.availabilityRule.update({
				where: { id: ruleId },
				data: { isActive: false },
			});

			res.json({ success: true, message: "Rule deleted successfully" });
		} catch (error) {
			next(error);
		}
	},
);

// POST /api/v1/doctor/branches/:branchId/overrides
router.post(
	"/branches/:branchId/overrides",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { branchId } = req.params;
			const { date, type, startTime, endTime, reason } = req.body;
			const rawId =
				req.user?.doctorId || req.body.doctorId || req.query.doctorId;

			if (!date || !type) {
				res.status(400).json({ error: "Missing required fields" });
				return;
			}
			if (!["BLOCK", "EXTRA"].includes(type)) {
				res.status(400).json({ error: "type must be BLOCK or EXTRA" });
				return;
			}
			if (type === "EXTRA" && (!startTime || !endTime)) {
				res
					.status(400)
					.json({ error: "EXTRA overrides require startTime and endTime" });
				return;
			}

			let scopeDoctorId: string | null = null;
			if (rawId) {
				const doctorId = await resolveDocitorId(String(rawId));
				if (!doctorId) {
					res.status(404).json({ error: "Doctor not found" });
					return;
				}
				const access = await resolveBranchAccess(branchId, doctorId);
				if ("error" in access) {
					res.status(403).json({ error: access.error });
					return;
				}
				scopeDoctorId = access.scopeDoctorId;
			}

			const override = await prisma.availabilityOverride.create({
				data: {
					branchId,
					doctorId: scopeDoctorId,
					date: new Date(date),
					type,
					startTime: startTime || null,
					endTime: endTime || null,
					reason: reason || null,
				},
			});

			res.status(201).json({ success: true, data: override });
		} catch (error) {
			next(error);
		}
	},
);

// GET /api/v1/doctor/branches/:branchId/overrides
router.get(
	"/branches/:branchId/overrides",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { branchId } = req.params;
			const rawId =
				req.user?.doctorId || (req.query.doctorId as string | undefined);

			let scopeDoctorId: string | null = null;
			if (rawId) {
				const doctorId = await resolveDocitorId(String(rawId));
				if (!doctorId) {
					res.status(404).json({ error: "Doctor not found" });
					return;
				}
				const access = await resolveBranchAccess(branchId, doctorId);
				if ("error" in access) {
					res.status(403).json({ error: access.error });
					return;
				}
				scopeDoctorId = access.scopeDoctorId;
			}

			const overrides = await prisma.availabilityOverride.findMany({
				where: { branchId, doctorId: scopeDoctorId },
				orderBy: [{ date: "asc" }, { createdAt: "asc" }],
			});

			res.json({ success: true, data: overrides });
		} catch (error) {
			next(error);
		}
	},
);

// DELETE /api/v1/doctor/branches/:branchId/overrides/:overrideId
router.delete(
	"/branches/:branchId/overrides/:overrideId",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { branchId, overrideId } = req.params;

			const existing = await prisma.availabilityOverride.findFirst({
				where: { id: overrideId, branchId },
			});

			if (!existing) {
				res.status(404).json({ error: "Override not found" });
				return;
			}

			await prisma.availabilityOverride.delete({
				where: { id: overrideId },
			});

			res.json({ success: true, message: "Override deleted successfully" });
		} catch (error) {
			next(error);
		}
	},
);

// GET /api/v1/doctor/appointments
router.get("/appointments", requireDoctor, async (req: any, res, next) => {
	try {
		const rawId = req.user?.doctorId || (req.query.doctorId as string);
		if (!rawId) {
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		const doctorId = await resolveDocitorId(rawId);
		if (!doctorId) {
			res.status(404).json({ error: "Doctor not found" });
			return;
		}

		const { status, startDate, endDate } = req.query;
		const where: any = { doctorId };

		if (status) where.status = status;
		if (startDate || endDate) {
			where.date = {};
			if (startDate) where.date.gte = new Date(startDate as string);
			if (endDate) where.date.lte = new Date(endDate as string);
		}

		const appointments = await prisma.appointment.findMany({
			where,
			include: {
				branch: true,
				patient: { select: { id: true, name: true, email: true } },
			},
			orderBy: [{ date: "asc" }, { startTime: "asc" }],
		});

		res.json({ success: true, data: appointments });
	} catch (error) {
		next(error);
	}
});

// PATCH /api/v1/doctor/appointments/:id/status
router.patch(
	"/appointments/:id/status",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { id } = req.params;
			const { status } = req.body;

			if (
				!status ||
				!["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"].includes(status)
			) {
				res.status(400).json({
					error: "Invalid status",
					valid: ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"],
				});
				return;
			}

			const appointment = await prisma.appointment.update({
				where: { id },
				data: {
					status,
					cancelledBy: status === "CANCELLED" ? "DOCTOR" : undefined,
					cancelledAt: status === "CANCELLED" ? new Date() : undefined,
				},
				include: { branch: true, patient: true },
			});

			logger.info(`Appointment ${id} status updated to ${status}`);

			rabbitMQClient
				.publishEvent("appointment.status_changed", {
					id: appointment.id,
					doctorId: appointment.doctorId,
					branchId: appointment.branchId,
					patientId: appointment.patientId,
					status: appointment.status,
					date: appointment.date,
					consultationFee: appointment.branch?.consultationFee ?? null,
				})
				.catch((err) =>
					logger.error("Failed to publish appointment.status_changed:", err),
				);

			res.json({ success: true, data: appointment });
		} catch (error) {
			next(error);
		}
	},
);
// PATCH /api/v1/doctor/appointments/:id/reschedule
router.patch(
	"/appointments/:id/reschedule",
	requireDoctor,
	async (req: any, res, next) => {
		try {
			const { id } = req.params;
			const { date, startTime, endTime } = req.body;

			if (!date || !startTime || !endTime) {
				res.status(400).json({
					error: "Missing required fields",
					required: ["date", "startTime", "endTime"],
				});
				return;
			}

			const existing = await prisma.appointment.findUnique({ where: { id } });
			if (!existing) {
				res.status(404).json({ error: "Appointment not found" });
				return;
			}

			if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(existing.status)) {
				res.status(400).json({
					error: `Cannot reschedule a ${existing.status.toLowerCase()} appointment`,
				});
				return;
			}

			// Prevent double-booking the new slot (excluding this appointment itself)
			const conflict = await prisma.appointment.findFirst({
				where: {
					branchId: existing.branchId,
					date: new Date(date),
					startTime,
					status: { not: "CANCELLED" },
					id: { not: id },
				},
			});

			if (conflict) {
				res.status(409).json({
					error: "Slot already booked",
					message: "The selected time slot is not available",
				});
				return;
			}

			const appointment = await prisma.appointment.update({
				where: { id },
				data: {
					date: new Date(date),
					startTime,
					endTime,
					status: "PENDING", // re-confirm required after reschedule
				},
				include: { branch: true, patient: true },
			});

			logger.info(
				`Appointment ${id} rescheduled to ${date} ${startTime}-${endTime}`,
			);
			res.json({ success: true, data: appointment });
		} catch (error) {
			next(error);
		}
	},
);
// GET /api/v1/doctor/settings
router.get("/settings", requireDoctor, async (req: any, res, next) => {
	try {
		const rawId = req.user?.doctorId || (req.query.doctorId as string);
		if (!rawId) {
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		const doctorId = await resolveDocitorId(rawId);
		if (!doctorId) {
			res.status(404).json({ error: "Doctor not found" });
			return;
		}

		let settings = await prisma.doctorSettings.findUnique({
			where: { doctorId },
		});

		if (!settings) {
			settings = await prisma.doctorSettings.create({
				data: {
					doctorId,
					autoAccept: false,
					noticePeriod: "24_hours",
					bufferTime: 0,
					maxDailyBookings: 10,
					maxWeeklyBookings: 50,
				},
			});
		}

		res.json({
			success: true,
			data: {
				doctor_id: settings.doctorId,
				auto_accept_bookings: settings.autoAccept,
				notice_period_hours: noticePeriodToHours(settings.noticePeriod),
				buffer_time_minutes: settings.bufferTime,
				daily_booking_limit: settings.maxDailyBookings,
				weekly_booking_limit: settings.maxWeeklyBookings,
			},
		});
	} catch (error) {
		next(error);
	}
});

// PUT /api/v1/doctor/settings
router.put("/settings", requireDoctor, async (req: any, res, next) => {
	try {
		const rawId = req.user?.doctorId || req.body.doctorId || req.body.doctor_id;
		if (!rawId) {
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		const doctorId = await resolveDocitorId(rawId);
		if (!doctorId) {
			res.status(404).json({ error: "Doctor not found" });
			return;
		}

		const resolvedAutoAccept =
			req.body.auto_accept_bookings ?? req.body.autoAccept;
		const resolvedNoticePeriod =
			req.body.noticePeriod ||
			hoursToNoticePeriod(req.body.notice_period_hours);
		const resolvedBufferTime =
			req.body.buffer_time_minutes ?? req.body.bufferTime;
		const resolvedMaxDaily =
			req.body.daily_booking_limit ?? req.body.maxDailyBookings;
		const resolvedMaxWeekly =
			req.body.weekly_booking_limit ?? req.body.maxWeeklyBookings;

		const validNoticePeriods = [
			"none",
			"1_hour",
			"2_hours",
			"4_hours",
			"8_hours",
			"12_hours",
			"24_hours",
			"48_hours",
			"72_hours",
		];
		if (
			resolvedNoticePeriod &&
			!validNoticePeriods.includes(resolvedNoticePeriod)
		) {
			res.status(400).json({ error: "Invalid notice period" });
			return;
		}

		let settings = await prisma.doctorSettings.findUnique({
			where: { doctorId },
		});

		if (settings) {
			settings = await prisma.doctorSettings.update({
				where: { doctorId },
				data: {
					autoAccept:
						resolvedAutoAccept !== undefined
							? resolvedAutoAccept
							: settings.autoAccept,
					noticePeriod: resolvedNoticePeriod || settings.noticePeriod,
					bufferTime:
						resolvedBufferTime !== undefined
							? resolvedBufferTime
							: settings.bufferTime,
					maxDailyBookings:
						resolvedMaxDaily !== undefined
							? resolvedMaxDaily
							: settings.maxDailyBookings,
					maxWeeklyBookings:
						resolvedMaxWeekly !== undefined
							? resolvedMaxWeekly
							: settings.maxWeeklyBookings,
				},
			});
		} else {
			settings = await prisma.doctorSettings.create({
				data: {
					doctorId,
					autoAccept: resolvedAutoAccept || false,
					noticePeriod: resolvedNoticePeriod || "24_hours",
					bufferTime: resolvedBufferTime || 0,
					maxDailyBookings: resolvedMaxDaily || 10,
					maxWeeklyBookings: resolvedMaxWeekly || 50,
				},
			});
		}

		res.json({
			success: true,
			data: {
				doctor_id: settings.doctorId,
				auto_accept_bookings: settings.autoAccept,
				notice_period_hours: noticePeriodToHours(settings.noticePeriod),
				buffer_time_minutes: settings.bufferTime,
				daily_booking_limit: settings.maxDailyBookings,
				weekly_booking_limit: settings.maxWeeklyBookings,
			},
		});
	} catch (error) {
		next(error);
	}
});

export { router as doctorRoutes };
