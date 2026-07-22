import { Router } from "express";
import multer from "multer";
import {
	type AuthedRequest,
	requireAuth,
} from "../../middleware/auth.middleware";
import { MEDIA_TYPE_LIMITS, MediaService } from "../../services/media.service";
import { logger } from "../../utils/logger";

// Multer's own limit uses the largest possible cap; the real per-type check happens after,
// since multer doesn't know the declared "type" field until the body is parsed.
const MAX_POSSIBLE_SIZE = Math.max(...Object.values(MEDIA_TYPE_LIMITS));
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_POSSIBLE_SIZE },
});

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

// POST /media/upload/:roomId  (multipart form: file, type)
mediaRouter.post(
	"/upload/:roomId",
	upload.single("file"),
	async (req: AuthedRequest, res) => {
		try {
			const { roomId } = req.params;
			const type = req.body.type as string;

			if (!req.file) {
				res.status(400).json({ error: "No file provided" });
				return;
			}

			if (!MEDIA_TYPE_LIMITS[type]) {
				res.status(400).json({ error: "Invalid media type" });
				return;
			}

			if (!MediaService.validateSize(type, req.file.size)) {
				res.status(413).json({
					error: `File exceeds the ${MEDIA_TYPE_LIMITS[type] / (1024 * 1024)}MB limit for ${type}`,
				});
				return;
			}

			const url = await MediaService.uploadFile(
				req.file.buffer,
				req.file.originalname,
				req.file.mimetype,
				roomId,
			);

			res.json({ data: { url, size: req.file.size, type } });
		} catch (error) {
			logger.error("Media upload failed:", error);
			res.status(500).json({ error: "Upload failed" });
		}
	},
);
