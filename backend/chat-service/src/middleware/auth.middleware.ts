import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";

export interface AuthedRequest extends Request {
	user?: { userId: string; role: string };
}

export function requireAuth(
	req: AuthedRequest,
	res: Response,
	next: NextFunction,
) {
	const header = req.headers.authorization;
	if (!header || !header.startsWith("Bearer ")) {
		res.status(401).json({ error: "Authentication required" });
		return;
	}
	const token = header.slice("Bearer ".length);
	try {
		const payload = jwt.verify(token, JWT_SECRET) as {
			userId: string;
			role: string;
		};
		req.user = { userId: payload.userId, role: payload.role };
		next();
	} catch {
		res.status(401).json({ error: "Invalid or expired token" });
	}
}

/**
 * Socket.io handshake auth — same JWT_SECRET/verification logic as requireAuth,
 * used in the io.use() middleware since socket.io doesn't have Express req/res.
 */
export function verifySocketToken(token: string | undefined): {
	userId: string;
	role: string;
} {
	if (!token) {
		throw new Error("Authentication required");
	}
	const payload = jwt.verify(token, JWT_SECRET) as {
		userId: string;
		role: string;
	};
	return { userId: payload.userId, role: payload.role };
}
