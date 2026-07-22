import { type Response, Router } from "express";
import { prisma } from "../../lib/prisma";
import {
	type AuthedRequest,
	requireAuth,
} from "../../middleware/auth.middleware";
import { getIO } from "../../sockets/chat.socket";
import { logger } from "../../utils/logger";
import {
	blockUser,
	getMessages,
	getOrCreateRoom,
	listRoomsForUser,
	markMessagesAsRead,
	RoomAccessError,
	unblockUser,
} from "./rooms.service";

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

function handleRoomError(res: Response, error: unknown) {
	if (error instanceof RoomAccessError) {
		const statusMap: Record<string, number> = {
			BLOCKED: 403,
			CAPPED: 429,
			SPAM: 429,
			SELF_CHAT: 400,
			NOT_FOUND: 404,
		};
		res
			.status(statusMap[error.code] || 400)
			.json({ error: error.message, code: error.code });
		return;
	}
	logger.error("Unexpected room error:", error);
	res.status(500).json({ error: "Internal server error" });
}

// GET /rooms — list my rooms, with the other participant's cached profile attached
roomsRouter.get("/", async (req: AuthedRequest, res) => {
	try {
		const userId = req.user!.userId;
		const rooms = await listRoomsForUser(userId);
		const otherIds = rooms.map((r) =>
			r.userAId === userId ? r.userBId : r.userAId,
		);
		const otherUsers = await prisma.user.findMany({
			where: { id: { in: otherIds } },
		});
		const userMap = new Map(otherUsers.map((u) => [u.id, u]));
		const unreadCounts = await prisma.message.groupBy({
			by: ["roomId"],
			where: {
				roomId: { in: rooms.map((r) => r.id) },
				senderId: { not: userId },
				readAt: null,
			},
			_count: { id: true },
		});
		const unreadMap = new Map(unreadCounts.map((u) => [u.roomId, u._count.id]));
		const result = rooms.map((r) => {
			const otherId = r.userAId === userId ? r.userBId : r.userAId;
			return {
				id: r.id,
				otherUser: userMap.get(otherId) || {
					id: otherId,
					name: "Unknown",
					photoUrl: null,
					about: null,
				},
				lastMessage: r.messages[0] || null,
				isUnlocked: r.state?.isUnlocked ?? false,
				blockedBy: r.state?.blockedBy ?? null,
				unreadCount: unreadMap.get(r.id) || 0,
			};
		});
		res.json({ data: result });
	} catch (error) {
		handleRoomError(res, error);
	}
});

// GET /rooms/:id/messages?cursor=&take=
roomsRouter.get("/:id/messages", async (req: AuthedRequest, res) => {
	try {
		const userId = req.user!.userId;
		const { cursor, take } = req.query;
		const messages = await getMessages(
			req.params.id,
			userId,
			cursor as string | undefined,
			take ? parseInt(take as string) : undefined,
		);
		res.json({ data: messages });
	} catch (error) {
		handleRoomError(res, error);
	}
});

// POST /rooms/with/:targetUserId — idempotent create-or-get, used by every "Chat" button
roomsRouter.post("/with/:targetUserId", async (req: AuthedRequest, res) => {
	try {
		const userId = req.user!.userId;
		const room = await getOrCreateRoom(userId, req.params.targetUserId);
		res.json({ data: { id: room.id } });
	} catch (error) {
		handleRoomError(res, error);
	}
});

// POST /rooms/:id/block
// POST /rooms/:id/block
roomsRouter.post("/:id/block", async (req: AuthedRequest, res) => {
	try {
		const roomId = req.params.id;
		await blockUser(roomId, req.user!.userId);
		getIO()
			.to(roomId)
			.emit("room_blocked", { roomId, blockedBy: req.user!.userId });
		res.json({ data: { blocked: true } });
	} catch (error) {
		handleRoomError(res, error);
	}
});

// POST /rooms/:id/unblock
roomsRouter.post("/:id/unblock", async (req: AuthedRequest, res) => {
	try {
		const roomId = req.params.id;
		await unblockUser(roomId, req.user!.userId);
		getIO().to(roomId).emit("room_unblocked", { roomId });
		res.json({ data: { blocked: false } });
	} catch (error) {
		handleRoomError(res, error);
	}
});

// POST /rooms/:id/read — mark all of the other person's messages as read
roomsRouter.post("/:id/read", async (req: AuthedRequest, res) => {
	try {
		await markMessagesAsRead(req.params.id, req.user!.userId);
		res.json({ data: { ok: true } });
	} catch (error) {
		handleRoomError(res, error);
	}
});
