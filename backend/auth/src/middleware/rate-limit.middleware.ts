import rateLimit from "express-rate-limit";

export const apiRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 300,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Too many requests, please try again later." },
});
