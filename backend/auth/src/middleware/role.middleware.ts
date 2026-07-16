import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../entity/User";

export const requireRole = (...roles: UserRole[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		const user = (req as any).user;
		if (!user || !roles.includes(user.role)) {
			res.status(403).json({ message: "Forbidden: insufficient permissions" });
			return;
		}
		next();
	};
};
