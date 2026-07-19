import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
	type AuthedRequest,
	requireAdmin,
} from "../../middleware/auth.middleware";
import { logger } from "../../utils/logger";

const AUTH_SERVICE_URL =
	process.env.AUTH_SERVICE_URL || "http://auth-service:3000";
const PAGE_SIZE = 20;

export const verificationRouter = Router();
verificationRouter.use(requireAdmin);

async function callAuthService(path: string, req: AuthedRequest, body?: any) {
	const authHeader = req.header("Authorization");
	const response = await fetch(`${AUTH_SERVICE_URL}${path}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			Authorization: authHeader || "",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	return response;
}

function parsePage(req: AuthedRequest): number {
	const p = parseInt(req.query.page as string, 10);
	return Number.isFinite(p) && p > 0 ? p : 1;
}

// ---------- Doctors ----------

verificationRouter.get("/doctors", async (req: AuthedRequest, res) => {
	const status = (req.query.status as string) || "pending";
	const search = (req.query.search as string) || "";
	const page = parsePage(req);
	const blockedUsers = await prisma.user.findMany({
		where: {
			OR: [{ isSuspended: true }, { deletedAt: { not: null } }],
		},
		select: { id: true },
	});
	const blockedUserIds = blockedUsers.map((u) => u.id);

	const where: any = { verificationStatus: status, AND: [] as any[] };
	if (blockedUserIds.length > 0) {
		where.AND.push({ userId: { notIn: blockedUserIds } });
	}
	if (search) {
		const users = await prisma.user.findMany({
			where: {
				isSuspended: false,
				deletedAt: null,
				OR: [
					{ email: { contains: search, mode: "insensitive" } },
					{ id: { contains: search, mode: "insensitive" } },
				],
			},
			select: { id: true },
			take: 300,
		});
		const userIds = users.map((u) => u.id);
		where.AND.push({
			OR: [
				{ id: { contains: search, mode: "insensitive" } },
				{ userId: { contains: search, mode: "insensitive" } },
				...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
			],
		});
	}
	if (where.AND.length === 0) delete where.AND;

	const [rows, total] = await Promise.all([
		prisma.doctorVerification.findMany({
			where,
			orderBy: { createdAt: "asc" },
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
		}),
		prisma.doctorVerification.count({ where }),
	]);

	const userIds = [...new Set(rows.map((r) => r.userId))];
	const users = await prisma.user.findMany({
		where: { id: { in: userIds } },
		select: { id: true, email: true, username: true },
	});
	const userMap = new Map(users.map((u) => [u.id, u]));
	const data = rows.map((r) => {
		const { fullName, ...rest } = r; // remove the real name
		return {
			...rest,
			email: userMap.get(r.userId)?.email || null,
			username: userMap.get(r.userId)?.username || null,
		};
	});

	res.json({ data, page, pageSize: PAGE_SIZE, total });
});

verificationRouter.patch(
	"/doctors/:id/verify",
	async (req: AuthedRequest, res) => {
		try {
			const response = await callAuthService(
				`/admin/doctors/${req.params.id}/verify`,
				req,
			);
			if (!response.ok) {
				res.status(response.status).json(await response.json());
				return;
			}
			await prisma.doctorVerification.update({
				where: { id: req.params.id },
				data: {
					verificationStatus: "verified",
					reviewedBy: req.user!.userId,
					reviewedAt: new Date(),
				},
			});
			await prisma.auditLog.create({
				data: {
					adminId: req.user!.userId,
					action: "doctor.verify",
					targetId: req.params.id,
				},
			});
			res.json({ data: { verified: true } });
		} catch (error) {
			logger.error("Failed to verify doctor:", error);
			res.status(502).json({ error: "Failed to reach auth-service" });
		}
	},
);

verificationRouter.patch(
	"/doctors/:id/reject",
	async (req: AuthedRequest, res) => {
		try {
			const response = await callAuthService(
				`/admin/doctors/${req.params.id}/reject`,
				req,
			);
			if (!response.ok) {
				res.status(response.status).json(await response.json());
				return;
			}
			await prisma.doctorVerification.update({
				where: { id: req.params.id },
				data: {
					verificationStatus: "rejected",
					rejectionReason: req.body?.reason || null,
					reviewedBy: req.user!.userId,
					reviewedAt: new Date(),
				},
			});
			await prisma.auditLog.create({
				data: {
					adminId: req.user!.userId,
					action: "doctor.reject",
					targetId: req.params.id,
					metadata: req.body,
				},
			});
			res.json({ data: { rejected: true } });
		} catch (error) {
			logger.error("Failed to reject doctor:", error);
			res.status(502).json({ error: "Failed to reach auth-service" });
		}
	},
);

// ---------- Facilities (hospitals / medical centers / pharmacies) ----------
// facilityType values assumed: 'hospital' | 'medical_center' | 'clinic' | 'pharmacy'
// Confirm these match your ClinicProfile.facility_type enum — adjust the map below if not.

const FACILITY_TYPE_MAP: Record<string, string> = {
	hospitals: "hospital",
	"medical-centers": "medical_center",
	pharmacies: "pharmacy",
};

verificationRouter.get(
	"/facilities/:category",
	async (req: AuthedRequest, res) => {
		const category = req.params.category;
		const facilityType = FACILITY_TYPE_MAP[category];
		if (!facilityType) {
			res.status(400).json({ error: `Unknown facility category: ${category}` });
			return;
		}

		const status = (req.query.status as string) || "pending";
		const search = (req.query.search as string) || "";
		const page = parsePage(req);
		const blockedUsers = await prisma.user.findMany({
			where: {
				OR: [{ isSuspended: true }, { deletedAt: { not: null } }],
			},
			select: { id: true },
		});
		const blockedUserIds = blockedUsers.map((u) => u.id);

		const where: any = { status, facilityType, AND: [] as any[] };
		if (blockedUserIds.length > 0) {
			where.AND.push({ userId: { notIn: blockedUserIds } });
		}
		if (search) {
			const users = await prisma.user.findMany({
				where: {
					isSuspended: false,
					deletedAt: null,
					OR: [
						{ email: { contains: search, mode: "insensitive" } },
						{ id: { contains: search, mode: "insensitive" } },
					],
				},
				select: { id: true },
				take: 300,
			});
			const userIds = users.map((u) => u.id);
			where.AND.push({
				OR: [
					{ id: { contains: search, mode: "insensitive" } },
					{ userId: { contains: search, mode: "insensitive" } },
					...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
				],
			});
		}
		if (where.AND.length === 0) delete where.AND;

		const [rows, total] = await Promise.all([
			prisma.facilityVerification.findMany({
				where,
				orderBy: { createdAt: "asc" },
				skip: (page - 1) * PAGE_SIZE,
				take: PAGE_SIZE,
			}),
			prisma.facilityVerification.count({ where }),
		]);

		const userIds = [...new Set(rows.map((r) => r.userId))];
		const users = await prisma.user.findMany({
			where: { id: { in: userIds } },
			select: { id: true, email: true, username: true },
		});
		const userMap = new Map(users.map((u) => [u.id, u]));
		const data = rows.map((r) => ({
			...r,
			email: userMap.get(r.userId)?.email || null,
			username: userMap.get(r.userId)?.username || null,
		}));
		res.json({ data, page, pageSize: PAGE_SIZE, total });
	},
);

verificationRouter.patch(
	"/facilities/:id/verify",
	async (req: AuthedRequest, res) => {
		try {
			const facility = await prisma.facilityVerification.findUnique({
				where: { id: req.params.id },
			});
			if (!facility) {
				res.status(404).json({ error: "Facility not found in cache" });
				return;
			}
			const response = await callAuthService(
				`/admin/facilities/${req.params.id}/verify`,
				req,
				{
					type: facility.facilityType,
				},
			);
			if (!response.ok) {
				res.status(response.status).json(await response.json());
				return;
			}
			await prisma.facilityVerification.update({
				where: { id: req.params.id },
				data: {
					status: "verified",
					reviewedBy: req.user!.userId,
					reviewedAt: new Date(),
				},
			});
			await prisma.auditLog.create({
				data: {
					adminId: req.user!.userId,
					action: "facility.verify",
					targetId: req.params.id,
				},
			});
			res.json({ data: { verified: true } });
		} catch (error) {
			logger.error("Failed to verify facility:", error);
			res.status(502).json({ error: "Failed to reach auth-service" });
		}
	},
);

verificationRouter.patch(
	"/facilities/:id/reject",
	async (req: AuthedRequest, res) => {
		try {
			const facility = await prisma.facilityVerification.findUnique({
				where: { id: req.params.id },
			});
			if (!facility) {
				res.status(404).json({ error: "Facility not found in cache" });
				return;
			}
			const response = await callAuthService(
				`/admin/facilities/${req.params.id}/reject`,
				req,
				{
					type: facility.facilityType,
				},
			);
			if (!response.ok) {
				res.status(response.status).json(await response.json());
				return;
			}
			await prisma.facilityVerification.update({
				where: { id: req.params.id },
				data: {
					status: "suspended",
					rejectionReason: req.body?.reason || null,
					reviewedBy: req.user!.userId,
					reviewedAt: new Date(),
				},
			});
			await prisma.auditLog.create({
				data: {
					adminId: req.user!.userId,
					action: "facility.reject",
					targetId: req.params.id,
					metadata: req.body,
				},
			});
			res.json({ data: { rejected: true } });
		} catch (error) {
			logger.error("Failed to reject facility:", error);
			res.status(502).json({ error: "Failed to reach auth-service" });
		}
	},
);

// ---------- Block / Unblock / Blocked tab ----------

verificationRouter.patch(
	"/users/:userId/block",
	async (req: AuthedRequest, res) => {
		try {
			const response = await callAuthService(
				`/admin/users/${req.params.userId}/block`,
				req,
			);
			if (!response.ok) {
				res.status(response.status).json(await response.json());
				return;
			}
			// Optimistic local update — the RabbitMQ event will confirm/overwrite shortly after
			await prisma.user
				.update({
					where: { id: req.params.userId },
					data: { isSuspended: true, blockedAt: new Date() },
				})
				.catch(() => {}); // ignore if not yet in cache
			await prisma.auditLog.create({
				data: {
					adminId: req.user!.userId,
					action: "user.block",
					targetId: req.params.userId,
				},
			});
			res.json({ data: { blocked: true } });
		} catch (error) {
			logger.error("Failed to block user:", error);
			res.status(502).json({ error: "Failed to reach auth-service" });
		}
	},
);

verificationRouter.patch(
	"/users/:userId/unblock",
	async (req: AuthedRequest, res) => {
		try {
			const response = await callAuthService(
				`/admin/users/${req.params.userId}/unblock`,
				req,
			);
			if (!response.ok) {
				res.status(response.status).json(await response.json());
				return;
			}
			await prisma.user
				.update({
					where: { id: req.params.userId },
					data: { isSuspended: false, blockedAt: null },
				})
				.catch(() => {});
			await prisma.auditLog.create({
				data: {
					adminId: req.user!.userId,
					action: "user.unblock",
					targetId: req.params.userId,
				},
			});
			res.json({ data: { unblocked: true } });
		} catch (error) {
			logger.error("Failed to unblock user:", error);
			res.status(502).json({ error: "Failed to reach auth-service" });
		}
	},
);

verificationRouter.get("/blocked", async (req: AuthedRequest, res) => {
	const search = (req.query.search as string) || "";
	const page = parsePage(req);

	const where: any = { isSuspended: true, deletedAt: null, AND: [] as any[] };
	if (search) {
		where.AND.push({
			OR: [
				{ email: { contains: search, mode: "insensitive" } },
				{ id: { contains: search, mode: "insensitive" } },
			],
		});
	}
	if (where.AND.length === 0) {
		delete where.AND;
	}

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			orderBy: { blockedAt: "asc" },
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
		}),
		prisma.user.count({ where }),
	]);

	// Attach display name/type from doctor or facility cache, and hours remaining
	const data = await Promise.all(
		users.map(async (u) => {
			const doctor = await prisma.doctorVerification.findFirst({
				where: { userId: u.id },
			});
			const facility = doctor
				? null
				: await prisma.facilityVerification.findFirst({
						where: { userId: u.id },
					});

			const displayName =
				doctor?.fullName || facility?.name || u.username || u.email || u.id;
			const accountType = doctor
				? "doctor"
				: facility
					? facility.facilityType
					: u.role;

			const hoursElapsed = u.blockedAt
				? (Date.now() - new Date(u.blockedAt).getTime()) / (1000 * 60 * 60)
				: 0;
			const hoursRemaining = Math.max(0, 24 - hoursElapsed);

			return {
				id: u.id,
				displayName,
				accountType,
				email: u.email,
				blockedAt: u.blockedAt,
				hoursRemaining: Math.round(hoursRemaining * 10) / 10,
			};
		}),
	);

	res.json({ data, page, pageSize: PAGE_SIZE, total });
});
