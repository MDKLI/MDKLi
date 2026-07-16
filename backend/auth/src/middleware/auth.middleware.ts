import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret";

export const authMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	const token = req.header("Authorization")?.replace("Bearer ", "");
	if (!token) {
		res.status(401).json({ message: "Access denied. No token provided." });
		return;
	}

	try {
		const decoded = jwt.verify(token, JWT_SECRET) as {
			userId: string;
			role: string;
		};
		console.log("[AUTH] Token decoded successfully, userId:", decoded.userId);
		const userRepository = AppDataSource.getRepository(User);
		const user = await userRepository.findOne({
			where: { id: decoded.userId },
		});
		if (!user) {
			console.log("[AUTH] User not found for ID:", decoded.userId);
			res.status(401).json({ message: "Invalid token." });
			return;
		}
		console.log("[AUTH] User found:", user.username, "Role:", user.role);
		(req as any).user = user;
		next();
	} catch (error) {
		console.log("[AUTH] JWT verification error:", error);
		res.status(401).json({ message: "Invalid or expired token." });
	}
};
