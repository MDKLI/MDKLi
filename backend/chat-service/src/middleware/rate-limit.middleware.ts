import rateLimit from "express-rate-limit";

// General-purpose limiter for authenticated API routes.
// Keyed by IP by default; since these routes require auth, a logged-in
// attacker could still spam from one IP, but this stops basic flooding.
export const apiRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 300, // ~20 requests/min sustained — generous for normal chat UI polling
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Too many requests, please try again later." },
});
