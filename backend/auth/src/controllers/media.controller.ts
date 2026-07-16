import type { Request, Response } from "express";
import { validationResult } from "express-validator";
import multer from "multer";
import { AppDataSource } from "../data-source";
import { Branch } from "../entity/Branch";
import { ClinicProfile } from "../entity/ClinicProfile";
import { Doctor } from "../entity/Doctor";
import type { User } from "../entity/User";
import { publishBranchUpdated } from "../services/event-publisher.service";
import { MediaService } from "../services/media.service";
import logger from "../utility/logger";

// Configure multer for file upload
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
	},
	fileFilter: (_req, file, cb) => {
		// Accept only images
		if (file.mimetype.startsWith("image/")) {
			cb(null, true);
		} else {
			cb(new Error("Only image files are allowed") as any, false);
		}
	},
});

export const uploadMiddleware = upload.single("file");

// Upload profile picture
export const uploadProfilePicture = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400).json({ errors: errors.array() });
		return;
	}

	try {
		const user = (req as any).user as User;
		if (!user) {
			res.status(401).json({ message: "Unauthorized" });
			return;
		}

		if (!req.file) {
			res.status(400).json({ message: "No file uploaded" });
			return;
		}

		// Generate unique filename
		const timestamp = Date.now();
		const fileName = `profile-${user.id}-${timestamp}.${req.file.originalname.split(".").pop()}`;
		const folder = user.role === "doctor" ? "doctors" : "facilities";

		// Upload to MinIO
		const fileUrl = await MediaService.uploadFile(
			req.file.buffer,
			fileName,
			req.file.mimetype,
			folder,
		);

		// Update user profile
		if (user.role === "doctor") {
			const doctorRepo = AppDataSource.getRepository(Doctor);
			const doctor = await doctorRepo.findOne({
				where: { user: { id: user.id } },
			});
			if (doctor) {
				doctor.photo_url = fileUrl;
				await doctorRepo.save(doctor);
			}
		} else if (user.role === "clinic_admin") {
			const clinicRepo = AppDataSource.getRepository(ClinicProfile);
			const clinic = await clinicRepo.findOne({
				where: { user: { id: user.id } },
			});
			if (clinic) {
				clinic.photo_url = fileUrl;
				await clinicRepo.save(clinic);
			}
		}

		res.json({
			message: "Profile picture uploaded successfully",
			url: fileUrl,
		});
	} catch (error) {
		logger.error("Upload profile picture error:", error);
		res.status(500).json({ message: "Failed to upload profile picture" });
	}
};

// Upload branch media
export const uploadBranchMedia = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400).json({ errors: errors.array() });
		return;
	}

	try {
		const user = (req as any).user as User;
		if (!user) {
			res.status(401).json({ message: "Unauthorized" });
			return;
		}

		if (!req.file) {
			res.status(400).json({ message: "No file uploaded" });
			return;
		}

		const { branchId } = req.params;

		// Find branch
		const branchRepo = AppDataSource.getRepository(Branch);
		const branch = await branchRepo.findOne({
			where: { id: branchId, user: { id: user.id } },
		});

		if (!branch) {
			res.status(404).json({ message: "Branch not found" });
			return;
		}

		// Generate unique filename
		const timestamp = Date.now();
		const fileName = `branch-${branchId}-${timestamp}.${req.file.originalname.split(".").pop()}`;

		// Upload to MinIO
		const fileUrl = await MediaService.uploadFile(
			req.file.buffer,
			fileName,
			req.file.mimetype,
			"branches",
		);

		// Update branch media_urls
		if (!branch.media_urls) {
			branch.media_urls = [];
		}
		branch.media_urls.push(fileUrl);
		await branchRepo.save(branch);
		publishBranchUpdated(branch.id, user.id).catch((err) => {
			logger.error("Failed to publish branch.updated after media delete:", err);
		});

		res.json({
			message: "Branch media uploaded successfully",
			url: fileUrl,
			mediaUrls: branch.media_urls,
		});
	} catch (error) {
		logger.error("Upload branch media error:", error);
		res.status(500).json({ message: "Failed to upload branch media" });
	}
};

// Delete branch media
export const deleteBranchMedia = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const user = (req as any).user as User;
		if (!user) {
			res.status(401).json({ message: "Unauthorized" });
			return;
		}

		const { branchId, mediaUrl } = req.body;

		// Find branch
		const branchRepo = AppDataSource.getRepository(Branch);
		const branch = await branchRepo.findOne({
			where: { id: branchId, user: { id: user.id } },
		});

		if (!branch) {
			res.status(404).json({ message: "Branch not found" });
			return;
		}

		// Remove media URL from branch
		if (branch.media_urls) {
			branch.media_urls = branch.media_urls.filter((url) => url !== mediaUrl);
			await branchRepo.save(branch);
		}

		// Delete from MinIO
		await MediaService.deleteFile(mediaUrl);

		res.json({
			message: "Branch media deleted successfully",
			mediaUrls: branch.media_urls,
		});
	} catch (error) {
		logger.error("Delete branch media error:", error);
		res.status(500).json({ message: "Failed to delete branch media" });
	}
};
